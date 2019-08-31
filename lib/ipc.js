const EventEmitter = require('events');

const PREFIX = '$ftrm.';

// TODO: Reference counting

class IPC extends EventEmitter {
	constructor (ftrm) {
		super();
		this.bus = ftrm.bus;
		this.subscribe(`broadcast`);
		this.subscribe(`unicast.${ftrm.id}`);
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
		obj.msgType = msgType;
		return this.bus.emit(PREFIX + address, Date.now(), obj);
	}
}

module.exports = IPC;
