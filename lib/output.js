class Output {
	constructor (opts, bus) {
		this._bus = bus;
		Object.assign(this, opts);
	}

	get value () {
		return this._value;
	}

	set value (value) {
		// Throttle unchanged values
		const now = Date.now();
		if (this.throttle && value === this._value && this.timestamp + this.throttle >= now) return;

		// Also set the timestamp seamlessly
		this._value = value;
		this.timestamp = now;

		// Emit the value if a pipe has been specified
		if (this.pipe) this._bus.emit(this.pipe, this.timestamp, this._value);
	}

	get age () {
		if (this.timestamp === undefined) return undefined;
		return Date.now() - this.timestamp;
	}
}

module.exports = Output;
