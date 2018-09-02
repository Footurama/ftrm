const partybus = require('partybus');
const normalize = require('./lib/normalize-config.js');
const Input = require('./lib/input.js');
const Output = require('./lib/output.js');

class FTRM {
	constructor (bus) {
		this._bus = bus;
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
		await lib.factory(opts, input, output, this._bus);
	}
}

module.exports = async (opts) => {
	// Kick-off partybus
	const pbOpts = Object.assign({}, opts);
	if (pbOpts.discovery === undefined) pbOpts.discovery = require('tubemail-mdns')();
	const bus = await partybus(pbOpts);

	// Create new instance of FTRM
	const ftrm = new FTRM(bus);

	return ftrm;
};
