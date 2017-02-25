import test from 'ava'
import sinon from 'sinon'
import mockSpawn from 'mock-spawn'
import typeDetect from 'type-detect'
import { LFTP } from './../lftp.js'

const lftpInit = (opts = {
  host: 'host',
  username: 'username',
  password: 'password'
}) => {
  return new LFTP(opts)
}

const rawSpyInit = (lftp) => {
  return sinon.spy(lftp, 'raw')
}

const _escapeShellSpyInit = (lftp) => {
  return sinon.spy(lftp, '_escapeShell')
}

const failStubInit = (lftp) => {
  return sinon.stub(lftp, 'fail')
}

test('constructor', (t) => {
  t.plan(4)

  const lftp = lftpInit({
    host: 'host',
    username: 'username',
    password: 'password',
    protocol: 'ftp',
    port: 21,
    escape: false,
    retries: 2,
    timeout: 5,
    retryInterval: 2,
    retryIntervalMultiplier: 2,
    autoConfirm: true,
    cwd: 'cwd'
  })

  t.deepEqual(lftp.options, {
    host: 'ftp://host:21',
    username: 'username',
    password: 'password',
    protocol: 'ftp',
    escape: false,
    retries: 2,
    timeout: 5,
    retryInterval: 2,
    retryIntervalMultiplier: 2,
    autoConfirm: true
  })

  t.not(lftp.spawn, undefined)

  t.deepEqual(lftp.spawnOptions, {
    cwd: 'cwd'
  })

  t.deepEqual(lftp.cmds, [])
})

test('fail', (t) => {
  t.plan(2)

  const lftp = lftpInit()
  const error = t.throws(() => {
    lftp.fail('Failure Message')
  }, Error)

  t.is(error.message, 'Failure Message')
})

test('validateOptions', (t) => {
  t.plan(4)

  const lftp = lftpInit()
  const failStub = failStubInit(lftp)

  lftp.validateOptions({})
  t.true(failStub.calledWith('LFTP opts must include host'))

  lftp.validateOptions({host: 'host'})
  t.true(failStub.calledWith('LFTP opts must include username'))

  lftp.validateOptions({host: 'host', username: 'username'})
  t.true(failStub.calledWith('LFTP opts must include password'))

  lftp.validateOptions({
    host: 'host', username: 'username', password: 'password', protocol: 'ftsp'
  })
  t.true(failStub.calledWith('LFTP opts.protocol must be ftp, sftp, or ftps.'))
})

test('escapeShell', (t) => {
  t.plan(1)

  const lftp = lftpInit()

  t.is(lftp.escapeShell(
    '[test] Test.mkv"\'$`\\'),
    '\\[test\\]\\ Test.mkv\\"\\\'\\$\\`\\\\'
  )
})

test('_escapeShell', (t) => {
  t.plan(2)

  const lftp = lftpInit()
  const escapeShellStub = sinon.stub(lftp, 'escapeShell')
  lftp._escapeShell('command')
  t.true(escapeShellStub.calledWith('command'))

  lftp.options.escape = false
  const anotherCommand = lftp._escapeShell('another command')
  t.is(anotherCommand, 'another command')
})

test('baseCmd', (t) => {
  t.plan(1)

  const lftp = lftpInit({
    host: 'host',
    username: 'username',
    password: 'password',
    protocol: 'sftp',
    port: 22,
    retries: 1,
    timeout: 10,
    retryInterval: 5,
    retryIntervalMultiplier: 1,
    autoConfirm: true
  })

  t.deepEqual(lftp.baseCmd(), [
    'set sftp:auto-confirm yes',
    'set net:max-retries 1',
    'set net:timeout 10',
    'set net:reconnect-interval-base 5',
    'set net:reconnect-interval-multiplier 1',
    'open -u "username","password" "sftp://host:22"'
  ])
})

