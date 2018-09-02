module.exports = jest.fn(() => Promise.resolve(module.exports._bus));
module.exports._bus = {};
