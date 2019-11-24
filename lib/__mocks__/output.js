module.exports = jest.fn(function (opts) {
	Object.assign(this, opts);
	this._destroy = jest.fn();
});
