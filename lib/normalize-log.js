const colors = require('colors');

colors.setTheme({
	info: 'gray',
	warn: 'yellow',
	error: 'red'
});

const logToStringFactory = (type, log) => (o) => {
	const fields = [];
	if (type === 'tty') fields.push(o.date.toISOString());
	fields.push(o.nodeName + (o.componentName ? ':' + o.componentName : ''));
	if (type !== 'journal') fields.push((type === 'tty') ? o.level[o.level] : o.level);
	fields.push(o.message);
	log(fields.join('\t'), o);
};

module.exports = (log, localId) => {
	if (typeof log === 'string') {
		let [scope, logger] = log.split('-');

		// Get log function
		let fnError = () => {};
		let fnWarn = () => {};
		let fnInfo = () => {};
		if (logger === 'stdout') {
			const fn = logToStringFactory(process.stdout.isTTY ? 'tty' : 'stream', (l) => process.stdout.write(`${l}\n`));
			fnError = fn;
			fnWarn = fn;
			fnInfo = fn;
		} else if (logger === 'journal') {
			const Journal = require('systemd-journald');
			const log = new Journal({syslog_identifier: 'ftrm'});
			fnError = logToStringFactory('journal', log.err);
			fnWarn = logToStringFactory('journal', log.warn);
			fnInfo = logToStringFactory('journal', log.info);
		}

		if (scope === 'global') {
			log = [
				{level: 'error', addr: `multicast.log.+.error`, fn: fnError},
				{level: 'warn', addr: `multicast.log.+.warn`, fn: fnWarn},
				{level: 'info', addr: `multicast.log.+.info`, fn: fnInfo}
			];
		} else if (scope === 'none') {
			log = [];
		} else {
			log = [
				{level: 'error', addr: `multicast.log.${localId}.error`, fn: fnError},
				{level: 'warn', addr: `multicast.log.${localId}.warn`, fn: fnWarn},
				{level: 'info', addr: `multicast.log.${localId}.info`, fn: fnInfo}
			];
		}
	}
	return log;
};