test('exec', (t) => {
  t.plan(24)

  const lftp = lftpInit()
  const baseCmd = lftp.baseCmd().join(';')
  lftp.cmds = ['cmd1', 'cmd2', 'cmd3']
  let spawn = mockSpawn()
  lftp.spawn = spawn

  let execPromise = lftp.exec()
  t.is(typeDetect(execPromise), 'Promise')
  t.is(spawn.calls.length, 1)
  t.is(spawn.calls[0].command, 'lftp')
  t.deepEqual(spawn.calls[0].args, ['-c', `${baseCmd};cmd1;cmd2;cmd3`])
  t.deepEqual(spawn.calls[0].opts, {})
  t.deepEqual(lftp.cmds, [])

  spawn = mockSpawn()
  lftp.spawn = spawn

  execPromise = lftp.exec('extraCmd')
  t.is(typeDetect(execPromise), 'Promise')
  t.is(spawn.calls.length, 1)
  t.is(spawn.calls[0].command, 'lftp')
  t.deepEqual(spawn.calls[0].args, ['-c', `${baseCmd};extraCmd`])
  t.deepEqual(spawn.calls[0].opts, {})
  t.deepEqual(lftp.cmds, [])

  spawn = mockSpawn()
  lftp.spawn = spawn

  execPromise = lftp.exec(['extraCmd1','extraCmd2'])
  t.is(typeDetect(execPromise), 'Promise')
  t.is(spawn.calls.length, 1)
  t.is(spawn.calls[0].command, 'lftp')
  t.deepEqual(spawn.calls[0].args, ['-c', `${baseCmd};extraCmd1;extraCmd2`])
  t.deepEqual(spawn.calls[0].opts, {})
  t.deepEqual(lftp.cmds, [])

  lftp.cmds = ['cmd1', 'cmd2', 'cmd3']
  lftp.spawnOptions = {cwd: 'cwd'}
  spawn = mockSpawn()
  lftp.spawn = spawn

  execPromise = lftp.exec()
  t.is(typeDetect(execPromise), 'Promise')
  t.is(spawn.calls.length, 1)
  t.is(spawn.calls[0].command, 'lftp')
  t.deepEqual(spawn.calls[0].args, ['-c', `${baseCmd};cmd1;cmd2;cmd3`])
  t.deepEqual(spawn.calls[0].opts, {cwd: 'cwd'})
  t.deepEqual(lftp.cmds, [])
})

test('raw', (t) => {
  t.plan(4)

  const lftp = lftpInit()
  let rawRes = lftp.raw(1)

  t.deepEqual(rawRes, lftp)
  t.deepEqual(lftp.cmds, [])

  rawRes = lftp.raw('test 1 2 3')
  t.deepEqual(rawRes, lftp)
  t.deepEqual(lftp.cmds, ['test 1 2 3'])
})

test('alias', (t) => {
  t.plan(7)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)

  lftp.alias()
  t.true(rawSpy.calledWith('alias'))
  t.false(_escapeShellSpy.called)

  lftp.alias('name')
  t.true(rawSpy.calledWith('alias name'))
  t.true(_escapeShellSpy.calledWith('name'))

  lftp.alias('name', 'value')
  t.true(rawSpy.calledWith('alias name value'))
  t.true(_escapeShellSpy.calledWith('name'))
  t.true(_escapeShellSpy.calledWith('value'))
})

test('at', (t) => {
  t.plan(3)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.at()
  t.true(failStub.calledWith('at() requires time argument'))

  lftp.at('time')
  t.true(rawSpy.calledWith('at time'))
  t.true(_escapeShellSpy.calledWith('time'))
})

test('attach', (t) => {
  t.plan(2)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.attach()
  t.true(failStub.calledWith('attach() requires pid argument'))

  lftp.attach('123')
  t.true(rawSpy.calledWith('attach 123'))
})

test('bookmark', (t) => {
  t.plan(17)

  const lftp = lftpInit()
  let rawSpy = rawSpyInit(lftp)
  let _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.bookmark()
  t.true(failStub.calledWith('bookmark() requires subCmd argument'))

  lftp.bookmark('add')
  t.true(failStub.calledWith('bookmark(add) opts argument requires name property'))

  lftp.bookmark('add', {name: 'name'})
  t.true(rawSpy.calledWith('bookmark add name'))
  t.true(_escapeShellSpy.calledWith('name'))

  lftp.bookmark('add', {name: 'name', loc: 'loc'})
  t.true(rawSpy.calledWith('bookmark add name loc'))
  t.true(_escapeShellSpy.calledWith('name'))
  t.true(_escapeShellSpy.calledWith('loc'))

  rawSpy.reset()
  _escapeShellSpy.reset()
  lftp.bookmark('del')
  t.true(failStub.calledWith('bookmark(del) opts argument requires name property'))

  lftp.bookmark('del', {name: 'name'})
  t.true(rawSpy.calledWith('bookmark del name'))
  t.true(_escapeShellSpy.calledWith('name'))

  _escapeShellSpy.reset()
  lftp.bookmark('edit')
  t.true(rawSpy.calledWith('bookmark edit'))
  t.false(_escapeShellSpy.called)

  rawSpy.reset()
  _escapeShellSpy.reset()
  lftp.bookmark('import')
  t.true(failStub.calledWith('bookmark(import) opts argument requires type property'))

  lftp.bookmark('import', {type: 'type'})
  t.true(rawSpy.calledWith('bookmark import type'))
  t.true(_escapeShellSpy.calledWith('type'))

  _escapeShellSpy.reset()
  lftp.bookmark('list')
  t.true(rawSpy.calledWith('bookmark list'))
  t.false(_escapeShellSpy.called)
})

