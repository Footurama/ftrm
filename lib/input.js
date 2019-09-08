const EventEmitter = require('events');

class Input extends EventEmitter {
	constructor (opts, bus, log) {
		super();

		Object.assign(this, opts);
		this._bus = bus;
		this._log = log;
		if (this.logLevelExpiration === undefined) this.logLevelExpiration = 'warn';

		// Apply default value
		if (this.default !== undefined) this.value = this.default;

		// Event listener to partybus events
		const self = this;
		function eventListener (timestamp, value) {
			// TODO: Type checker -> (value) => value; May throws error

			// Figure out if something changed
			const changed = self.value !== value;

			// Update info
			self.timestamp = timestamp;
			self.value = value;
			self.expired = false;

			// Call event listener
			self.emit('update', self.value, self.timestamp, this);
			if (changed) self.emit('change', self.value, self.timestamp, this);

			// Handle expire timer
			if (self.expireTimeout) clearTimeout(self.expireTimeout);
			if (opts.expire) {
				// The data is time stamped at the soure ...
				// Include possible time drifts due to network
				// into the expire timer.
				const drift = Date.now() - self.timestamp;
				const delay = opts.expire - drift;
				self.expireTimeout = setTimeout(() => {
					self.expired = true;
					if (self.default !== undefined) {
						self.value = self.default;
						delete self.timestamp;
					}
					self.emit('expire');
					if (self.logLevelExpiration) {
						self._log[self.logLevelExpiration](
							new Error(`Value from pipe ${self.pipe} expired`),
							'562b76ca61a378285335fccf20a9bbca'
						);
					}
				}, delay);
			}
		};

		// If pipe has been specified, wire up the bus
		if (this.pipe) this._bus.on(this.pipe, eventListener);
	}

	get age () {
		if (this.timestamp === undefined) return undefined;
		return Date.now() - this.timestamp;
	}

	_destroy () {
		// Remove pending timers
		if (this.expireTimeout) clearTimeout(this.expireTimeout);
	}
}

module.exports = Input;
