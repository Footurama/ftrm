const EventEmitter = require('events');

const Output = require('../output.js');

test(`assign opts to local object`, () => {
	const opts = {
		a: true,
		b: 'test'
	};
	const o = new Output(opts);
	expect(o).toMatchObject(opts);
});

test(`set timestamp when setting value`, () => {
	const o = new Output();
	const TIMESTAMP = 1234567890;
	const VALUE = 345;
	Date.now = jest.fn(() => TIMESTAMP);
	o.value = VALUE;
	expect(o.value).toBe(VALUE);
	expect(o.timestamp).toBe(TIMESTAMP);
});

test(`emit value with setting it if pipe is specified`, () => {
	const PIPE = 'pipe';
	const bus = { emit: jest.fn() };
	const o = new Output({ pipe: PIPE }, bus);
	const TIMESTAMP = 1234567890;
	const VALUE = 345;
	Date.now = jest.fn(() => TIMESTAMP);
	o.value = VALUE;
	expect(bus.emit.mock.calls[0][0]).toBe(PIPE);
	expect(bus.emit.mock.calls[0][1]).toBe(TIMESTAMP);
	expect(bus.emit.mock.calls[0][2]).toBe(VALUE);
});

test(`set value with specified timestamp`, () => {
	const PIPE = 'pipe';
	const bus = { emit: jest.fn() };
	const o = new Output({ pipe: PIPE }, bus);
	const TIMESTAMP = 123456;
	const VALUE = 345;
	Date.now = jest.fn();
	o.set(VALUE, TIMESTAMP);
	expect(bus.emit.mock.calls[0][0]).toBe(PIPE);
	expect(bus.emit.mock.calls[0][1]).toBe(TIMESTAMP);
	expect(bus.emit.mock.calls[0][2]).toBe(VALUE);
	expect(Date.now.mock.calls.length).toBe(0);
});

test(`emit default value if pipe is specified`, () => {
	const pipe = 'pipe';
	const bus = { emit: jest.fn() };
	const value = 12;
	const timestamp = 1234567890;
	Date.now = jest.fn(() => timestamp);
	const o = new Output({ pipe, value }, bus);
	expect(o.value).toBe(value);
	expect(bus.emit.mock.calls[0][0]).toBe(pipe);
	expect(bus.emit.mock.calls[0][1]).toBe(timestamp);
	expect(bus.emit.mock.calls[0][2]).toBe(value);
});

test(`Convert default values`, () => {
	const VALUE = 12345;
	const o = new Output({ value: VALUE });
	expect(o._value).toBe(VALUE);
	expect(o.value).toBe(VALUE);
});

test(`Don't refire fast output events if the value hasn't changed`, () => {
	const VALUE = 12345;
	const throttle = 3000;
	const pipe = 'abc';
	const bus = new EventEmitter();
	const onEvent = jest.fn();
	bus.on(pipe, onEvent);
	const o = new Output({pipe, throttle}, bus);
	const timestamp = 1234567890;
	Date.now = jest.fn(() => timestamp);
	o.value = VALUE;
	Date.now = jest.fn(() => timestamp + throttle);
	o.value = VALUE;
	expect(onEvent.mock.calls.length).toBe(1);
});

test(`Refire output events if throttle time has passed by`, () => {
	const VALUE = 12345;
	const throttle = 3000;
	const pipe = 'abc';
	const bus = new EventEmitter();
	const onEvent = jest.fn();
	bus.on(pipe, onEvent);
	const o = new Output({pipe, throttle}, bus);
	const timestamp = 1234567890;
	Date.now = jest.fn(() => timestamp);
	o.value = VALUE;
	Date.now = jest.fn(() => timestamp + throttle + 1);
	o.value = VALUE;
	expect(onEvent.mock.calls.length).toBe(2);
});

test(`Refire fast output events if the value changed`, () => {
	const VALUE = 12345;
	const throttle = 3000;
	const pipe = 'abc';
	const bus = new EventEmitter();
	const onEvent = jest.fn();
	bus.on(pipe, onEvent);
	const o = new Output({pipe, throttle}, bus);
	const timestamp = 1234567890;
	Date.now = jest.fn(() => timestamp);
	o.value = VALUE;
	Date.now = jest.fn(() => timestamp + throttle);
	o.value = VALUE + 1;
	expect(onEvent.mock.calls.length).toBe(2);
});

test(`Get age of input value`, () => {
	const age = 60000;
	const timestamp = 1234567890;
	Date.now = () => timestamp + age;
	const o = new Output({});
	o.timestamp = timestamp;
	expect(o.age).toBe(age);
});

test(`Return undefined age if no timestamp is present`, () => {
	const o = new Output({});
	expect(o.age).toBeUndefined();
});
