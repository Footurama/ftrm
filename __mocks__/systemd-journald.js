module.exports = jest.fn(function () {
	this.err = jest.fn();
	this.warn = jest.fn();
	this.info = jest.fn();
});
