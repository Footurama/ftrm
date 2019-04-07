jest.useFakeTimers();

const Input = require('../input.js');

test(`assign opts to local object`, () => {
	const opts = {
		a: true,
		b: 'test'
	};
	const i = new Input(opts);
	expect(i).toMatchObject(opts);
});

test(`if pipe is defined listen for events on the bus`, () => {
	const bus = { on: jest.fn() };
	const opts = { pipe: 'pipe' };
	const i = new Input(opts, bus);
	expect(i._bus).toBe(bus);
	expect(bus.on.mock.calls[0][0]).toBe(opts.pipe);
});

test(`call value and timestamp on ingress events`, () => {
	const bus = { on: jest.fn() };
	const i = new Input({pipe: 'pipe'}, bus);
	const TIMESTAMP = 1234567890;
	const VALUE = 123;
	bus.on.mock.calls[0][1](TIMESTAMP, VALUE);
	expect(i.value).toBe(VALUE);
	expect(i.timestamp).toBe(TIMESTAMP);
});

test(`emit update event on ingress events`, () => {
	const bus = { on: jest.fn() };
	const i = new Input({pipe: 'pipe'}, bus);
	const onUpdateThis = {};
	const onUpdate = jest.fn(function () {
		Object.assign(onUpdateThis, this);
	});
	i.on('update', onUpdate);
	const TIMESTAMP = 1234567890;
	const VALUE = 123;
	bus.on.mock.calls[0][1](TIMESTAMP, VALUE);
	expect(onUpdate.mock.calls[0][0]).toBe(VALUE);
	expect(onUpdate.mock.calls[0][1]).toBe(TIMESTAMP);
	expect(onUpdate.mock.instances[0]).toBe(i);
	expect(onUpdateThis.expired).toBe(false);
	expect(onUpdateThis.value).toBe(VALUE);
	expect(onUpdateThis.timestamp).toBe(TIMESTAMP);
});

test(`emit change event on ingress events that change value`, () => {
	const bus = { on: jest.fn() };
	const i = new Input({pipe: 'pipe'}, bus);
	const onChange = jest.fn();
	i.on('change', onChange);
	const TIMESTAMP1 = 1234567890;
	const TIMESTAMP2 = 1234567891;
	const VALUE = 123;
	bus.on.mock.calls[0][1](TIMESTAMP1, VALUE);
	bus.on.mock.calls[0][1](TIMESTAMP2, VALUE);
	expect(onChange.mock.calls.length).toBe(1);
	expect(onChange.mock.calls[0][0]).toBe(VALUE);
	expect(onChange.mock.calls[0][1]).toBe(TIMESTAMP1);
	expect(onChange.mock.instances[0]).toBe(i);
});

test(`expire values`, () => {
	const bus = { on: jest.fn() };
	const TIMEOUT = 1000;
	const i = new Input({pipe: 'pipe', expire: TIMEOUT}, bus);
	const onExpire = jest.fn();
	i.on('expire', onExpire);
	const TS = 1234567890;
	const DRIFT = 2345;
	Date.now = jest.fn(() => TS + DRIFT);
	bus.on.mock.calls[0][1](TS, 42);
	expect(onExpire.mock.calls.length).toBe(0);
	expect(i.expired).toBe(false);
	jest.runTimersToTime(TIMEOUT - DRIFT);
	expect(onExpire.mock.calls.length).toBe(1);
	expect(i.expired).toBe(true);
});

test(`reset expire timer on new values`, () => {
	const bus = { on: jest.fn() };
	const TIMEOUT = 1000;
	const i = new Input({pipe: 'pipe', expire: TIMEOUT}, bus);
	const onExpire = jest.fn();
	i.on('expire', onExpire);
	const TS1 = 1234567890;
	Date.now = jest.fn(() => TS1);
	bus.on.mock.calls[0][1](TS1, 42);
	expect(onExpire.mock.calls.length).toBe(0);
	jest.advanceTimersByTime(TIMEOUT / 2);
	const TS2 = TS1 + TIMEOUT / 2;
	Date.now = jest.fn(() => TS2);
	bus.on.mock.calls[0][1](TS2, 42);
	jest.advanceTimersByTime(TIMEOUT / 2);
	expect(onExpire.mock.calls.length).toBe(0);
});

test(`Expose partybus event`, () => {
	const bus = { on: jest.fn() };
	const i = new Input({pipe: 'pipe'}, bus);
	const onUpdate = jest.fn();
	const onChange = jest.fn();
	i.on('update', onUpdate);
	i.on('change', onChange);
	const THIS = {};
	const TIMESTAMP = 1234567890;
	const VALUE = 123;
	bus.on.mock.calls[0][1].call(THIS, TIMESTAMP, VALUE);
	expect(onUpdate.mock.calls[0][2]).toBe(THIS);
	expect(onChange.mock.calls[0][2]).toBe(THIS);
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
	const bus = { on: jest.fn() };
	const i = new Input({pipe: 'abc', expire: 123}, bus);
	bus.on.mock.calls[0][1](1, 2);
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
	const bus = { on: jest.fn() };
	const expire = 1000;
	const i = new Input({pipe: 'pipe', expire, default: defaultValue}, bus);
	const now = 1234567890;
	Date.now = jest.fn(() => now);
	bus.on.mock.calls[0][1](now, 42);
	jest.advanceTimersByTime(expire);
	expect(i.expired).toBe(true);
	expect(i.value).toBe(defaultValue);
	expect(i.timestamp).toBeUndefined();
});
