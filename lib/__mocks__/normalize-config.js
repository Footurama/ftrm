module.exports = jest.fn((opts) => {
	if (opts.input === undefined) opts.input = [];
	if (opts.output === undefined) opts.output = [];
});