test('cache', (t) => {
  t.plan(13)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.cache()
  t.true(failStub.calledWith('cache() requires subCmd argument'))

  lftp.cache('stat')
  t.true(rawSpy.calledWith('cache stat'))

  lftp.cache('on')
  t.true(rawSpy.calledWith('cache on'))

  lftp.cache('off')
  t.true(rawSpy.calledWith('cache off'))

  lftp.cache('flush')
  t.true(rawSpy.calledWith('cache flush'))

  rawSpy.reset()
  lftp.cache('size')
  t.true(failStub.calledWith('cache(size) opts argument requires lim property'))

  lftp.cache('size', {lim: 1})
  t.true(rawSpy.calledWith('cache size 1'))

  rawSpy.reset()
  lftp.cache('expire')
  t.true(failStub.calledWith('cache(expire) opts argument requires n and unit properties'))

  lftp.cache('expire', {n: 1})
  t.true(failStub.calledWith('cache(expire) opts argument requires n and unit properties'))

  lftp.cache('expire', {n: 1, unit: 's'})
  t.true(rawSpy.calledWith('cache expire 1s'))

  lftp.cache('expire', {n: 1, unit: 'm'})
  t.true(rawSpy.calledWith('cache expire 1m'))

  lftp.cache('expire', {n: 1, unit: 'h'})
  t.true(rawSpy.calledWith('cache expire 1h'))

  lftp.cache('expire', {n: 1, unit: 'd'})
  t.true(rawSpy.calledWith('cache expire 1d'))
})

test('cat', (t) => {
  t.plan(3)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.cat()
  t.true(failStub.calledWith('cat() requires path argument'))

  lftp.cat('dir/file.ext')
  t.true(rawSpy.calledWith('cat dir/file.ext'))
  t.true(_escapeShellSpy.calledWith('dir/file.ext'))
})

test('cd', (t) => {
  t.plan(3)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.cd()
  t.true(failStub.calledWith('cd() requires dir argument'))

  lftp.cd('dir/childDir')
  t.true(rawSpy.calledWith('cd dir/childDir'))
  t.true(_escapeShellSpy.calledWith('dir/childDir'))
})

test('chmod', (t) => {
  t.plan(7)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.chmod()
  t.true(failStub.calledWith('chmod() requires mode argument'))

  lftp.chmod('600')
  t.true(failStub.calledWith('chmod() requires files argument(s)'))

  lftp.chmod('600', 'file1.ext')
  t.true(rawSpy.calledWith('chmod 600 file1.ext'))
  t.true(_escapeShellSpy.calledWith('file1.ext'))

  lftp.chmod('600', 'file1.ext', 'file2.ext')
  t.true(rawSpy.calledWith('chmod 600 file1.ext file2.ext'))
  t.true(_escapeShellSpy.calledWith('file1.ext'))
  t.true(_escapeShellSpy.calledWith('file2.ext'))
})

test('close', (t) => {
  t.plan(2)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)

  lftp.close()
  t.true(rawSpy.calledWith('close'))

  lftp.close(true)
  t.true(rawSpy.calledWith('close -a'))
})

test('cls', (t) => {
  t.plan(3)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)

  lftp.cls()
  t.true(rawSpy.calledWith('cls'))

  lftp.cls({singleColumn: true})
  t.true(rawSpy.calledWith('cls -1'))

  lftp.cls({dirsFirst: true})
  t.true(rawSpy.calledWith('cls -D'))
})

