module.exports.readdir = jest.fn((dir, cb) => cb(null, []));
module.exports.readFile = jest.fn((file, cb) => cb(null, Buffer.alloc(0)));
