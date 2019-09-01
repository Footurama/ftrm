const path = require('path');
const os = require('os');

jest.mock('partybus');
const mockPartybus = require('partybus');

jest.mock('tubemail-mdns');
const mockTubemailMdns = require('tubemail-mdns');

jest.mock('fs');
const mockFs = require('fs');

jest.mock('../lib/normalize-config.js');
const mockNormalize = require('../lib/normalize-config.js');

jest.mock('../lib/input.js');
const mockInput = require('../lib/input.js');

jest.mock('../lib/output.js');
const mockOutput = require('../lib/output.js');

jest.mock('../lib/ipc.js');
const mockIPC = require('../lib/ipc.js');

const Ftrm = require('..');

describe(`Init`, () => {
	test(`Pass through options to partybus`, async () => {
		const opts = {a: true, noSignalListeners: true};
		await Ftrm(opts);
		expect(mockPartybus.mock.calls[0][0]).toMatchObject(opts);
	});

	test(`Don't init partybus in dryRun mode`, async () => {
		await Ftrm({dryRun: true, noSignalListeners: true});
		expect(mockPartybus.mock.calls.length).toBe(0);
	});

	test(`Use mdns by default`, async () => {
		await Ftrm({noSignalListeners: true});
		expect(mockPartybus.mock.calls[0][0]).toMatchObject({
			discovery: mockTubemailMdns._obj
		});
	});

	test(`Load default CA certificate`, async () => {
		await Ftrm({
			cert: Buffer.alloc(0),
			key: Buffer.alloc(0),
			noSignalListeners: true
		});
		expect(mockFs.readFile.mock.calls[0][0]).toEqual(
			path.join(process.cwd(), 'ca.crt.pem')
		);
	});

	test(`Load default client certificate`, async () => {
		await Ftrm({
			ca: Buffer.alloc(0),
			key: Buffer.alloc(0),
			noSignalListeners: true
		});
		expect(mockFs.readFile.mock.calls[0][0]).toEqual(
			path.join(process.cwd(), os.hostname(), 'crt.pem')
		);
	});

	test(`Load default client key`, async () => {
		await Ftrm({
			ca: Buffer.alloc(0),
			cert: Buffer.alloc(0),
			noSignalListeners: true
		});
		expect(mockFs.readFile.mock.calls[0][0]).toEqual(
			path.join(process.cwd(), os.hostname(), 'key.pem')
		);
	});

	test(`Set default runDir`, async () => {
		const opts = {noSignalListeners: true};
		await Ftrm(opts);
		expect(opts.autoRunDir).toEqual(path.join(process.cwd(), os.hostname()));
	});

	test(`Pass options and bus to class`, async () => {
		const testOpt = {};
		const ftrm = await Ftrm({
			autoRunDir: null,
			testOpt,
			noSignalListeners: true
		});
		expect(ftrm.testOpt).toBe(testOpt);
		expect(ftrm.bus).toBe(mockPartybus._bus);
	});

	test(`Call runDir with specified option`, async () => {
		const opts = {autoRunDir: '/abc', noSignalListeners: true};
		await Ftrm(opts);
		expect(mockFs.readdir.mock.calls[0][0]).toEqual(opts.autoRunDir);
	});

	test(`Don't call runDir if option is null`, async () => {
		const opts = {autoRunDir: null, noSignalListeners: true};
		await Ftrm(opts);
		expect(mockFs.readdir.mock.calls.length).toBe(0);
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
});

describe(`FTRM startup`, () => {
	test(`Store partybus id and name in main object`, async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		expect(ftrm.name).toBe(mockPartybus._bus.hood.info.subject.commonName);
		expect(ftrm.id).toBe(mockPartybus._bus.hood.id);
	});

	test(`Call lib's check function`, async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		const check = jest.fn();
		const opts = {};
		await ftrm.run({check, factory: () => {}}, opts);
		expect(mockNormalize.mock.calls[0][0]).toBe(opts);
		expect(check.mock.calls[0][0]).toBe(opts);
	});

	test(`Call lib's factory function`, async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		const factory = jest.fn();
		const opts = { input: [{name: 'a'}], output: [{name: 'b'}] };
		const ftrm2 = await ftrm.run({factory}, opts);
		expect(factory.mock.calls[0][0]).toBe(opts);
		expect(factory.mock.calls[0][1][0]).toBeInstanceOf(mockInput);
		expect(factory.mock.calls[0][1]['a']).toBe(factory.mock.calls[0][1]['a']);
		expect(factory.mock.calls[0][2][0]).toBeInstanceOf(mockOutput);
		expect(factory.mock.calls[0][2]['b']).toBe(factory.mock.calls[0][2][0]);
		expect(mockInput.mock.calls[0][0]).toBe(opts.input[0]);
		expect(mockInput.mock.calls[0][1]).toBe(mockPartybus._bus);
		expect(mockOutput.mock.calls[0][0]).toBe(opts.output[0]);
		expect(mockOutput.mock.calls[0][1]).toBe(mockPartybus._bus);
		expect(ftrm2).toBe(ftrm);
	});

	test(`Don't run lib's factory in dryRun mode`, async () => {
		const ftrm = await Ftrm({dryRun: true, noSignalListeners: true});
		const check = jest.fn();
		const factory = jest.fn();
		await ftrm.run({factory, check}, {});
		expect(check.mock.calls.length).toBe(1);
		expect(factory.mock.calls.length).toBe(0);
	});

	test(`Create iterator for inputs`, async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		const factory = jest.fn();
		const opts = { input: [{name: 'a'}], output: [{name: 'b'}] };
		await ftrm.run({factory}, opts);
		const entries = factory.mock.calls[0][1].entries();
		expect(entries).toBeInstanceOf(Array);
		expect(entries[0]).toBe(factory.mock.calls[0][1]['a']);
	});

	test(`Create iterator for outputs`, async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		const factory = jest.fn();
		const opts = { input: [{name: 'a'}], output: [{name: 'b'}] };
		await ftrm.run({factory}, opts);
		const entries = factory.mock.calls[0][2].entries();
		expect(entries).toBeInstanceOf(Array);
		expect(entries[0]).toBe(factory.mock.calls[0][2]['b']);
	});

	test(`Set index for input and output`, async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		const factory = jest.fn();
		const opts = { input: [{name: 'a'}], output: [{name: 'b'}] };
		await ftrm.run({factory}, opts);
		expect(factory.mock.calls[0][1][0].index).toBe(0);
		expect(factory.mock.calls[0][2][0].index).toBe(0);
	});

	test(`Run scripts in specified dir`, async () => {
		mockFs.readdir.mockImplementationOnce((dir, cb) => cb(null, ['a.js', 'b.JS', 'c.js', 'c.json']));
		const ftrm = await Ftrm({autoRunDir: null, noSignalListeners: true});
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
		expect(mockFs.readdir.mock.calls[0][0]).toEqual('/abc');
		expect(a.mock.calls[0][0]).toBe(ftrm);
		expect(b.mock.calls[0][0]).toBe(ftrm);
		expect(aFactory1.mock.calls.length).toBe(1);
		expect(bFactory1.mock.calls.length).toBe(1);
		expect(bFactory2.mock.calls.length).toBe(1);
		expect(cFactory1.mock.calls.length).toBe(1);
	});
});

