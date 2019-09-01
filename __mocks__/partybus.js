const EventEmitter = require('events');
module.exports = jest.fn(() => {
	const bus = {
		on: jest.fn(),
		emit: jest.fn(),
		hood: new EventEmitter()
	};
	Object.assign(bus.hood, {
		id: 'abcd',
		info: {subject: {commonName: 'qwerty'}},
		leave: jest.fn()
	});
	module.exports._bus = bus;
	return Promise.resolve(bus);
});
