jest.useFakeTimers();
afterEach(() => jest.clearAllTimers());

const StatefulError = require('../../stateful-error.js');

const Input = require('../input.js');

const DUMMY = {source: {info: {subject: {commonName: 'a'}}}};

const busFactory = () => ({
	_listener: {},
	on: jest.fn(function (e, cb) {
		this._listener[e] = cb;
	})
});

test(`assign opts to local object`, () => {
	const opts = {
		a: true,
		b: 'test'
	};
	const i = new Input(opts);
	expect(i).toMatchObject(opts);
});

test(`if pipe is defined listen for events on the bus`, () => {
	const bus = busFactory();
	const opts = {pipe: 'pipe'};
	/* eslint-disable no-new */
	new Input(opts, bus);
	expect(bus.on.mock.calls[0][0]).toBe(opts.pipe);
});

test(`call value and timestamp on ingress events`, () => {
	const pipe = 'pipe';
	const bus = busFactory();
	const i = new Input({pipe}, bus);
	const TIMESTAMP = 1234567890;
	const VALUE = 123;
	bus._listener[pipe].call(DUMMY, TIMESTAMP, VALUE, {});
	expect(i.value).toBe(VALUE);
	expect(i.timestamp).toBe(TIMESTAMP);
});

test(`emit update event on ingress events`, () => {
	const pipe = 'pipe';
	const bus = busFactory();
	const i = new Input({pipe}, bus);
	const onUpdateThis = {};
	const onUpdate = jest.fn(function () {
		Object.assign(onUpdateThis, this);
	});
	i.on('update', onUpdate);
	const TIMESTAMP = 1234567890;
	const VALUE = 123;
	bus._listener[pipe].call(DUMMY, TIMESTAMP, VALUE, {});
	expect(onUpdate.mock.calls[0][0]).toBe(VALUE);
	expect(onUpdate.mock.calls[0][1]).toBe(TIMESTAMP);
	expect(onUpdate.mock.instances[0]).toBe(i);
	expect(onUpdateThis.expired).toBe(false);
	expect(onUpdateThis.value).toBe(VALUE);
	expect(onUpdateThis.timestamp).toBe(TIMESTAMP);
});

test(`emit change event on ingress events that change value`, () => {
	const pipe = 'pipe';
	const bus = busFactory();
	const i = new Input({pipe}, bus);
	const onChange = jest.fn();
	i.on('change', onChange);
	const TIMESTAMP1 = 1234567890;
	const TIMESTAMP2 = 1234567891;
	const VALUE = 123;
	bus._listener[pipe].call(DUMMY, TIMESTAMP1, VALUE, {});
	bus._listener[pipe].call(DUMMY, TIMESTAMP2, VALUE, {});
	expect(onChange.mock.calls.length).toBe(1);
	expect(onChange.mock.calls[0][0]).toBe(VALUE);
	expect(onChange.mock.calls[0][1]).toBe(TIMESTAMP1);
	expect(onChange.mock.instances[0]).toBe(i);
});

test(`expire values`, () => {
	const bus = busFactory();
	const log = { warn: jest.fn() };
	const pipe = 'test';
	const TIMEOUT = 1000;
	const i = new Input({pipe, expire: TIMEOUT}, bus, log);
	const onExpire = jest.fn();
	i.on('expire', onExpire);
	const TS = 1234567890;
	const DRIFT = 2345;
	Date.now = jest.fn(() => TS + DRIFT);
	bus._listener[pipe].call(DUMMY, TS, 42, {});
	expect(onExpire.mock.calls.length).toBe(0);
	expect(i.expired).toBe(false);
	jest.runTimersToTime(TIMEOUT - DRIFT);
	expect(onExpire.mock.calls.length).toBe(1);
	expect(i.expired).toBe(true);
	expect(log.warn.mock.calls[0][0]).toBeInstanceOf(StatefulError);
	expect(log.warn.mock.calls[0][0].message).toEqual(`Value from pipe ${pipe} expired`);
	expect(log.warn.mock.calls[0][1]).toEqual('562b76ca61a378285335fccf20a9bbca');
});

test(`resolve expire errors`, () => {
	const bus = busFactory();
	const log = { warn: jest.fn() };
	const pipe = 'test';
	const expire = 1000;
	new Input({pipe, expire}, bus, log);
	const now = 1234567890;
	Date.now = () => now;
	bus._listener[pipe].call(DUMMY, now, 42, {});
	jest.advanceTimersByTime(expire);
	const err = log.warn.mock.calls[0][0];
	expect(err).toBeInstanceOf(StatefulError);
	bus._listener[pipe].call(DUMMY, now, 42, {});
	return expect(err.q).resolves.toBeUndefined();
});

test(`set log level for expiration`, () => {
	const pipe = 'pipe';
	const bus = busFactory();
	const log = {warn: jest.fn()};
	const TIMEOUT = 1000;
	/* eslint-disable no-new */
	new Input({pipe, expire: TIMEOUT, logLevelExpiration: null}, bus, log);
	const TS = 1234567890;
	Date.now = jest.fn(() => TS);
	bus._listener[pipe].call(DUMMY, TS, 42, {});
	jest.runTimersToTime(TIMEOUT);
	expect(log.warn.mock.calls.length).toBe(0);
});

