const partybus = require('partybus');
const normalize = require('./lib/normalize-config.js');
const Input = require('./lib/input.js');
const Output = require('./lib/output.js');
const IPC = require('./lib/ipc.js');
const path = require('path');
const os = require('os');
const fs = require('fs');
const events = require('events');
const colors = require('colors');

const readdir = (dir) => new Promise((resolve, reject) => fs.readdir(dir, (err, files) => {
	if (err) reject(err);
	else resolve(files);
}));
const readFile = (file) => new Promise((resolve, reject) => fs.readFile(file, (err, data) => {
	if (err) reject(err);
	else resolve(data);
}));

// Default log to stream converter
colors.setTheme({
	info: 'gray',
	warn: 'yellow',
	error: 'red'
});
const logToStreamFactory = (color = false) => (o) => {
	const fields = [];
	fields.push(o.date.toISOString());
	fields.push(o.nodeName + (o.componentName ? ':' + o.componentName : ''));
	if (color) {
		fields.push(o.level[o.level]);
	} else {
		fields.push(o.level);
	}
	fields.push(o.message);
	return fields.join('\t') + '\n';
};

class FTRM extends events.EventEmitter {
	constructor (bus, opts) {
		super();
		Object.assign(this, opts);
		this.components = [];
		if (bus) {
			this.bus = bus;
			this.id = bus.hood.id;
			this.name = bus.hood.info.subject.commonName;
			this.ipc = new IPC(bus);
			this.bus.hood.on('foundNeigh', (n) => this.emit('nodeAdd', {
				id: n.id,
				name: n.info.subject.commonName
			})).on('lostNeigh', (n) => this.emit('nodeRemove', {
				id: n.id,
				name: n.info.subject.commonName
			}));
		}
		if (this.ipc) {
			// Setup log streams which translates IPC log messages
			// to write on Writable streams.
			const streams = {};
			const formats = {};
			const onLog = (obj) => {
				if (!streams[obj.level]) return;
				streams[obj.level].write(formats[obj.level](obj));
			};
			this.ipc.on('log', onLog);
			this.logStreams.forEach((l) => {
				this.ipc.subscribe(l.addr);
				streams[l.level] = l.stream;
				formats[l.level] = l.format
					? l.format
					: logToStreamFactory(l.stream.isTTY);
			});

			// Wire events with streams
			const log = this._logFactory();
			this.on('nodeAdd', (n) => log.info(`Added node ${n.name}`, 'cd394adc98d44675a6ffa1349f152331'));
			this.on('nodeRemove', (n) => log.info(`Removed node ${n.name}`, '2ef0df5540b04627bd3b2cc3fc3fb169'));
			this.on('componentAdd', (l, o) => log.info(`Added component ${o.name}`, '2b504e9c2c404995bd5ebd8fbd9ec697'));
			this.on('componentRemove', (l, o) => log.info(`Removed component ${o.name}`, '1dc5db6582fd4d778c6364ae547c93a6'));
		}
	}

	_logFactory (opts) {
		const send = (level, message, msgid) => {
			const obj = {level};
			if (opts) {
				obj.componentId = opts.id;
				obj.componentName = opts.name;
			}
			if (message instanceof Error) {
				obj.message = message.message;
				obj.stack = message.stack;
			} else {
				obj.message = message;
			}
			if (msgid) {
				obj.message_id = msgid;
			}
			this.ipc.send(`multicast.log.${this.id}.${level}`, 'log', obj);
		};
		const error = (msg, msgid) => send('error', msg, msgid);
		const warn = (msg, msgid) => send('warn', msg, msgid);
		const info = (msg, msgid) => send('info', msg, msgid);
		return {error, warn, info};
	}