describe(`FTRM shutdown`, () => {
	test(`Run all destroy methods`, async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		const destroy = jest.fn();
		await ftrm.run({
			factory: () => destroy
		}, {
			input: [{}],
			output: [{}]
		});
		await ftrm.shutdown();
		expect(destroy.mock.calls.length).toBe(1);
		expect(mockInput.mock.instances[0]._destroy.mock.calls.length).toBe(1);
		expect(mockOutput.mock.instances[0]._destroy.mock.calls.length).toBe(1);
	});

	test(`Leave tubemail hood on shutdown`, async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		await ftrm.shutdown();
		expect(mockPartybus._bus.hood.leave.mock.calls.length).toBe(1);
	});

	test(`Don't crash if FTRM is shut down in dry run mode`, async () => {
		const ftrm = await Ftrm({dryRun: true, noSignalListeners: true});
		await ftrm.shutdown();
	});
});

describe(`Logging`, () => {
	[
		'info',
		'warn',
		'error'
	].forEach((level) => test(`Create logger for level ${level}`, async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		const lib = {factory: jest.fn()};
		const opts = {
			id: 'abcedf',
			name: 'TestInstance',
			input: [{name: 'a'}],
			output: [{name: 'b'}]
		};
		await ftrm.run(lib, opts);
		const logger = lib.factory.mock.calls[0][3];
		const log = logger[level];
		const err = new Error('abc');
		log(err);
		const sendCalls = mockIPC.mock.instances[0].send.mock.calls;
		expect(sendCalls[0][0]).toEqual(`multicast.log.${ftrm.id}.${level}`);
		expect(sendCalls[0][1]).toEqual(`log`);
		expect(sendCalls[0][2]).toMatchObject({
			level,
			componentId: opts.id,
			componentName: opts.name,
			message: err.message,
			stack: err.stack
		});
		const msg = 'ert';
		log(msg);
		expect(sendCalls[1][0]).toEqual(`multicast.log.${ftrm.id}.${level}`);
		expect(sendCalls[1][1]).toEqual(`log`);
		expect(sendCalls[1][2]).toMatchObject({
			level,
			componentId: opts.id,
			componentName: opts.name,
			message: msg
		});
		const i = lib.factory.mock.calls[0][1][0];
		expect(mockInput.mock.instances[0]).toBe(i);
		expect(mockInput.mock.calls[0][2]).toBe(logger);
		const o = lib.factory.mock.calls[0][2][0];
		expect(mockOutput.mock.instances[0]).toBe(o);
		expect(mockOutput.mock.calls[0][2]).toBe(logger);
	}));
});
