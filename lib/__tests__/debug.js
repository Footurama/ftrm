const EventEmitter = require('events');
const debugFactory = require('../debug.js');

const nextLoop = () => new Promise((resolve) => setImmediate(resolve));

const ftrmFactory = () => Object.assign(new EventEmitter(), {
	id: 'abc',
	ipc: {
		subscribe: jest.fn(),
		on: jest.fn(),
		send: jest.fn(),
		observe: jest.fn()
	},
	components: []
});

test('Observe advertisement address', () => {
	const ftrm = ftrmFactory();
	debugFactory(ftrm);
	expect(ftrm.ipc.observe.mock.calls[0][0]).toEqual('multicast.adv');
});

test('Send current components to new listener', async () => {
	const ftrm = ftrmFactory();
	ftrm.components.push({
		lib: {
			string: 'abc',
			fn: () => {}
		},
		opts: {
			string: 'def',
			fn: () => {}
		}
	});
	debugFactory(ftrm);
	ftrm.ipc.observe.mock.calls[0][1](1, 0);
	await nextLoop();
	expect(ftrm.ipc.send.mock.calls[0][0]).toEqual('multicast.adv');
	expect(ftrm.ipc.send.mock.calls[0][1]).toEqual('adv');
	expect(ftrm.ipc.send.mock.calls[0][2]).toMatchObject({
		lib: {
			string: 'abc'
		},
		opts: {
			string: 'def',
			fn: '() => {}'
		}
	});
});

test('suppress advertisements if listener is removed', async () => {
	const ftrm = ftrmFactory();
	ftrm.components.push({lib: {}, opts: {}});
	debugFactory(ftrm);
	ftrm.ipc.observe.mock.calls[0][1](0, 1);
	await nextLoop();
	expect(ftrm.ipc.send.mock.calls.length).toBe(0);
});

test('advertise newly added components', () => {
	const ftrm = ftrmFactory();
	debugFactory(ftrm);
	ftrm.ipc.observe.mock.calls[0][1](1, 0);
	ftrm.emit('componentAdd', {string: 'abc'}, {string: 'def'});
	expect(ftrm.ipc.send.mock.calls[0][0]).toEqual('multicast.adv');
	expect(ftrm.ipc.send.mock.calls[0][1]).toEqual('adv');
	expect(ftrm.ipc.send.mock.calls[0][2]).toMatchObject({
		lib: { string: 'abc' },
		opts: { string: 'def' }
	});
});

test('suppress advertisements if no one is listening', () => {
	const ftrm = ftrmFactory();
	debugFactory(ftrm);
	ftrm.emit('componentAdd', {}, {});
	expect(ftrm.ipc.send.mock.calls.length).toBe(0);
});
