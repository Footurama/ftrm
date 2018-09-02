module.exports._readdir = [];
module.exports.readdir = jest.fn((dir, cb) => cb(null, module.exports._readdir));
