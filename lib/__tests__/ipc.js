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
	bus.observeListenerCount = jest.fn();
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
		bus._busListeners['$ftrm.' + addr].call({source}, 0, {msgType, seq: 0});
		expect(onMsg.mock.calls[0][0]).toMatchObject({
			msgType,
			nodeName,
			nodeId
		});
	});

	test('do not subscribe to one address twice', () => {
		const bus = busFactory();
		const ipc = new IPC(bus);
		const addr = 'abc';
		ipc.subscribe(addr);
		const n = bus.on.mock.calls.length;
		ipc.subscribe(addr);
		expect(bus.on.mock.calls.length).toBe(n);
	});

	test('ignore messages without msgType', () => {
		const bus = busFactory();
		const ipc = new IPC(bus);
		const addr = 'abc';
		ipc.subscribe(addr);
		bus._busListeners['$ftrm.' + addr].call({}, 0, {seq: 0});
	});

	test('deduplicate messages', () => {
		const bus = busFactory();
		const ipc = new IPC(bus);
		const addr = 'abc';
		const msgType = 'test';
		const onMsg = jest.fn();
		ipc.on(msgType, onMsg);
		ipc.subscribe(addr);
		const source1 = {id: 'abc', info: {subject: {}}};
		const source2 = {id: 'def', info: {subject: {}}};
		bus._busListeners['$ftrm.' + addr].call({source: source1}, 0, {msgType, seq: 0});
		bus._busListeners['$ftrm.' + addr].call({source: source1}, 0, {msgType, seq: 0});
		expect(onMsg.mock.calls.length).toBe(1);
		bus._busListeners['$ftrm.' + addr].call({source: source2}, 0, {msgType, seq: 0});
		expect(onMsg.mock.calls.length).toBe(2);
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
		const ts = 12456789000;
		const date = new Date(ts);
		Date.now = jest.fn(() => ts);
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
			nodeName: bus.hood.info.subject.commonName,
			date
		});
	});

	test('set sequencnumber', () => {
		const bus = busFactory();
		const ipc = new IPC(bus);
		const obj0 = {};
		ipc.send('abc', 'def', obj0);
		expect(obj0.seq).toBe(0);
		const obj1 = {};
		ipc.send('abc', 'def', obj1);
		expect(obj1.seq).toBe(1);
	});
});

describe('observe', () => {
	test('forward changed listener count', () => {
		const bus = busFactory();
		const ipc = new IPC(bus);
		const addr = 'abc';
		const onChange = jest.fn();
		const stop = ipc.observe(addr, onChange);
		expect(stop).toBe(bus.observeListenerCount.mock.results[0].value);
		expect(bus.observeListenerCount.mock.calls[0][0]).toEqual('$ftrm.' + addr);
		bus.observeListenerCount.mock.calls[0][1](1);
		expect(onChange.mock.calls[0][0]).toBe(1);
		expect(onChange.mock.calls[0][1]).toBe(0);
		bus.observeListenerCount.mock.calls[0][1](2);
		expect(onChange.mock.calls[1][0]).toBe(2);
		expect(onChange.mock.calls[1][1]).toBe(1);
	});
});
