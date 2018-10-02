module.exports = (opts) => ['input', 'output'].forEach((key) => {
	if (typeof opts[key] === 'string') {
		// Format: { key: 'pipe' }
		opts[key] = [{ pipe: opts[key] }];
	} else if (typeof opts[key] === 'object') {
		if (opts[key] instanceof Array) {
			// Format: { key: [...] }
			opts[key] = opts[key].map((item) => {
				if (typeof item === 'object') return item;
				else return { pipe: item };
			});
		} else {
			// Format: { key: {'name': [...]} }
			opts[key] = Object.keys(opts[key]).map((name) => {
				const item = opts[key][name];
				if (typeof item === 'object') return { name, ...item };
				return { name, pipe: item };
			});
		}
	} else {
		// Have an empty array by default
		opts[key] = [];
	}
});
