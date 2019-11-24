const transformComponentCache = {};

function transformComponent (c) {
	if (!transformComponentCache[c.opts.id]) {
		// Include everything that is not a function
		const lib = Object.keys(c.lib).reduce((lib, key) => {
			if (typeof c.lib[key] !== 'function') lib[key] = c.lib[key];
			return lib;
		}, {});

		// Include the whole option object with all functions converted to strings
		const opts = JSON.parse(JSON.stringify(
			c.opts,
			(key, value) => (typeof value === 'function') ? value.toString() : value
		));

		transformComponentCache[c.opts.id] = {lib, opts};
	}

	return transformComponentCache[c.opts.id];
}

module.exports = (ftrm) => {
	let cnt = 0;
	ftrm.ipc.observe('multicast.adv', (newCnt, oldCnt) => {
		cnt = newCnt;
		if (newCnt <= oldCnt) return;

		// If a new listener joins, send out all loaded components
		ftrm.components.map(transformComponent).reduce((q, component) => q.then(() => {
			return ftrm.ipc.send('multicast.adv', 'adv', {...component});
		}), Promise.resolve());
	});

	ftrm.on('componentAdd', (lib, opts) => {
		if (!cnt) return;
		const component = transformComponent({lib, opts});
		ftrm.ipc.send('multicast.adv', 'adv', {...component});
	});

	ftrm.on('componentRemove', (lib, opts) => {
		delete transformComponentCache[opts.id];
	});
};
