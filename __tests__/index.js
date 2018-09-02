jest.mock('partybus');
const partybus = require('partybus');

jest.mock('tubemail-mdns');
const tubemailMDNS = require('tubemail-mdns');

jest.mock('../lib/normalize-config.js');
const normalize = require('../lib/normalize-config.js');

jest.mock('../lib/input.js');
const Input = require('../lib/input.js');

jest.mock('../lib/output.js');
const Output = require('../lib/output.js');

const Ftrm = require('..');

test(`Pass through options to partybus`, () => {
	const opts = { a: true };
	Ftrm(opts);
	expect(partybus.mock.calls[0][0]).toMatchObject(opts);
});

test(`Use mdns by default`, () => {
	Ftrm({});
	expect(partybus.mock.calls[0][0]).toMatchObject({
		discovery: tubemailMDNS._obj
	});
});

test(`Call lib's check function`, async () => {
	const ftrm = await Ftrm({});
	const check = jest.fn();
	const opts = {};
	await ftrm.run({check, factory: () => {}}, opts);
	expect(normalize.mock.calls[0][0]).toBe(opts);
	expect(check.mock.calls[0][0]).toBe(opts);
});

test(`Call lib's factory function`, async () => {
	const ftrm = await Ftrm({});
	const factory = jest.fn();
	const opts = { input: [{name: 'a'}], output: [{name: 'b'}] };
	await ftrm.run({factory}, opts);
	expect(factory.mock.calls[0][0]).toBe(opts);
	expect(factory.mock.calls[0][1][0]).toBeInstanceOf(Input);
	expect(factory.mock.calls[0][1]['a']).toBe(factory.mock.calls[0][1]['a']);
	expect(factory.mock.calls[0][2][0]).toBeInstanceOf(Output);
	expect(factory.mock.calls[0][2]['b']).toBe(factory.mock.calls[0][2][0]);
	expect(factory.mock.calls[0][3]).toBe(partybus._bus);
	expect(Input.mock.calls[0][0]).toBe(opts.input[0]);
	expect(Input.mock.calls[0][1]).toBe(partybus._bus);
	expect(Output.mock.calls[0][0]).toBe(opts.output[0]);
	expect(Output.mock.calls[0][1]).toBe(partybus._bus);
});

test(`Create iterator for inputs`, async () => {
	const ftrm = await Ftrm({});
	const factory = jest.fn();
	const opts = { input: [{name: 'a'}], output: [{name: 'b'}] };
	await ftrm.run({factory}, opts);
	const entries = factory.mock.calls[0][1].entries();
	expect(entries).toBeInstanceOf(Array);
	expect(entries[0]).toBe(factory.mock.calls[0][1]['a']);
});

test(`Create iterator for outputs`, async () => {
	const ftrm = await Ftrm({});
	const factory = jest.fn();
	const opts = { input: [{name: 'a'}], output: [{name: 'b'}] };
	await ftrm.run({factory}, opts);
	const entries = factory.mock.calls[0][2].entries();
	expect(entries).toBeInstanceOf(Array);
	expect(entries[0]).toBe(factory.mock.calls[0][2]['b']);
});

test(`Set index for input and output`, async () => {
	const ftrm = await Ftrm({});
	const factory = jest.fn();
	const opts = { input: [{name: 'a'}], output: [{name: 'b'}] };
	await ftrm.run({factory}, opts);
	expect(factory.mock.calls[0][1][0].index).toBe(0);
	expect(factory.mock.calls[0][2][0].index).toBe(0);
});
