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
