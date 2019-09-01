/* eslint no-new: "off" */

const IPC = require('../ipc.js');

const busFactory = () => {
	const bus = {
		hood: {
			id: 'abc',
			info: {subject: {commonName: 'jo'}}
		},
		_busListeners: {}
	};
	bus.on = jest.fn((event, cb) => { bus._busListeners[event] = cb; });
	bus.emit = jest.fn(() => Promise.resolve());
	return bus;
};

describe('constructor', () => {
	test('register default addresses', () => {
		const bus = busFactory();
		new IPC(bus);
		expect(bus._busListeners[`$ftrm.broadcast`]).toBeDefined();
		expect(bus._busListeners[`$ftrm.unicast.${bus.hood.id}`]).toBeDefined();
	});
});

describe('subscribe', () => {
	test('emit messages of subscribed addresses', () => {
		const bus = busFactory();
		const ipc = new IPC(bus);
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
		bus._busListeners['$ftrm.' + addr].call({source}, 0, {msgType});
		expect(onMsg.mock.calls[0][0]).toMatchObject({
			msgType,
			nodeName,
			nodeId
		});
	});

	test('ignore messages without msgType', () => {
		const bus = busFactory();
		const ipc = new IPC(bus);
		const addr = 'abc';
		ipc.subscribe(addr);
		bus._busListeners['$ftrm.' + addr].call({}, 0, {});
	});
});

describe('send', () => {
	test('require address', () => {
		const bus = busFactory();
		const ipc = new IPC(bus);
		expect(() => ipc.send()).toThrowError('address is required');
	});

	test('require msgType', () => {
		const bus = busFactory();
		const ipc = new IPC(bus);
		expect(() => ipc.send('adr')).toThrowError('msgType is required');
	});

	test('emit message', () => {
		const bus = busFactory();
		const ipc = new IPC(bus);
		Date.now = jest.fn(() => 124567890);
		const addr = 'abc';
		const msgType = 'xyz';
		const obj = {test: true};
		expect(ipc.send(addr, msgType, obj)).toBe(bus.emit.mock.results[0].value);
		expect(bus.emit.mock.calls[0][0]).toEqual('$ftrm.' + addr);
		expect(bus.emit.mock.calls[0][1]).toBe(Date.now.mock.results[0].value);
		expect(bus.emit.mock.calls[0][2]).toMatchObject({
			...obj,
			msgType,
			nodeId: bus.hood.id,
			nodeName: bus.hood.info.subject.commonName
		});
	});
});