	async run (lib, opts) {
		// Make pre-checks
		normalize(opts);
		if (lib.check) await lib.check(opts);

		// Abort if no bus is attached (i.e. dry run)
		if (!this.bus) return this;

		// Create new logger
		const log = this._logFactory(opts);

		// Create inputs and outputs
		const input = {
			length: opts.input.length,
			entries: () => Array.from(input)
		};
		opts.input.forEach((i, n) => {
			i = new Input(i, this.bus, log);
			i.index = n;
			input[n] = i;
			if (i.name) input[i.name] = i;
		});
		const output = {
			length: opts.output.length,
			entries: () => Array.from(output)
		};
		opts.output.forEach((o, n) => {
			o = new Output(o, this.bus, log);
			o.index = n;
			output[n] = o;
			if (o.name) output[o.name] = o;
		});

		// Run factory
		const destroy = await lib.factory(opts, input, output, log, this);
		this.components.push({lib, opts, input, output, destroy});
		this.emit('componentAdd', lib, opts);

		return this;
	}

	async runDir (dir) {
		const files = await readdir(dir);
		const modules = files
			.filter((f) => f.toLowerCase().substr(-3) === '.js')
			.map((f) => require(path.join(dir, f)));

		for (let m of modules) {
			if (typeof m === 'function') m = await m(this);
			if (m instanceof Array) {
				if (m[0] instanceof Array) {
					for (let i of m) await this.run(i[0], i[1]);
				} else {
					await this.run(m[0], m[1]);
				}
			}
		}

		return this;
	}

	async shutdown () {
		const jobs = [];
		this.components.forEach((c) => {
			c.input.entries().forEach((i) => jobs.push(i._destroy()));
			c.output.entries().forEach((o) => jobs.push(o._destroy()));
			if (typeof c.destroy === 'function') jobs.push(c.destroy());
			this.emit('componentRemove', c.lib, c.opts);
		});
		// Remove components
		await Promise.all(jobs);
		if (this.bus) await this.bus.hood.leave();
	}
}

module.exports = async (opts) => {
	// Some defaults
	if (opts === undefined) opts = {};
	if (opts.discovery === undefined) opts.discovery = require('tubemail-mdns');
	if (opts.ca === undefined) opts.ca = await readFile(path.join(process.cwd(), 'ca.crt.pem'));
	if (opts.cert === undefined) opts.cert = await readFile(path.join(process.cwd(), os.hostname(), 'crt.pem'));
	if (opts.key === undefined) opts.key = await readFile(path.join(process.cwd(), os.hostname(), 'key.pem'));
	if (opts.autoRunDir === undefined) opts.autoRunDir = path.join(process.cwd(), os.hostname());

	// Kick-off partybus
	const bus = opts.dryRun ? null : await partybus(opts);

	// Set default log streams
	if (bus) {
		if (opts.logStreams === undefined) opts.logStreams = 'local';
		if (typeof opts.logStreams === 'string') {
			if (opts.logStreams === 'global') {
				opts.logStreams = [
					{level: 'error', addr: `multicast.log.+.error`, stream: process.stdout},
					{level: 'warn', addr: `multicast.log.+.warn`, stream: process.stdout},
					{level: 'info', addr: `multicast.log.+.info`, stream: process.stdout}
				];
			} else if (opts.logStreams === 'none') {
				opts.logStreams = [];
			} else {
				opts.logStreams = [
					{level: 'error', addr: `multicast.log.${bus.hood.id}.error`, stream: process.stdout},
					{level: 'warn', addr: `multicast.log.${bus.hood.id}.warn`, stream: process.stdout},
					{level: 'info', addr: `multicast.log.${bus.hood.id}.info`, stream: process.stdout}
				];
			}
		}
	}

	// Create new instance of FTRM
	const ftrm = new FTRM(bus, opts);

	// Run dir if specified
	if (opts.autoRunDir) await ftrm.runDir(opts.autoRunDir);

	// Install listener to SIGINT and SIGTERM
	if (!opts.noSignalListeners) {
		const shutdown = () => ftrm.shutdown();
		process.on('SIGINT', shutdown);
		process.on('SIGTERM', shutdown);
	}

	return ftrm;
};
