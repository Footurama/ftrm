class Dedup {
	constructor (opts = {}) {
		this.offset = opts.start || 0;
		this.windowSize = opts.windowSize || 32;
		this.window = {};
	}

	dedup (seq) {
		if (seq < this.offset) return false;

		while (seq >= this.offset + this.windowSize) {
			delete this.window[this.offset++];
		}

		const pass = !this.window[this.offset + seq];
		this.window[this.offset + seq] = true;

		return pass;
	}
}

module.exports = Dedup;
