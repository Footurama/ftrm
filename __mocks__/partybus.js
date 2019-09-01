module.exports = jest.fn(() => Promise.resolve(module.exports._bus));
module.exports._bus = {
	on: jest.fn(),
	emit: jest.fn(),
	hood: {
		id: 'abcd',
		info: {subject: {commonName: 'qwerty'}},
		leave: jest.fn()
	}
};
