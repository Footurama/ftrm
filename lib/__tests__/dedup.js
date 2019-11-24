const Dedup = require('../dedup.js');

test('Set defaults', () => {
	const d = new Dedup();
	expect(d.offset).toBe(0);
	expect(d.windowSize).toBe(32);
});

test('Store opts', () => {
	const start = 123;
	const windowSize = 456;
	const d = new Dedup({start, windowSize});
	expect(d.offset).toBe(start);
	expect(d.windowSize).toBe(windowSize);
});

test('Deduplicate seqence', () => {
	const d = new Dedup();
	expect(d.dedup(0)).toBe(true);
	expect(d.dedup(0)).toBe(false);
});

test('Deduplicate seqences out of order within window', () => {
	const d = new Dedup({windowSize: 2});
	expect(d.dedup(1)).toBe(true);
	expect(d.dedup(0)).toBe(true);
});

test('Deduplicate seqences out of order out of window', () => {
	const d = new Dedup({windowSize: 2});
	expect(d.dedup(2)).toBe(true);
	expect(d.dedup(0)).toBe(false);
});
