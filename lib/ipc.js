const EventEmitter = require('events');

const PREFIX = '$ftrm.';

// TODO: Reference counting

class IPC extends EventEmitter {
	constructor (bus) {
		super();
		this.bus = bus;
		this.subscribe(`broadcast`);
		this.subscribe(`unicast.${this.bus.hood.id}`);
	}

	subscribe (addr) {
		const self = this;
		this.bus.on(PREFIX + addr, function (ts, obj) {
			if (!obj.msgType) return;
			obj.nodeId = this.source.id;
			obj.nodeName = this.source.info.subject.commonName;
			self.emit(obj.msgType, obj);
		});
	}

	send (address, msgType, obj = {}) {
		if (!address) throw new Error('address is required');
		if (!msgType) throw new Error('msgType is required');
		const ts = Date.now();
		obj.date = new Date(ts);
		obj.nodeId = this.bus.hood.id;
		obj.nodeName = this.bus.hood.info.subject.commonName;
		obj.msgType = msgType;
		return this.bus.emit(PREFIX + address, ts, obj);
	}
}

module.exports = IPC;