test('command', (t) => {
  t.plan(3)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.command()
  t.true(failStub.calledWith('command() requires cmd argument'))

  lftp.command('echo')
  t.true(failStub.calledWith('command() requires args argument'))

  lftp.command('echo', 'test')
  t.true(rawSpy.calledWith('command echo test'))
})

test('debug', (t) => {
  t.plan(10)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.debug()
  t.true(failStub.calledWith('debug() requires level argument'))

  lftp.debug('fail')
  t.true(failStub.calledWith('debug() level argument must be a number or "off"'))

  lftp.debug(1)
  t.true(rawSpy.calledWith('debug 1'))

  lftp.debug('off')
  t.true(rawSpy.calledWith('debug off'))

  lftp.debug(1, {truncate: true})
  t.true(rawSpy.calledWith('debug -T 1'))

  lftp.debug(1, {outputFile: 'file.ext'})
  t.true(rawSpy.calledWith('debug -o file.ext 1'))
  t.true(_escapeShellSpy.calledWith('file.ext'))

  lftp.debug(1, {context: true})
  t.true(rawSpy.calledWith('debug -c 1'))

  lftp.debug(1, {pid: true})
  t.true(rawSpy.calledWith('debug -p 1'))

  lftp.debug(1, {timestamps: true})
  t.true(rawSpy.calledWith('debug -t 1'))
})

test('echo', (t) => {
  t.plan(2)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)

  lftp.echo('test')
  t.true(rawSpy.calledWith('echo test'))
  t.true(_escapeShellSpy.calledWith('test'))
})

test('edit', (t) => {
  t.plan(8)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.edit()
  t.true(failStub.calledWith('edit() requires file argument'))

  lftp.edit(1)
  t.true(failStub.calledWith('edit() file argument must be a string'))

  lftp.edit('file.ext')
  t.true(rawSpy.calledWith('edit file.ext'))
  t.true(_escapeShellSpy.calledWith('file.ext'))

  lftp.edit('file.ext', {keepTempFile: true})
  t.true(rawSpy.calledWith('edit -k file.ext'))
  t.true(_escapeShellSpy.calledWith('file.ext'))

  lftp.edit('file.ext', {tempFileLocation: 'dir'})
  t.true(rawSpy.calledWith('edit -o dir file.ext'))
  t.true(_escapeShellSpy.calledWith('file.ext'))
})

test('eval', (t) => {
  t.plan(3)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.eval()
  t.true(failStub.calledWith('eval() requires args argument'))

  lftp.eval('test')
  t.true(rawSpy.calledWith('eval test'))

  lftp.eval('test', {format: '4mat'})
  t.true(rawSpy.calledWith('eval -f 4mat test'))
})

test('exit', (t) => {
  t.plan(6)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.exit()
  t.true(failStub.calledWith('exit() requires subCmd argument'))

  lftp.exit('bg')
  t.true(rawSpy.calledWith('exit bg'))

  lftp.exit('top')
  t.true(rawSpy.calledWith('exit top'))

  lftp.exit('parent')
  t.true(rawSpy.calledWith('exit parent'))

  lftp.exit('kill')
  t.true(rawSpy.calledWith('exit kill'))

  lftp.exit('kill', {code: 9})
  t.true(rawSpy.calledWith('exit kill 9'))
})

test('fg', (t) => {
  t.plan(3)

  const lftp = lftpInit()
  const waitStub = sinon.stub(lftp, 'wait')

  lftp.fg()
  t.true(waitStub.called)

  lftp.fg(1)
  t.true(waitStub.calledWith(1))

  lftp.fg('all')
  t.true(waitStub.calledWith('all'))
})

test('find', (t) => {
  t.plan(8)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)

  lftp.find()
  t.true(rawSpy.calledWith('find'))
  t.false(_escapeShellSpy.called)

  lftp.find({maxScanDepth: 2})
  t.true(rawSpy.calledWith('find -d 2'))
  t.false(_escapeShellSpy.called)

  lftp.find({longListing: true})
  t.true(rawSpy.calledWith('find -l'))
  t.false(_escapeShellSpy.called)

  lftp.find({directory: 'dir'})
  t.true(rawSpy.calledWith('find dir'))
  t.true(_escapeShellSpy.calledWith('dir'))
})

