module.exports = (ftrm) => {
	ftrm.ipc.subscribe('multicast.discovery');
	ftrm.ipc.on('discovery', (msg) => {
		const components = ftrm.components.map((c) => {
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

			return {lib, opts};
		});
		ftrm.ipc.send(`unicast.${msg.nodeId}.adv`, 'adv', {components});
	});
};