test(`reset expire timer on new values`, () => {
	const pipe = 'pipe';
	const bus = busFactory();
	const TIMEOUT = 1000;
	const i = new Input({pipe, expire: TIMEOUT}, bus);
	const onExpire = jest.fn();
	i.on('expire', onExpire);
	const TS1 = 1234567890;
	Date.now = jest.fn(() => TS1);
	bus._listener[pipe].call(DUMMY, TS1, 42, {});
	expect(onExpire.mock.calls.length).toBe(0);
	jest.advanceTimersByTime(TIMEOUT / 2);
	const TS2 = TS1 + TIMEOUT / 2;
	Date.now = jest.fn(() => TS2);
	bus._listener[pipe].call(DUMMY, TS2, 42, {});
	jest.advanceTimersByTime(TIMEOUT / 2);
	expect(onExpire.mock.calls.length).toBe(0);
});

test(`Expose event source`, () => {
	const pipe = 'pipe';
	const bus = busFactory();
	const i = new Input({pipe}, bus);
	const onUpdate = jest.fn();
	const onChange = jest.fn();
	i.on('update', onUpdate);
	i.on('change', onChange);
	const commonName = 'xyz';
	const id = 'ert';
	const THIS = {
		event: pipe,
		source: {
			id,
			info: {subject: {commonName}}
		}
	};
	const TIMESTAMP = 1234567890;
	const VALUE = 123;
	const SOURCE = {componentId: 'abc', componentName: 'def'};
	bus._listener[pipe].call(THIS, TIMESTAMP, VALUE, SOURCE);
	const EXPECTED = {
		...SOURCE,
		nodeName: commonName,
		nodeId: id,
		pipe: pipe
	};
	expect(onUpdate.mock.calls[0][2]).toMatchObject(EXPECTED);
	expect(onChange.mock.calls[0][2]).toMatchObject(EXPECTED);
	expect(i.source).toMatchObject(EXPECTED);
});

test(`Get age of input value`, () => {
	const age = 60000;
	const timestamp = 1234567890;
	Date.now = () => timestamp + age;
	const i = new Input({});
	i.timestamp = timestamp;
	expect(i.age).toBe(age);
});

test(`Return undefined age if no timestamp is present`, () => {
	const i = new Input({});
	expect(i.age).toBeUndefined();
});

test(`Clear timeout on destroy`, () => {
	const pipe = 'pipe';
	const bus = busFactory();
	const i = new Input({pipe, expire: 123}, bus);
	bus._listener[pipe].call(DUMMY, 1, 2, {});
	i._destroy();
	expect(clearTimeout).toHaveBeenCalledTimes(1);
});

test(`Assign default value on startup`, () => {
	const defaultValue = 123;
	const i = new Input({default: defaultValue});
	expect(i.value).toBe(defaultValue);
});

test(`Set default value on expiration`, () => {
	const defaultValue = 123;
	const pipe = 'pipe';
	const bus = busFactory();
	const expire = 1000;
	const i = new Input({pipe, expire, default: defaultValue, logLevelExpiration: null}, bus);
	const now = 1234567890;
	Date.now = jest.fn(() => now);
	bus._listener[pipe].call(DUMMY, now, 42, {});
	jest.advanceTimersByTime(expire);
	expect(i.expired).toBe(true);
	expect(i.value).toBe(defaultValue);
	expect(i.timestamp).toBeUndefined();
});

test(`Call checkpoint`, async () => {
	const pipe = 'pipe';
	const bus = busFactory();
	const ts = 1234567890;
	const vin = 1;
	const vout = 2;
	const checkpoint = jest.fn(() => vout);
	const i = new Input({pipe, checkpoint}, bus);
	const commonName = 'xyz';
	const id = 'ert';
	const ctx = {
		event: pipe,
		source: {
			id,
			info: {subject: {commonName}}
		}
	};
	const source = {componentId: 'abc', componentName: 'def'};
	await bus._listener[pipe].bind(ctx)(ts, vin, source);
	expect(checkpoint.mock.instances[0]).toBe(i);
	expect(checkpoint.mock.calls[0][0]).toBe(vin);
	expect(checkpoint.mock.calls[0][1]).toBe(ts);
	expect(checkpoint.mock.calls[0][2]).toMatchObject({
		...source,
		nodeName: commonName,
		nodeId: id,
		pipe: pipe
	});
	expect(i.value).toBe(vout);
});

test(`Report error if checkpoint rejects value`, async () => {
	const pipe = 'pipe';
	const bus = busFactory();
	const log = {error: jest.fn()};
	const msg = `msg`;
	const checkpoint = jest.fn(() => Promise.reject(new Error(msg)));
	const i = new Input({pipe, checkpoint}, bus, log);
	const onUpdate = jest.fn();
	i.on('update', onUpdate);
	await bus._listener[pipe].call(DUMMY, 1234567890, true, {});
	expect(onUpdate.mock.calls.length).toBe(0);
	expect(log.error.mock.calls[0][0]).toEqual(`Value from pipe ${pipe} was rejected by checkpoint: ${msg}`);
	expect(log.error.mock.calls[0][1]).toEqual('661c3f3b934be8c722405399fb41e2e6');
});

test(`Suppress checkpoint errors`, async () => {
	const pipe = 'pipe';
	const bus = busFactory();
	const log = {error: jest.fn()};
	const checkpoint = jest.fn(() => Promise.reject(new Error('msg')));
	/* eslint-disable no-new */
	new Input({pipe, checkpoint, logLevelCheckpoint: null}, bus, log);
	await bus._listener[pipe].call(DUMMY, 1234567890, true);
	expect(log.error.mock.calls.length).toBe(0);
});

test(`Bypass spy flag`, () => {
	const bus = busFactory();
	/* eslint-disable no-new */
	new Input({pipe: 'pipe', spy: true}, bus);
	expect(bus.on.mock.calls[0][2].spy).toBe(true);
});
