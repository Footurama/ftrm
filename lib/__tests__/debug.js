const debugFactory = require('../debug.js');

const ftrmFactory = () => ({
	id: 'abc',
	ipc: {
		subscribe: jest.fn(),
		on: jest.fn(),
		send: jest.fn()
	},
	components: []
});

test('Subscribe to discovery addresses', () => {
	const ftrm = ftrmFactory();
	debugFactory(ftrm);
	expect(ftrm.ipc.subscribe.mock.calls[0][0]).toEqual('multicast.discovery');
	expect(ftrm.ipc.subscribe.mock.calls[1][0]).toEqual(`unicast.${ftrm.id}.discovery`);
});

test('Listen to discovery messages', () => {
	const ftrm = ftrmFactory();
	debugFactory(ftrm);
	expect(ftrm.ipc.on.mock.calls[0][0]).toEqual('discovery');
});

test('Reply to discovery messages', () => {
	const ftrm = ftrmFactory();
	const name = 'test';
	ftrm.components.push({
		lib: {
			name,
			factory: () => {},
			check: () => {}
		},
		opts: {
			input: [],
			output: [],
			test: () => {}
		}
	});
	debugFactory(ftrm);
	const nodeId = 'avc';
	ftrm.ipc.on.mock.calls[0][1]({nodeId});
	expect(ftrm.ipc.send.mock.calls[0][0]).toEqual(`unicast.${nodeId}.adv`);
	expect(ftrm.ipc.send.mock.calls[0][1]).toEqual('adv');
	expect(ftrm.ipc.send.mock.calls[0][2]).toMatchObject({components: [{
		lib: {
			name
		},
		opts: {
			input: [],
			output: [],
			test: '() => {}'
		}
	}]});
});
