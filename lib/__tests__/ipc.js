/* eslint no-new: "off" */

const IPC = require('../ipc.js');

const ftrmFactory = () => {
	const ftrm = {
		id: 'abc',
		bus: {},
		_busListeners: {}
	};
	ftrm.bus.on = jest.fn((event, cb) => { ftrm._busListeners[event] = cb; });
	ftrm.bus.emit = jest.fn(() => Promise.resolve());
	return ftrm;
};

describe('constructor', () => {
	test('register default addresses', () => {
		const ftrm = ftrmFactory();
		new IPC(ftrm);
		expect(ftrm._busListeners[`$ftrm.broadcast`]).toBeDefined();
		expect(ftrm._busListeners[`$ftrm.unicast.${ftrm.id}`]).toBeDefined();
	});
});

describe('subscribe', () => {
	test('emit messages of subscribed addresses', () => {
		const ftrm = ftrmFactory();
		const ipc = new IPC(ftrm);
		const addr = 'abc';
		const msgType = 'test';
		const onMsg = jest.fn();
		ipc.on(msgType, onMsg);
		ipc.subscribe(addr);
		const nodeName = 'node';
		const nodeId = 'asdf';
		const source = {
			id: nodeId,
			info: {subject: {commonName: nodeName}}
		};
		ftrm._busListeners['$ftrm.' + addr].call({source}, 0, {msgType});
		expect(onMsg.mock.calls[0][0]).toMatchObject({
			msgType,
			nodeName,
			nodeId
		});
	});

	test('ignore messages without msgType', () => {
		const ftrm = ftrmFactory();
		const ipc = new IPC(ftrm);
		const addr = 'abc';
		ipc.subscribe(addr);
		ftrm._busListeners['$ftrm.' + addr].call({}, 0, {});
	});
});

describe('send', () => {
	test('require address', () => {
		const ftrm = ftrmFactory();
		const ipc = new IPC(ftrm);
		expect(() => ipc.send()).toThrowError('address is required');
	});

	test('require msgType', () => {
		const ftrm = ftrmFactory();
		const ipc = new IPC(ftrm);
		expect(() => ipc.send('adr')).toThrowError('msgType is required');
	});

	test('emit message', () => {
		const ftrm = ftrmFactory();
		const ipc = new IPC(ftrm);
		Date.now = jest.fn(() => 124567890);
		const addr = 'abc';
		const msgType = 'xyz';
		const obj = {test: true};
		expect(ipc.send(addr, msgType, obj)).toBe(ftrm.bus.emit.mock.results[0].value);
		expect(ftrm.bus.emit.mock.calls[0][0]).toEqual('$ftrm.' + addr);
		expect(ftrm.bus.emit.mock.calls[0][1]).toBe(Date.now.mock.results[0].value);
		expect(ftrm.bus.emit.mock.calls[0][2]).toMatchObject({
			...obj,
			msgType
		});
	});
});
