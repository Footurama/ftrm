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

test(`call onUpdate handler on ingress events`, () => {
	const bus = { on: jest.fn() };
	const i = new Input({pipe: 'pipe'}, bus);
	i.onUpdate = jest.fn();
	const TIMESTAMP = 1234567890;
	const VALUE = 123;
	bus.on.mock.calls[0][1](TIMESTAMP, VALUE);
	expect(i.onUpdate.mock.calls[0][0]).toBe(VALUE);
	expect(i.onUpdate.mock.calls[0][1]).toBe(TIMESTAMP);
	expect(i.onUpdate.mock.instances[0]).toBe(i);
});

test(`call onChange handler on ingress events that change value`, () => {
	const bus = { on: jest.fn() };
	const i = new Input({pipe: 'pipe'}, bus);
	i.onChange = jest.fn();
	const TIMESTAMP1 = 1234567890;
	const TIMESTAMP2 = 1234567891;
	const VALUE = 123;
	bus.on.mock.calls[0][1](TIMESTAMP1, VALUE);
	bus.on.mock.calls[0][1](TIMESTAMP2, VALUE);
	expect(i.onChange.mock.calls.length).toBe(1);
	expect(i.onChange.mock.calls[0][0]).toBe(VALUE);
	expect(i.onChange.mock.calls[0][1]).toBe(TIMESTAMP1);
	expect(i.onChange.mock.instances[0]).toBe(i);
});

test(`expire values`, () => {
	const bus = { on: jest.fn() };
	const TIMEOUT = 1000;
	const i = new Input({pipe: 'pipe', expire: TIMEOUT}, bus);
	i.onExpire = jest.fn();
	const TS = 1234567890;
	const DRIFT = 2345;
	Date.now = jest.fn(() => TS + DRIFT);
	bus.on.mock.calls[0][1](TS, 42);
	expect(i.onExpire.mock.calls.length).toBe(0);
	expect(i.expired).toBe(false);
	jest.runTimersToTime(TIMEOUT - DRIFT);
	expect(i.onExpire.mock.calls.length).toBe(1);
	expect(i.expired).toBe(true);
});

test(`reset expire timer on new values`, () => {
	const bus = { on: jest.fn() };
	const TIMEOUT = 1000;
	const i = new Input({pipe: 'pipe', expire: TIMEOUT}, bus);
	i.onExpire = jest.fn();
	const TS1 = 1234567890;
	Date.now = jest.fn(() => TS1);
	bus.on.mock.calls[0][1](TS1, 42);
	expect(i.onExpire.mock.calls.length).toBe(0);
	jest.advanceTimersByTime(TIMEOUT / 2);
	const TS2 = TS1 + TIMEOUT / 2;
	Date.now = jest.fn(() => TS2);
	bus.on.mock.calls[0][1](TS2, 42);
	jest.advanceTimersByTime(TIMEOUT / 2);
	expect(i.onExpire.mock.calls.length).toBe(0);
});
