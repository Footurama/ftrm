const colors = require('colors');

colors.setTheme({
	info: 'gray',
	warn: 'yellow',
	error: 'red'
});

const logToStringFactory = (type, log) => (o) => {
	const fields = [];

	// Date for real stdout
	if (type === 'tty') fields.push(o.date.toISOString());

	// Path of the log origin
	let path = o.nodeName;
	if (o.componentName) path += ':' + o.componentName;
	if (o.inputIndex !== undefined) path += ':i[' + o.inputIndex + ']';
	if (o.outputIndex !== undefined) path += ':o[' + o.outputIndex + ']';
	fields.push(path);

	// Log level for stdout
	if (type !== 'journal') fields.push((type === 'tty') ? o.level[o.level] : o.level);

	// Message
	fields.push(o.message);

	// Message type for stateful errors
	if (o.message_type) fields.push('[' + o.message_type + ']');

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
			fnError = logToStringFactory('journal', (m, o) => log.err(m, o));
			fnWarn = logToStringFactory('journal', (m, o) => log.warning(m, o));
			fnInfo = logToStringFactory('journal', (m, o) => log.info(m, o));
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
