const partybus = require('partybus');
const normalize = require('./lib/normalize-config.js');
const Input = require('./lib/input.js');
const Output = require('./lib/output.js');
const path = require('path');
const os = require('os');
const fs = require('fs');

const readdir = (dir) => new Promise((resolve, reject) => fs.readdir(dir, (err, files) => {
	if (err) reject(err);
	else resolve(files);
}));
const readFile = (file) => new Promise((resolve, reject) => fs.readFile(file, (err, data) => {
	if (err) reject(err);
	else resolve(data);
}));

class FTRM {
	constructor (bus) {
		this._bus = bus;
		this._destroy = [];
	}

	async run (lib, opts) {
		// Make pre-checks
		normalize(opts);
		if (lib.check) await lib.check(opts);

		// Create inputs and outputs
		const input = {
			length: opts.input.length,
			entries: () => Array.from(input)
		};
		opts.input.forEach((i, n) => {
			i = new Input(i, this._bus);
			i.index = n;
			input[n] = i;
			if (i.name) input[i.name] = i;
		});
		const output = {
			length: opts.output.length,
			entries: () => Array.from(output)
		};
		opts.output.forEach((o, n) => {
			o = new Output(o, this._bus);
			o.index = n;
			output[n] = o;
			if (o.name) output[o.name] = o;
		});

		// Run factory
		const destroy = await lib.factory(opts, input, output, this._bus);
		if (typeof destroy === 'function') this._destroy.push(destroy);
	}

	async runDir (dir) {
		const files = await readdir(dir);
		const instances = files
			.filter((f) => f.toLowerCase().substr(-3) === '.js')
			.map((f) => require(path.join(dir, f)))
			.map((i) => this.run(i[0], i[1]));
		await Promise.all(instances);
	}

	async shutdown () {
		await Promise.all(this._destroy.map((d) => d()));
	}
}

module.exports = async (opts) => {
	// Some defaults
	if (opts === undefined) opts = {};
	if (opts.discovery === undefined) opts.discovery = require('tubemail-mdns')();
	if (opts.ca === undefined) opts.ca = await readFile(path.join(process.cwd(), 'ca.pem'));
	if (opts.cert === undefined) opts.cert = await readFile(path.join(process.cwd(), os.hostname(), 'crt.pem'));
	if (opts.key === undefined) opts.key = await readFile(path.join(process.cwd(), os.hostname(), 'key.pem'));
	if (opts.runDir === undefined) opts.runDir = path.join(process.cwd(), os.hostname());

	// Kick-off partybus
	const bus = await partybus(opts);

	// Create new instance of FTRM
	const ftrm = new FTRM(bus);

	// Run dir if specified
	if (opts.runDir) await ftrm.runDir(opts.runDir);

	return ftrm;
};
