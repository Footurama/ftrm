const path = require('path');
const os = require('os');
const StatefulError = require('../stateful-error.js');

jest.useFakeTimers();
afterEach(() => jest.clearAllTimers());

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

jest.mock('../lib/normalize-log.js');
const mockNormalizeLog = require('../lib/normalize-log.js');

jest.mock('../lib/debug.js');
const mockDebugFactory = require('../lib/debug.js');

const nextLoop = () => new Promise((resolve) => setImmediate(resolve));

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

	test(`Emit nodeAdd event`, async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		const onNodeAdd = jest.fn();
		ftrm.on('nodeAdd', onNodeAdd);
		const neigh = {
			id: 'abc',
			info: {subject: {commonName: 'def'}}
		};
		mockPartybus._bus.hood.emit('foundNeigh', neigh);
		expect(onNodeAdd.mock.calls[0][0]).toMatchObject({
			id: neigh.id,
			name: neigh.info.subject.commonName
		});
	});

	test(`Emit nodeRemove event`, async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		const onNodeRemove = jest.fn();
		ftrm.on('nodeRemove', onNodeRemove);
		const neigh = {
			id: 'abc',
			info: {subject: {commonName: 'def'}}
		};
		mockPartybus._bus.hood.emit('lostNeigh', neigh);
		expect(onNodeRemove.mock.calls[0][0]).toMatchObject({
			id: neigh.id,
			name: neigh.info.subject.commonName
		});
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
		const onComponentAdd = jest.fn();
		ftrm.on('componentAdd', onComponentAdd);
		const lib = {factory: jest.fn()};
		const opts = { input: [{name: 'a'}], output: [{name: 'b'}] };
		const ftrm2 = await ftrm.run(lib, opts);
		expect(lib.factory.mock.calls[0][0]).toBe(opts);
		expect(lib.factory.mock.calls[0][1][0]).toBeInstanceOf(mockInput);
		expect(lib.factory.mock.calls[0][1]['a']).toBe(lib.factory.mock.calls[0][1][0]);
		expect(lib.factory.mock.calls[0][2][0]).toBeInstanceOf(mockOutput);
		expect(lib.factory.mock.calls[0][2]['b']).toBe(lib.factory.mock.calls[0][2][0]);
		expect(mockInput.mock.calls[0][0]).toBe(opts.input[0]);
		expect(mockInput.mock.calls[0][1]).toBe(mockPartybus._bus);
		expect(mockOutput.mock.calls[0][0]).toBe(opts.output[0]);
		expect(mockOutput.mock.calls[0][1]).toBe(mockPartybus._bus);
		expect(mockOutput.mock.calls[0][3]).toBe(opts);
		expect(onComponentAdd.mock.calls[0][0]).toBe(lib);
		expect(onComponentAdd.mock.calls[0][1]).toBe(opts);
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
		const onComponentRemove = jest.fn();
		ftrm.on('componentRemove', onComponentRemove);
		const destroy = jest.fn();
		const lib = {factory: () => destroy};
		const opts = {
			input: [{}],
			output: [{}]
		};
		await ftrm.run(lib, opts);
		await ftrm.shutdown();
		expect(destroy.mock.calls.length).toBe(1);
		expect(mockInput.mock.instances[0]._destroy.mock.calls.length).toBe(1);
		expect(mockOutput.mock.instances[0]._destroy.mock.calls.length).toBe(1);
		expect(onComponentRemove.mock.calls[0][0]).toBe(lib);
		expect(onComponentRemove.mock.calls[0][1]).toBe(opts);
	});

	test(`Forward destroy errors`, async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		const err = new Error('NOPE');
		const lib = {factory: () => () => Promise.reject(err)};
		await ftrm.run(lib, {});
		await ftrm.shutdown();
		const sendCalls = mockIPC.mock.instances[0].send.mock.calls;
		expect(sendCalls[1][0]).toEqual(`multicast.log.${ftrm.id}.error`);
		expect(sendCalls[1][1]).toEqual(`log`);
		expect(sendCalls[1][2]).toMatchObject({
			message: err.message,
			stack: err.stack,
			message_id: `f06370778ad0451d91849e79a141cefe`,
			level: `error`
		});
		expect(mockPartybus._bus.hood.leave.mock.calls.length).toBe(1);
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
	test('Set default logging', async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		expect(mockNormalizeLog.mock.calls[0][0]).toEqual('local-stdout');
		expect(mockNormalizeLog.mock.calls[0][1]).toBe(ftrm.bus.hood.id);
	});

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
		expect(sendCalls[1][0]).toEqual(`multicast.log.${ftrm.id}.${level}`);
		expect(sendCalls[1][1]).toEqual(`log`);
		expect(sendCalls[1][2]).toMatchObject({
			level,
			componentId: opts.id,
			componentName: opts.name,
			message: err.message,
			stack: err.stack,
			type: 'Error'
		});
		const msg = 'ert';
		log(msg);
		expect(sendCalls[2][0]).toEqual(`multicast.log.${ftrm.id}.${level}`);
		expect(sendCalls[2][1]).toEqual(`log`);
		expect(sendCalls[2][2]).toMatchObject({
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

	test('Emit StatefulError', async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		const lib = {factory: jest.fn()};
		await ftrm.run(lib, {
			id: 'abcedf',
			name: 'TestInstance',
			input: [],
			output: []
		});
		const log = lib.factory.mock.calls[0][3].error;
		const msg = 'abc';
		const err = new StatefulError(msg);
		log(err);
		const sendCalls = mockIPC.mock.instances[0].send.mock.calls;
		expect(sendCalls[1][0]).toEqual(`multicast.log.${ftrm.id}.error`);
		expect(sendCalls[1][1]).toEqual(`log`);
		expect(sendCalls[1][2]).toMatchObject({
			type: 'StatefulError',
			message: msg,
			error_id: err.error_id,
			message_type: 'occurrance'
		});
		jest.advanceTimersByTime(StatefulError.RETRANSMIT_INTERVAL);
		expect(sendCalls[2][2]).toMatchObject({
			type: 'StatefulError',
			message: msg,
			error_id: err.error_id,
			message_type: 'retransmission'
		});
		jest.advanceTimersByTime(StatefulError.RETRANSMIT_INTERVAL);
		expect(sendCalls[3][2]).toMatchObject({
			type: 'StatefulError',
			message: msg,
			error_id: err.error_id,
			message_type: 'retransmission'
		});
		err.resolve();
		await nextLoop();
		expect(sendCalls[4][2]).toMatchObject({
			type: 'StatefulError',
			message: msg,
			error_id: err.error_id,
			message_type: 'resolved'
		});
		jest.advanceTimersByTime(StatefulError.RETRANSMIT_INTERVAL);
		expect(sendCalls.length).toBe(5);
	});

	test('Destroy ongoing StatefulError on exit', async () => {
		const ftrm = await Ftrm({noSignalListeners: true});
		const lib = {factory: jest.fn()};
		await ftrm.run(lib, {
			id: 'abcedf',
			name: 'TestInstance',
			input: [],
			output: []
		});
		const log = lib.factory.mock.calls[0][3].error;
		const err = new StatefulError();
		log(err);
		const sendCalls = mockIPC.mock.instances[0].send.mock.calls;
		await ftrm.shutdown();
		const curLength = sendCalls.length;
		jest.advanceTimersByTime(StatefulError.RETRANSMIT_INTERVAL);
		expect(sendCalls.length).toBe(curLength);
	});

	test('register log callback', async () => {
		const fn = jest.fn();
		const l = {level: 'error', addr: 'abc', fn};
		mockNormalizeLog.mockReturnValue([l]);
		await Ftrm({noSignalListeners: true});
		expect(mockIPC.mock.instances[0].subscribe.mock.calls[0][0]).toBe(l.addr);
		const listener = mockIPC.mock.instances[0]._listener['log'];
		const level = l.level;
		const nodeName = 'abc';
		const componentName = 'def';
		const date = new Date();
		const message = 'qwertz';
		listener({level, nodeName, componentName, date, message});
		expect(fn.mock.calls[0][0]).toMatchObject({nodeName, componentName, date, level, message});
		listener({level: 'nope', nodeName, componentName, date, message});
		expect(fn.mock.calls.length).toBe(1);
	});

	test('wire events with log', async () => {
		const ftrm = await Ftrm({noSignalListeners: true, log: 'none'});
		const name = 'abc';
		const id = 'def';
		const sendCalls = mockIPC.mock.instances[0].send.mock.calls;
		ftrm.emit('nodeAdd', {name, id});
		expect(sendCalls[0][0]).toEqual(`multicast.log.${ftrm.id}.info`);
		expect(sendCalls[0][1]).toEqual(`log`);
		expect(sendCalls[0][2]).toMatchObject({
			message: `Added node ${name}`,
			message_id: `cd394adc98d44675a6ffa1349f152331`,
			level: `info`
		});
		ftrm.emit('nodeRemove', {name, id});
		expect(sendCalls[1][0]).toEqual(`multicast.log.${ftrm.id}.info`);
		expect(sendCalls[1][1]).toEqual(`log`);
		expect(sendCalls[1][2]).toMatchObject({
			message: `Removed node ${name}`,
			message_id: `2ef0df5540b04627bd3b2cc3fc3fb169`,
			level: `info`
		});
		ftrm.emit('componentAdd', {}, {name, id});
		expect(sendCalls[2][0]).toEqual(`multicast.log.${ftrm.id}.info`);
		expect(sendCalls[2][1]).toEqual(`log`);
		expect(sendCalls[2][2]).toMatchObject({
			message: `Added component ${name}`,
			message_id: `2b504e9c2c404995bd5ebd8fbd9ec697`,
			level: `info`
		});
		ftrm.emit('componentRemove', {}, {name, id});
		expect(sendCalls[3][0]).toEqual(`multicast.log.${ftrm.id}.info`);
		expect(sendCalls[3][1]).toEqual(`log`);
		expect(sendCalls[3][2]).toMatchObject({
			message: `Removed component ${name}`,
			message_id: `1dc5db6582fd4d778c6364ae547c93a6`,
			level: `info`
		});
	});
});

describe('Debugging', () => {
	test('set default remote debug access', async () => {
		const opts = {noSignalListeners: true, log: 'none'};
		await Ftrm(opts);
		expect(opts.remoteDebug).toBe(true);
	});

	test('install debug handler', async () => {
		const ftrm = await Ftrm({noSignalListeners: true, log: 'none', remoteDebug: true});
		expect(mockDebugFactory.mock.calls[0][0]).toBe(ftrm);
	});

	test('do not install debug handler', async () => {
		await Ftrm({noSignalListeners: true, log: 'none', remoteDebug: false});
		expect(mockDebugFactory.mock.calls.length).toBe(0);
	});
});
