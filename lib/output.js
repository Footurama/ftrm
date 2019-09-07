class Output {
	constructor (opts, bus, log) {
		this._bus = bus;
		this._log = log;
		Object.assign(this, opts);
		if (this.logLevelNoListeners === undefined) this.logLevelNoListeners = 'warn';
	}

	get value () {
		return this._value;
	}

	set value (value) {
		this.set(value);
	}

	get age () {
		if (this.timestamp === undefined) return undefined;
		return Date.now() - this.timestamp;
	}

	set (value, timestamp) {
		// Default timestamp to current time
		if (timestamp === undefined) timestamp = Date.now();

		// Throttle unchanged values
		if (this.throttle && value === this._value && this.timestamp + this.throttle >= timestamp) return;

		// Also set the timestamp seamlessly
		this._value = value;
		this.timestamp = timestamp;

		// Emit the value if a pipe has been specified
		const q = (this.pipe) ? this._bus.emit(this.pipe, this.timestamp, this._value) : Promise.resolve(0);
		if (this.pipe && this.logLevelNoListeners) {
			q.then((cnt) => {
				if (cnt <= 0) {
					this._log[this.logLevelNoListeners](
						new Error(`Pipe ${this.pipe} had no listeners`),
						'baaf4847f8857ac34dc75b51d44696da'
					);
				}
			});
		}

		// Retransmit the value if interval is set
		if (this.retransmitTimer) clearTimeout(this.retransmitTimer);
		if (this.retransmit) this.retransmitTimer = setTimeout(() => this.set(value), this.retransmit);

		return q;
	}

	_destroy () {
		if (this.retransmitTimer) clearTimeout(this.retransmitTimer);
	}
}

module.exports = Output;
