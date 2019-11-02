jest.mock('crypto');
const mockCrypto = require('crypto');

const StatefulError = require('../stateful-error.js');

test('must be instance of Error', () => {
	const msg = 'abc';
	const e = new StatefulError(msg);
	expect(e).toBeInstanceOf(Error);
	expect(e.message).toBe(msg);
	expect(e.stack).toBeDefined();
	expect(e.name).toEqual('StatefulError');
});

test('include timestamp', () => {
	const ts = 1234567890;
	Date.now = () => ts;
	const e = new StatefulError();
	expect(e.date).toBe(ts);
});

test('generate 128bit ID', () => {
	const e = new StatefulError();
	expect(mockCrypto.randomBytes.mock.calls[0][0]).toBe(16);
	expect(e.error_id).toEqual(mockCrypto.randomBytes.mock.results[0].value.toString('hex'));
});

test('resolve error', () => {
	const e = new StatefulError();
	e.resolve();
	return expect(e.q).resolves.toBeUndefined();
});
