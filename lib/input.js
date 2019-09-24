const EventEmitter = require('events');

class Input extends EventEmitter {
	constructor (opts, bus, log) {
		super();

		Object.assign(this, opts);
		this._bus = bus;
		this._log = log;
		if (this.logLevelExpiration === undefined) this.logLevelExpiration = 'warn';
		if (this.logLevelCheckpoint === undefined) this.logLevelCheckpoint = 'error';

		// Apply default value
		if (this.default !== undefined) this.value = this.default;

		// Event listener to partybus events
		const self = this;
		async function eventListener (timestamp, value, source = {}) {
			// Add source information provided by partybus
			Object.assign(source, {
				nodeId: this.source.id,
				nodeName: this.source.info.subject.commonName,
				pipe: this.event
			});

			if (self.checkpoint) {
				try {
					value = await self.checkpoint(value, timestamp, source);
				} catch (e) {
					if (self.logLevelCheckpoint) {
						const msg = (e instanceof Error) ? e.message : e;
						log[self.logLevelCheckpoint](
							`Value from pipe ${self.pipe} was rejected by checkpoint: ${msg}`,
							'661c3f3b934be8c722405399fb41e2e6'
						);
					}
					return;
				}
			}

			// Figure out if something changed
			const changed = self.value !== value;

			// Update info
			self.timestamp = timestamp;
			self.value = value;
			self.source = source;
			self.expired = false;

			// Call event listener
			self.emit('update', self.value, self.timestamp, self.source);
			if (changed) self.emit('change', self.value, self.timestamp, self.source);

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
		if (this.pipe) this._bus.on(this.pipe, eventListener, {spy: this.spy || false});
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
