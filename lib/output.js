class Output {
	constructor (opts, bus) {
		Object.assign(this, opts);
		this._bus = bus;
	}

	get value () {
		return this._value;
	}

	set value (value) {
		// Also set the timestamp seamlessly
		this._value = value;
		this.timestamp = Date.now();

		// Emit the value if a pipe has been specified
		if (this.pipe) this._bus.emit(this.pipe, this.timestamp, this._value);
	}
}

module.exports = Output;
