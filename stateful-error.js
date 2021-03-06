const crypto = require('crypto');

class StatefulError extends Error {
	constructor (msg) {
		super(msg);
		this.name = this.constructor.name;
		this.date = Date.now();
		this.error_id = crypto.randomBytes(16).toString('hex');
		this.q = new Promise((resolve) => {
			this.resolve = resolve;
		});
	}
}

StatefulError.RETRANSMIT_INTERVAL = 10 * 60 * 1000;

module.exports = StatefulError;
