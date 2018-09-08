const EventEmitter = require('events');

class Input extends EventEmitter {
	constructor (opts, bus) {
		super();

		Object.assign(this, opts);
		this._bus = bus;

		// Event listener to change events
		const eventListener = (timestamp, value) => {
			// Figure out if something changed
			const changed = this.value !== value;

			// Update values
			this.timestamp = timestamp;
			this.value = value;

			// Call event listener
			this.emit('update', this.value, this.timestamp);
			if (changed) this.emit('change', this.value, this.timestamp);

			// Handle expire timer
			if (this.expireTimeout) clearTimeout(this.expireTimeout);
			if (opts.expire) {
				// The data is time stamped at the soure ...
				// Include possible time drifts due to network
				// into the expire timer.
				const drift = Date.now() - this.timestamp;
				const delay = opts.expire - drift;
				this.expired = false;
				this.expireTimeout = setTimeout(() => {
					this.expired = true;
					this.emit('expire');
				}, delay);
			}
		};

		// If pipe has been specified wire up the bus
		if (this.pipe) this._bus.on(this.pipe, eventListener);
	}
}

module.exports = Input;
