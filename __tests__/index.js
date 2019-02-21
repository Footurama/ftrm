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

test(`Don't init partybus in dryRun mode`, async () => {
	await Ftrm({dryRun: true});
	expect(partybus.mock.calls.length).toBe(0);
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
		path.join(process.cwd(), 'ca.crt.pem')
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

test(`Inherit options to instance`, async () => {
	const testOpt = {};
	const ftrm = await Ftrm({
		autoRunDir: null,
		testOpt
	});
	expect(ftrm.testOpt).toBe(testOpt);
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
	const ftrm2 = await ftrm.run({factory}, opts);
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
	expect(ftrm2).toBe(ftrm);
});

test(`Don't run lib's factory in dryRun mode`, async () => {
	const ftrm = await Ftrm({dryRun: true});
	const check = jest.fn();
	const factory = jest.fn();
	await ftrm.run({factory, check}, {});
	expect(check.mock.calls.length).toBe(1);
	expect(factory.mock.calls.length).toBe(0);
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
	fs.readdir.mockImplementationOnce((dir, cb) => cb(null, ['a.js', 'b.JS', 'c.js', 'c.json']));
	const ftrm = await Ftrm({ autoRunDir: null });
	const aFactory1 = jest.fn();
	const a = jest.fn(() => [{ factory: aFactory1 }, {}]);
	jest.doMock('/abc/a.js', () => a, {virtual: true});
	const bFactory1 = jest.fn();
	const bFactory2 = jest.fn();
	const b = jest.fn(() => Promise.resolve([
		[{ factory: bFactory1 }, {}],
		[{ factory: bFactory2 }, {}]
	]));
	jest.doMock('/abc/b.JS', () => b, {virtual: true});
	const cFactory1 = jest.fn();
	const c = [{ factory: cFactory1 }, {}];
	jest.doMock('/abc/c.js', () => c, {virtual: true});
	const ftrm2 = await ftrm.runDir('/abc');
	expect(ftrm2).toBe(ftrm);
	expect(fs.readdir.mock.calls[0][0]).toEqual('/abc');
	expect(a.mock.calls[0][0]).toBe(ftrm);
	expect(b.mock.calls[0][0]).toBe(ftrm);
	expect(aFactory1.mock.calls.length).toBe(1);
	expect(bFactory1.mock.calls.length).toBe(1);
	expect(bFactory2.mock.calls.length).toBe(1);
	expect(cFactory1.mock.calls.length).toBe(1);
});

test(`Run all destroy methods`, async () => {
	const ftrm = await Ftrm({});
	const destroy = jest.fn();
	await ftrm.run({ factory: () => destroy }, {});
	await ftrm.shutdown();
	expect(destroy.mock.calls.length).toBe(1);
});

test(`Leave tubemail realm on shutdown`, async () => {
	const ftrm = await Ftrm({});
	await ftrm.shutdown();
	expect(partybus._bus.realm.leave.mock.calls.length).toBe(1);
});

test(`Set default runDir`, async () => {
	const opts = {};
	await Ftrm(opts);
	expect(opts.autoRunDir).toEqual(path.join(process.cwd(), os.hostname()));
});

test(`Call runDir with specified option`, async () => {
	const opts = { autoRunDir: '/abc' };
	await Ftrm(opts);
	expect(fs.readdir.mock.calls[0][0]).toEqual(opts.autoRunDir);
});

test(`Don't call runDir if option is null`, async () => {
	const opts = { autoRunDir: null };
	await Ftrm(opts);
	expect(fs.readdir.mock.calls.length).toBe(0);
});

test(`Listen to SIGTERM and SIGINT`, async () => {
	const sigterm = process.listeners('SIGTERM').length;
	const sigint = process.listeners('SIGINT').length;
	await Ftrm();
	expect(process.listeners('SIGTERM').length - sigterm).toBe(1);
	expect(process.listeners('SIGINT').length - sigint).toBe(1);
});

test(`Suppress listing to SIGTERM and SIGINT`, async () => {
	const sigterm = process.listeners('SIGTERM').length;
	const sigint = process.listeners('SIGINT').length;
	await Ftrm({
		noSignalListeners: true
	});
	expect(process.listeners('SIGTERM').length - sigterm).toBe(0);
	expect(process.listeners('SIGINT').length - sigint).toBe(0);
});