test('get', (t) => {
  t.plan(17)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.get()
  t.true(failStub.calledWith('get() require remotePath argument'))

  lftp.get('remoteDir/file.ext')
  t.true(rawSpy.calledWith('get remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))

  lftp.get('remoteDir/file.ext', {continue: true})
  t.true(rawSpy.calledWith('get -c remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))

  lftp.get('remoteDir/file.ext', {deleteSrcOnSuccess: true})
  t.true(rawSpy.calledWith('get -E remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))

  lftp.get('remoteDir/file.ext', {deleteTargetBefore: true})
  t.true(rawSpy.calledWith('get -e remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))

  lftp.get('remoteDir/file.ext', {asciiMode: true})
  t.true(rawSpy.calledWith('get -a remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))

  lftp.get('remoteDir/file.ext', {base: 'baseDir'})
  t.true(rawSpy.calledWith('get -O baseDir remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('baseDir'))

  lftp.get('remoteDir/file.ext', {localPath: 'localDir/file.ext'})
  t.true(rawSpy.calledWith('get remoteDir/file.ext -o localDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('localDir/file.ext'))
})

test('get1', (t) => {
  t.plan(16)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const remoteFile = 'remoteDir/file.ext'
  const failStub = failStubInit(lftp)

  lftp.get1()
  t.true(failStub.calledWith('get1() requires remoteFile argument'))

  lftp.get1(remoteFile)
  t.true(rawSpy.calledWith(`get1 ${remoteFile}`))
  t.true(_escapeShellSpy.calledWith(remoteFile))

  lftp.get1(remoteFile, {destFileName: 'destFile.ext'})
  t.true(rawSpy.calledWith(`get1 -o destFile.ext ${remoteFile}`))
  t.true(_escapeShellSpy.calledWith(remoteFile))
  t.true(_escapeShellSpy.calledWith('destFile.ext'))

  lftp.get1(remoteFile, {continue: true})
  t.true(rawSpy.calledWith(`get1 -c ${remoteFile}`))
  t.true(_escapeShellSpy.calledWith(remoteFile))

  lftp.get1(remoteFile, {deleteSrcOnSuccess: true})
  t.true(rawSpy.calledWith(`get1 -E ${remoteFile}`))
  t.true(_escapeShellSpy.calledWith(remoteFile))

  lftp.get1(remoteFile, {asciiMode: true})
  t.true(rawSpy.calledWith(`get1 -a ${remoteFile}`))
  t.true(_escapeShellSpy.calledWith(remoteFile))

  lftp.get1(remoteFile, {srcRegion: '2-10'})
  t.true(rawSpy.calledWith(`get1 --source-region=2-10 ${remoteFile}`))
  t.true(_escapeShellSpy.calledWith(remoteFile))

  lftp.get1(remoteFile, {targetPos: 2})
  t.true(rawSpy.calledWith(`get1 --target-position=2 ${remoteFile}`))
  t.true(_escapeShellSpy.calledWith(remoteFile))
})

test('glob', (t) => {
  t.plan(18)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  let command = 'echo'
  const patterns = '*'
  const failStub = failStubInit(lftp)

  lftp.glob()
  t.true(failStub.calledWith('glob() requires patterns argument'))

  lftp.glob(patterns)
  t.true(failStub.calledWith('glob() opts argument requires exist, notExist, and/or command properties'))

  lftp.glob(patterns, {command: command})
  t.true(rawSpy.calledWith(`glob ${command} ${patterns}`))
  t.true(_escapeShellSpy.calledWith(patterns))

  lftp.glob(patterns, {command: command, plainFiles: true})
  t.true(rawSpy.calledWith(`glob -f ${command} ${patterns}`))
  t.true(_escapeShellSpy.calledWith(patterns))

  lftp.glob(patterns, {command: command, directories: true})
  t.true(rawSpy.calledWith(`glob -d ${command} ${patterns}`))
  t.true(_escapeShellSpy.calledWith(patterns))

  lftp.glob(patterns, {command: command, allTypes: true})
  t.true(rawSpy.calledWith(`glob -a ${command} ${patterns}`))
  t.true(_escapeShellSpy.calledWith(patterns))

  lftp.glob(patterns, {exist: true})
  t.true(rawSpy.calledWith(`glob --exist ${patterns}`))
  t.true(_escapeShellSpy.calledWith(patterns))

  lftp.glob(patterns, {notExist: true})
  t.true(rawSpy.calledWith(`glob --not-exist ${patterns}`))
  t.true(_escapeShellSpy.calledWith(patterns))

  command = 'echo "TEST"'

  lftp.glob(patterns, {command: command, exist: true})
  t.true(rawSpy.calledWith(`glob --exist ${patterns} && ${command}`))
  t.true(_escapeShellSpy.calledWith(patterns))

  lftp.glob(patterns, {command: command, notExist: true})
  t.true(rawSpy.calledWith(`glob --not-exist ${patterns} && ${command}`))
  t.true(_escapeShellSpy.calledWith(patterns))
})

test('help', (t) => {
  t.plan(2)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)

  lftp.help()
  t.true(rawSpy.calledWith('help'))

  lftp.help({command: 'get'})
  t.true(rawSpy.calledWith('help get'))
})

test('jobs', (t) => {
  t.plan(8)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)

  lftp.jobs()
  t.true(rawSpy.calledWith('jobs'))

  lftp.jobs({verbosity: 0})
  t.true(rawSpy.calledWith('jobs'))

  lftp.jobs({verbosity: 1})
  t.true(rawSpy.calledWith('jobs -v'))

  lftp.jobs({verbosity: 2})
  t.true(rawSpy.calledWith('jobs -vv'))

  lftp.jobs({verbosity: 3})
  t.true(rawSpy.calledWith('jobs -vvv'))

  lftp.jobs({verbosity: 4})
  t.true(rawSpy.calledWith('jobs'))

  lftp.jobs({notRecursive: true})
  t.true(rawSpy.calledWith('jobs -r'))

  lftp.jobs({jobNumber: 123})
  t.true(rawSpy.calledWith('jobs 123'))
})

test('kill', (t) => {
  t.plan(2)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)

  lftp.kill()
  t.true(rawSpy.calledWith('kill'))

  lftp.kill({jobNumber: 123})
  t.true(rawSpy.calledWith('kill 123'))
})

test('lcd', (t) => {
  t.plan(4)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)

  lftp.lcd('dir/childDir')
  t.true(rawSpy.calledWith('lcd dir/childDir'))
  t.true(_escapeShellSpy.calledWith('dir/childDir'))

  lftp.lcd('-')
  t.true(rawSpy.calledWith('lcd -'))
  t.true(_escapeShellSpy.calledWith('-'))
})

test('ln', (t) => {
  t.plan(8)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.ln()
  t.true(failStub.calledWith('ln() requires existingFile argument'))

  lftp.ln('dir/existingFile')
  t.true(failStub.calledWith('ln() requires newLink argument'))

  lftp.ln('dir/existingFile', 'anotherDir/newLink')
  t.true(rawSpy.calledWith('ln dir/existingFile anotherDir/newLink'))
  t.true(_escapeShellSpy.calledWith('dir/existingFile'))
  t.true(_escapeShellSpy.calledWith('anotherDir/newLink'))

  lftp.ln('dir/existingFile', 'anotherDir/newLink', {symbolic: true})
  t.true(rawSpy.calledWith('ln -s dir/existingFile anotherDir/newLink'))
  t.true(_escapeShellSpy.calledWith('dir/existingFile'))
  t.true(_escapeShellSpy.calledWith('anotherDir/newLink'))
})

test('local', (t) => {
  t.plan(2)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.local()
  t.true(failStub.calledWith('local() requires command argument'))

  lftp.local('pwd')
  t.true(rawSpy.calledWith('local pwd'))
})

test('lpwd', (t) => {
  t.plan(1)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  lftp.lpwd()
  t.true(rawSpy.calledWith('lpwd'))
})

test('ls', (t) => {
  t.plan(1)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  lftp.ls()
  t.true(rawSpy.calledWith('ls'))
})

test('pwd', (t) => {
  t.plan(1)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  lftp.pwd()
  t.true(rawSpy.calledWith('pwd'))
})

test('put', (t) => {
  t.plan(6)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.put()
  t.true(failStub.calledWith('put() requires localPath argument'))

  lftp.put('localDir/file.ext')
  t.true(rawSpy.calledWith('put localDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('localDir/file.ext'))

  lftp.put('localDir/file.ext', {remotePath: 'remoteDir/file.ext'})
  t.true(rawSpy.calledWith('put localDir/file.ext -o remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('localDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))
})

test('mv', (t) => {
  t.plan(5)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.mv()
  t.true(failStub.calledWith('mv() requires src argument'))

  lftp.mv('srcDir/file.ext')
  t.true(failStub.calledWith('mv() requires dest argument'))

  lftp.mv('srcDir/file.ext', 'destDir/file.ext')
  t.true(rawSpy.calledWith('mv srcDir/file.ext destDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('srcDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('destDir/file.ext'))
})

test('rm', (t) => {
  t.plan(6)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.rm()
  t.true(failStub.calledWith('rm() requires files argument(s)'))

  lftp.rm('file1.ext')
  t.true(rawSpy.calledWith('rm file1.ext'))
  t.true(_escapeShellSpy.calledWith('file1.ext'))

  lftp.rm('file1.ext', 'file2.ext')
  t.true(rawSpy.calledWith('rm file1.ext file2.ext'))
  t.true(_escapeShellSpy.calledWith('file1.ext'))
  t.true(_escapeShellSpy.calledWith('file2.ext'))
})

test('rmdir', (t) => {
  t.plan(6)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.rmdir()
  t.true(failStub.calledWith('rmdir() requires directories argument(s)'))

  lftp.rmdir('dir1')
  t.true(rawSpy.calledWith('rmdir dir1'))
  t.true(_escapeShellSpy.calledWith('dir1'))

  lftp.rmdir('dir1', 'dir2')
  t.true(rawSpy.calledWith('rmdir dir1 dir2'))
  t.true(_escapeShellSpy.calledWith('dir1'))
  t.true(_escapeShellSpy.calledWith('dir2'))
})

test('mirror', (t) => {
  t.plan(21)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.mirror()
  t.true(failStub.calledWith('mirror() requires remoteDir argument'))

  lftp.mirror('remoteDir')
  t.true(rawSpy.calledWith('mirror remoteDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))

  lftp.mirror('remoteDir', {localDir: 'localDir'})
  t.true(rawSpy.calledWith('mirror remoteDir localDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))
  t.true(_escapeShellSpy.calledWith('localDir'))

  lftp.mirror('remoteDir', {localDir: 'localDir', queue: true})
  t.true(rawSpy.calledWith('queue mirror remoteDir localDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))
  t.true(_escapeShellSpy.calledWith('localDir'))

  lftp.mirror('remoteDir', {upload: true})
  t.true(failStub.calledWith('mirror(opts = {upload: true}) opts argument requires localDir property'))

  lftp.mirror('remoteDir', {localDir: 'localDir', upload: true})
  t.true(rawSpy.calledWith('mirror --reverse localDir remoteDir'))
  t.true(_escapeShellSpy.calledWith('localDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))

  lftp.mirror('remoteDir', {parallel: 4})
  t.true(rawSpy.calledWith('mirror --parallel=4 remoteDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))

  lftp.mirror('remoteDir', {filter: 'balls'})
  t.true(rawSpy.calledWith('mirror --include=\'balls\' remoteDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))

  lftp.mirror('remoteDir', {pget: 8})
  t.true(rawSpy.calledWith('mirror --use-pget-n=8 remoteDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))

  lftp.mirror('remoteDir', {options: '--continue'})
  t.true(rawSpy.calledWith('mirror --continue remoteDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))
})

test('pget', (t) => {
  t.plan(10)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const failStub = failStubInit(lftp)

  lftp.pget()
  t.true(failStub.calledWith('pget() requires remotePath argument'))

  lftp.pget('remoteDir/file.ext')
  t.true(rawSpy.calledWith('pget -n 4 remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))

  lftp.pget('remoteDir/file.ext', {n: 8})
  t.true(rawSpy.calledWith('pget -n 8 remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))

  lftp.pget('remoteDir/file.ext', {localPath: 'localDir/file.ext'})
  t.true(rawSpy.calledWith('pget -n 4 remoteDir/file.ext -o localDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('localDir/file.ext'))

  lftp.pget('remoteDir/file.ext', {queue: true})
  t.true(rawSpy.calledWith('queue pget -n 4 remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))
})

test('wait', (t) => {
  t.plan(3)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)

  lftp.wait()
  t.true(rawSpy.calledWith('wait'))

  lftp.wait(1)
  t.true(rawSpy.calledWith('wait 1'))

  lftp.wait('all')
  t.true(rawSpy.calledWith('wait all'))
})
