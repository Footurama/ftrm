module.exports = jest.fn(function () {
	this.send = jest.fn();
	this.subscribe = jest.fn();
	this.observe = jest.fn();
	this._listener = {};
	this.on = jest.fn((e, cb) => {
		this._listener[e] = cb;
		return this;
	});
});
