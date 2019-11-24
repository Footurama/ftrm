jest.mock('systemd-journald');
const mockJournal = require('systemd-journald');

const normalize = require('../normalize-log.js');

const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

test('don\'t touch arrays', () => {
	const arr = [];
	const log = normalize(arr);
	expect(log).toBe(arr);
});

test('disable logging', () => {
	const log = normalize('none');
	expect(log).toMatchObject([]);
});

test('log to stdout (no tty)', () => {
	process.stdout.isTTY = false;
	const localId = 'abc';
	const log = normalize('local-stdout', localId);
	expect(log).toMatchObject([
		{level: 'error', addr: `multicast.log.${localId}.error`},
		{level: 'warn', addr: `multicast.log.${localId}.warn`},
		{level: 'info', addr: `multicast.log.${localId}.info`}
	]);
	const nodeName = 'abc';
	const componentName = 'def';
	const message = 'xyz';
	log[0].fn({level: log[0].level, nodeName, componentName, message});
	expect(stdoutSpy.mock.calls[0][0]).toEqual(`${nodeName}:${componentName}\t${log[0].level}\t${message}\n`);
});

test('log to stdout (with tty)', () => {
	process.stdout.isTTY = true;
	const log = normalize('global-stdout');
	expect(log).toMatchObject([
		{level: 'error', addr: `multicast.log.+.error`},
		{level: 'warn', addr: `multicast.log.+.warn`},
		{level: 'info', addr: `multicast.log.+.info`}
	]);
	const date = new Date(1234567890);
	const nodeName = 'abc';
	const message = 'xyz';
	log[0].fn({level: 'error', date, nodeName, message});
	expect(stdoutSpy.mock.calls[0][0]).toEqual(`${date.toISOString()}\t${nodeName}\t${'error'.red}\t${message}\n`);
	log[1].fn({level: 'warn', date, nodeName, message});
	expect(stdoutSpy.mock.calls[1][0]).toEqual(`${date.toISOString()}\t${nodeName}\t${'warn'.yellow}\t${message}\n`);
	log[2].fn({level: 'info', date, nodeName, message});
	expect(stdoutSpy.mock.calls[2][0]).toEqual(`${date.toISOString()}\t${nodeName}\t${'info'.gray}\t${message}\n`);
});

test('log to journal', () => {
	const log = normalize('global-journal');
	expect(log).toMatchObject([ {level: 'error'}, {level: 'warn'}, {level: 'info'} ]);
	const nodeName = 'a';
	const componentName = 'b';
	const message = 'c';
	const obj = {nodeName, componentName, message};
	const j = mockJournal.mock.instances[0];
	expect(mockJournal.mock.calls[0][0]).toMatchObject({syslog_identifier: 'ftrm'});
	log[0].fn(obj);
	expect(j.err.mock.calls[0][0]).toEqual(`${nodeName}:${componentName}\t${message}`);
	expect(j.err.mock.calls[0][1]).toBe(obj);
	log[1].fn(obj);
	expect(j.warning.mock.calls[0][0]).toEqual(`${nodeName}:${componentName}\t${message}`);
	expect(j.warning.mock.calls[0][1]).toBe(obj);
	log[2].fn(obj);
	expect(j.info.mock.calls[0][0]).toEqual(`${nodeName}:${componentName}\t${message}`);
	expect(j.info.mock.calls[0][1]).toBe(obj);
});
