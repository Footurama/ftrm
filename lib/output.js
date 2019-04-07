class Output {
	constructor (opts, bus) {
		this._bus = bus;
		Object.assign(this, opts);
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
		if (this.pipe) this._bus.emit(this.pipe, this.timestamp, this._value);

		// Retransmit the value if interval is set
		if (this.retransmitTimer) clearTimeout(this.retransmitTimer);
		if (this.retransmit) this.retransmitTimer = setTimeout(() => this.set(value), this.retransmit);
	}

	_destroy () {
		if (this.retransmitTimer) clearTimeout(this.retransmitTimer);
	}
}

module.exports = Output;
