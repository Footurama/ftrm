const partybus = require('partybus');
const normalize = require('./lib/normalize-config.js');
const Input = require('./lib/input.js');
const Output = require('./lib/output.js');
const IPC = require('./lib/ipc.js');
const path = require('path');
const os = require('os');
const fs = require('fs');
const events = require('events');

const readdir = (dir) => new Promise((resolve, reject) => fs.readdir(dir, (err, files) => {
	if (err) reject(err);
	else resolve(files);
}));
const readFile = (file) => new Promise((resolve, reject) => fs.readFile(file, (err, data) => {
	if (err) reject(err);
	else resolve(data);
}));

class FTRM extends events.EventEmitter {
	constructor (bus, opts) {
		super();
		Object.assign(this, opts);
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
		this._destroy = [];
	}

	_logFactory (opts) {
		const send = (level, message) => {
			const obj = {
				level,
				componentId: opts.id,
				componentName: opts.name
			};
			if (message instanceof Error) {
				obj.message = message.message;
				obj.stack = message.stack;
			} else {
				obj.message = message;
			}
			this.ipc.send(`multicast.log.${this.id}.${level}`, 'log', obj);
		};
		const error = (msg) => send('error', msg);
		const warn = (msg) => send('warn', msg);
		const info = (msg) => send('info', msg);
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
			this._destroy.push(() => i._destroy());
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
			this._destroy.push(() => o._destroy());
		});

		// Run factory
		const destroy = await lib.factory(opts, input, output, log, this);
		if (typeof destroy === 'function') this._destroy.push(destroy);

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
		await Promise.all(this._destroy.map((d) => d()));
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
