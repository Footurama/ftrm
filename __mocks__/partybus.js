module.exports = jest.fn(() => Promise.resolve(module.exports._bus));
module.exports._bus = {hood: {leave: jest.fn()}};
