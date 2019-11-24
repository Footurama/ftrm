const EventEmitter = require('events');
const Dedup = require('./dedup.js');

const PREFIX = '$ftrm.';

class IPC extends EventEmitter {
	constructor (bus) {
		super();
		this.bus = bus;
		this.dedup = {};
		this.seq = 0;
		this.subscriptions = {};
		this.subscribe(`broadcast`);
		this.subscribe(`unicast.${this.bus.hood.id}`);
	}

	subscribe (addr) {
		// Make sure to subscribe to one address only once
		if (this.subscriptions[addr]) {
			this.subscriptions[addr].refCnt += 1;
			return;
		}

		// Setup event listener
		const self = this;
		this.subscriptions[addr] = {
			refCnt: 1,
			event: PREFIX + addr,
			cb: function (ts, obj) {
				if (obj.msgType === undefined) return;
				if (obj.seq === undefined) return;

				// Get rid of duplicates
				const nodeId = this.source.id;
				if (!self.dedup[nodeId]) self.dedup[nodeId] = new Dedup();
				if (!self.dedup[nodeId].dedup(obj.seq)) return;

				obj.nodeId = nodeId;
				obj.nodeName = this.source.info.subject.commonName;
				self.emit(obj.msgType, obj);
			}
		};
		this.bus.on(this.subscriptions[addr].event, this.subscriptions[addr].cb);
	}

	unsubscribe (addr) {
		const s = this.subscriptions[addr];
		s.refCnt -= 1;
		if (s.refCnt === 0) {
			this.bus.removeListener(s.event, s.cb);
			delete this.subscriptions[addr];
		}
	}

	send (address, msgType, obj = {}) {
		if (!address) throw new Error('address is required');
		if (!msgType) throw new Error('msgType is required');
		const ts = Date.now();
		obj.seq = this.seq++;
		obj.date = new Date(ts);
		obj.msgType = msgType;
		obj.nodeId = this.bus.hood.id;
		obj.nodeName = this.bus.hood.info.subject.commonName;
		return this.bus.emit(PREFIX + address, ts, obj);
	}

	observe (address, cb) {
		let oldCnt = 0;
		return this.bus.observeListenerCount(PREFIX + address, (newCnt) => {
			cb(newCnt, oldCnt);
			oldCnt = newCnt;
		});
	}
}

module.exports = IPC;
