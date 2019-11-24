jest.mock('crypto');
const mockCrypto = require('crypto');

const normalize = require('../normalize-config.js');

describe('input', () => {
	test(`convert '[pipe]' into [{pipe: '[pipe]'}]`, () => {
		const PIPE = 'test';
		const opts = { input: PIPE };
		normalize(opts);
		expect(opts.input).toMatchObject([{ pipe: PIPE }]);
	});

	test(`convert {'[name]': '[pipe]'} into [{name: '[name]', pipe: '[pipe]'}]`, () => {
		const NAME1 = 'name1';
		const PIPE1 = 'pipe1';
		const NAME2 = 'name2';
		const PIPE2 = 'pipe2';
		const opts = { input: {} };
		opts.input[NAME1] = PIPE1;
		opts.input[NAME2] = PIPE2;
		normalize(opts);
		expect(opts.input).toMatchObject([
			{ name: NAME1, pipe: PIPE1 },
			{ name: NAME2, pipe: PIPE2 }
		]);
	});

	test(`convert {'[name]': {pipe: '[pipe]', otherOption: '...'}} into [{name: '[name]', pipe: '[pipe]', otherOption: '...'}]`, () => {
		const NAME1 = 'name1';
		const PIPE1 = 'pipe1';
		const NAME2 = 'name2';
		const PIPE2 = 'pipe2';
		const opts = { input: {} };
		opts.input[NAME1] = {pipe: PIPE1, opt: true};
		opts.input[NAME2] = {pipe: PIPE2, opt: true};
		normalize(opts);
		expect(opts.input).toMatchObject([
			{ name: NAME1, pipe: PIPE1, opt: true },
			{ name: NAME2, pipe: PIPE2, opt: true }
		]);
	});

	test(`convert ['[pipe]'] into [{pipe: '[pipe]'}]`, () => {
		const opts = { input: [
			'a',
			'b'
		] };
		normalize(opts);
		expect(opts.input).toMatchObject([
			{ pipe: 'a' },
			{ pipe: 'b' }
		]);
	});

	test(`don't convert arrays in correct form`, () => {
		const opts = { input: [
			{ pipe: 'a' },
			{ pipe: 'b' }
		] };
		normalize(opts);
		expect(opts.input).toMatchObject([
			{ pipe: 'a' },
			{ pipe: 'b' }
		]);
	});

	test(`default to an empty array`, () => {
		const opts = {};
		normalize(opts);
		expect(opts.input).toMatchObject([]);
	});
});

describe('output', () => {
	test(`convert '[pipe]' into [{pipe: '[pipe]'}]`, () => {
		const PIPE = 'test';
		const opts = { output: PIPE };
		normalize(opts);
		expect(opts.output).toMatchObject([{ pipe: PIPE }]);
	});

	test(`convert {'[name]': '[pipe]'} into [{name: '[name]', pipe: '[pipe]'}]`, () => {
		const NAME1 = 'name1';
		const PIPE1 = 'pipe1';
		const NAME2 = 'name2';
		const PIPE2 = 'pipe2';
		const opts = { output: {} };
		opts.output[NAME1] = PIPE1;
		opts.output[NAME2] = PIPE2;
		normalize(opts);
		expect(opts.output).toMatchObject([
			{ name: NAME1, pipe: PIPE1 },
			{ name: NAME2, pipe: PIPE2 }
		]);
	});

	test(`convert {'[name]': {pipe: '[pipe]', otherOption: '...'}} into [{name: '[name]', pipe: '[pipe]', otherOption: '...'}]`, () => {
		const NAME1 = 'name1';
		const PIPE1 = 'pipe1';
		const NAME2 = 'name2';
		const PIPE2 = 'pipe2';
		const opts = { output: {} };
		opts.output[NAME1] = {pipe: PIPE1, opt: true};
		opts.output[NAME2] = {pipe: PIPE2, opt: true};
		normalize(opts);
		expect(opts.output).toMatchObject([
			{ name: NAME1, pipe: PIPE1, opt: true },
			{ name: NAME2, pipe: PIPE2, opt: true }
		]);
	});

	test(`convert ['[pipe]'] into [{pipe: '[pipe]'}]`, () => {
		const opts = { output: [
			'a',
			'b'
		] };
		normalize(opts);
		expect(opts.output).toMatchObject([
			{ pipe: 'a' },
			{ pipe: 'b' }
		]);
	});

	test(`don't convert arrays in correct form`, () => {
		const opts = { output: [
			{ pipe: 'a' },
			{ pipe: 'b' }
		] };
		normalize(opts);
		expect(opts.output).toMatchObject([
			{ pipe: 'a' },
			{ pipe: 'b' }
		]);
	});

	test(`default to an empty array`, () => {
		const opts = {};
		normalize(opts);
		expect(opts.output).toMatchObject([]);
	});
});

describe('name and id', () => {
	test('set id', () => {
		const opts = {};
		normalize(opts);
		expect(mockCrypto.randomBytes.mock.calls[0][0]).toBe(8);
		expect(opts.id).toEqual(mockCrypto.randomBytes.mock.results[0].value.toString('hex'));
	});

	test('use existing id', () => {
		const id = 'abc';
		const opts = {id};
		normalize(opts);
		expect(mockCrypto.randomBytes.mock.calls.length).toBe(0);
		expect(opts.id).toBe(id);
	});

	test('set default name', () => {
		const opts = {};
		normalize(opts);
		expect(opts.name).toEqual('<unnamed>');
	});

	test('set existing name', () => {
		const name = 'abc';
		const opts = {name};
		normalize(opts);
		expect(opts.name).toEqual(name);
	});
});
