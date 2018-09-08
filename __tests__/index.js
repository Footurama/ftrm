const path = require('path');
const os = require('os');

jest.mock('partybus');
const partybus = require('partybus');

jest.mock('tubemail-mdns');
const tubemailMDNS = require('tubemail-mdns');

jest.mock('fs');
const fs = require('fs');

jest.mock('../lib/normalize-config.js');
const normalize = require('../lib/normalize-config.js');

jest.mock('../lib/input.js');
const Input = require('../lib/input.js');

jest.mock('../lib/output.js');
const Output = require('../lib/output.js');

const Ftrm = require('..');

test(`Pass through options to partybus`, async () => {
	const opts = { a: true };
	await Ftrm(opts);
	expect(partybus.mock.calls[0][0]).toMatchObject(opts);
});

test(`Use mdns by default`, async () => {
	await Ftrm();
	expect(partybus.mock.calls[0][0]).toMatchObject({
		discovery: tubemailMDNS._obj
	});
});

test(`Load default CA certificate`, async () => {
	await Ftrm({
		cert: Buffer.alloc(0),
		key: Buffer.alloc(0)
	});
	expect(fs.readFile.mock.calls[0][0]).toEqual(
		path.join(process.cwd(), 'ca.pem')
	);
});

test(`Load default client certificate`, async () => {
	await Ftrm({
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0)
	});
	expect(fs.readFile.mock.calls[0][0]).toEqual(
		path.join(process.cwd(), os.hostname(), 'crt.pem')
	);
});

test(`Load default client key`, async () => {
	await Ftrm({
		ca: Buffer.alloc(0),
		cert: Buffer.alloc(0)
	});
	expect(fs.readFile.mock.calls[0][0]).toEqual(
		path.join(process.cwd(), os.hostname(), 'key.pem')
	);
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

test(`Run scripts in specified dir`, async () => {
	fs.readdir.mockImplementationOnce((dir, cb) => cb(null, ['a.js', 'b.JS', 'c.json']));
	const ftrm = await Ftrm({ runDir: null });
	const a = [{ factory: jest.fn() }, {}];
	jest.doMock('/abc/a.js', () => a, {virtual: true});
	const b = [{ factory: jest.fn() }, {}];
	jest.doMock('/abc/b.JS', () => b, {virtual: true});
	await ftrm.runDir('/abc');
	expect(fs.readdir.mock.calls[0][0]).toEqual('/abc');
	expect(a[0].factory.mock.calls.length).toBe(1);
	expect(b[0].factory.mock.calls.length).toBe(1);
});

test(`Run all destroy methods`, async () => {
	const ftrm = await Ftrm({});
	const destroy = jest.fn();
	await ftrm.run({ factory: () => destroy }, {});
	await ftrm.shutdown();
	expect(destroy.mock.calls.length).toBe(1);
});

test(`Set default runDir`, async () => {
	const opts = {};
	await Ftrm(opts);
	expect(opts.runDir).toEqual(path.join(process.cwd(), os.hostname()));
});

test(`Call runDir with specified option`, async () => {
	const opts = { runDir: '/abc' };
	await Ftrm(opts);
	expect(fs.readdir.mock.calls[0][0]).toEqual(opts.runDir);
});

test(`Don't call runDir if option is null`, async () => {
	const opts = { runDir: null };
	await Ftrm(opts);
	expect(fs.readdir.mock.calls.length).toBe(0);
});
