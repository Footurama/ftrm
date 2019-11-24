module.exports = jest.fn(function () {
	this.err = jest.fn();
	this.warning = jest.fn();
	this.info = jest.fn();
});
