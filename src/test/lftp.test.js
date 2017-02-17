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

test('validateOptions', (t) => {
  t.plan(4)

  const lftp = lftpInit()
  const failSpy = sinon.spy()
  lftp.fail = failSpy

  lftp.validateOptions({})
  t.true(failSpy.calledWith('LFTP opts must include host'))

  lftp.validateOptions({host: 'host'})
  t.true(failSpy.calledWith('LFTP opts must include username'))

  lftp.validateOptions({host: 'host', username: 'username'})
  t.true(failSpy.calledWith('LFTP opts must include password'))

  lftp.validateOptions({
    host: 'host', username: 'username', password: 'password', protocol: 'ftsp'
  })
  t.true(failSpy.calledWith('LFTP opts.protocol must be ftp, sftp, or ftps.'))
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
  t.plan(1)

  const lftp = lftpInit()
  const escapeShellStub = sinon.stub(lftp, 'escapeShell')
  lftp._escapeShell('')
  t.true(escapeShellStub.called)
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
  t.plan(12)

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
  t.plan(4)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)

  lftp.at()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.at('time')
  t.true(rawSpy.calledWith('at time'))
  t.true(_escapeShellSpy.calledWith('time'))
})

test('attach', (t) => {
  t.plan(2)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)

  lftp.attach()
  t.false(rawSpy.called)

  lftp.attach('123')
  t.true(rawSpy.calledWith('attach 123'))
})

test('bookmark', (t) => {
  t.plan(21)

  const lftp = lftpInit()
  let rawSpy = rawSpyInit(lftp)
  let _escapeShellSpy = _escapeShellSpyInit(lftp)

  lftp.bookmark()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.bookmark('add')
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

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
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

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
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

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

  lftp.cache()
  t.false(rawSpy.called)

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
  t.false(rawSpy.called)

  lftp.cache('size', {lim: 1})
  t.true(rawSpy.calledWith('cache size 1'))

  rawSpy.reset()
  lftp.cache('expire')
  t.false(rawSpy.called)

  lftp.cache('expire', {n: 1})
  t.false(rawSpy.called)

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
  t.plan(4)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)

  lftp.cat()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.cat('dir/file.ext')
  t.true(rawSpy.calledWith('cat dir/file.ext'))
  t.true(_escapeShellSpy.calledWith('dir/file.ext'))
})

test('cd', (t) => {
  t.plan(4)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)

  lftp.cd()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.cd('dir/childDir')
  t.true(rawSpy.calledWith('cd dir/childDir'))
  t.true(_escapeShellSpy.calledWith('dir/childDir'))
})

test('chmod', (t) => {
  t.plan(9)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)

  lftp.chmod()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.chmod('600')
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

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

  lftp.edit()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

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
  t.plan(18)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)

  lftp.get()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

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
  t.plan(17)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  const remoteFile = 'remoteDir/file.ext'

  lftp.get1()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

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
  t.plan(20)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  let command = 'echo'
  const patterns = '*'

  lftp.glob()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.glob(patterns)
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

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
  t.plan(10)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)

  lftp.ln()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.ln('dir/existingFile')
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

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
  lftp.local()
  t.false(rawSpy.called)

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
  t.plan(7)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  lftp.put()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.put('localDir/file.ext')
  t.true(rawSpy.calledWith('put localDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('localDir/file.ext'))

  lftp.put('localDir/file.ext', 'remoteDir/file.ext')
  t.true(rawSpy.calledWith('put localDir/file.ext -o remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('localDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))
})

test('mv', (t) => {
  t.plan(7)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  lftp.mv()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.mv('srcDir/file.ext')
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.mv('srcDir/file.ext', 'destDir/file.ext')
  t.true(rawSpy.calledWith('mv srcDir/file.ext destDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('srcDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('destDir/file.ext'))
})

test('rm', (t) => {
  t.plan(7)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  lftp.rm()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.rm('file1.ext')
  t.true(rawSpy.calledWith('rm file1.ext'))
  t.true(_escapeShellSpy.calledWith('file1.ext'))

  lftp.rm('file1.ext', 'file2.ext')
  t.true(rawSpy.calledWith('rm file1.ext file2.ext'))
  t.true(_escapeShellSpy.calledWith('file1.ext'))
  t.true(_escapeShellSpy.calledWith('file2.ext'))
})

test('rmdir', (t) => {
  t.plan(7)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  lftp.rmdir()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.rmdir('dir1')
  t.true(rawSpy.calledWith('rmdir dir1'))
  t.true(_escapeShellSpy.calledWith('dir1'))

  lftp.rmdir('dir1', 'dir2')
  t.true(rawSpy.calledWith('rmdir dir1 dir2'))
  t.true(_escapeShellSpy.calledWith('dir1'))
  t.true(_escapeShellSpy.calledWith('dir2'))
})

test('mirror', (t) => {
  t.plan(25)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  lftp.mirror()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.mirror('remoteDir')
  t.true(rawSpy.calledWith('mirror remoteDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))

  lftp.mirror('remoteDir', 'localDir')
  t.true(rawSpy.calledWith('mirror remoteDir localDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))
  t.true(_escapeShellSpy.calledWith('localDir'))

  lftp.mirror('remoteDir', 'localDir', {queue: true})
  t.true(rawSpy.calledWith('queue mirror remoteDir localDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))
  t.true(_escapeShellSpy.calledWith('localDir'))

  lftp.mirror('remoteDir', 'localDir', {upload: true})
  t.true(rawSpy.calledWith('mirror --reverse localDir remoteDir'))
  t.true(_escapeShellSpy.calledWith('localDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))

  lftp.mirror('remoteDir', 'localDir', {parallel: 4})
  t.true(rawSpy.calledWith('mirror --parallel=4 remoteDir localDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))
  t.true(_escapeShellSpy.calledWith('localDir'))

  lftp.mirror('remoteDir', 'localDir', {filter: 'balls'})
  t.true(rawSpy.calledWith('mirror --include=\'balls\' remoteDir localDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))
  t.true(_escapeShellSpy.calledWith('localDir'))

  lftp.mirror('remoteDir', 'localDir', {pget: 8})
  t.true(rawSpy.calledWith('mirror --use-pget-n=8 remoteDir localDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))
  t.true(_escapeShellSpy.calledWith('localDir'))

  lftp.mirror('remoteDir', 'localDir', {options: '--continue'})
  t.true(rawSpy.calledWith('mirror --continue remoteDir localDir'))
  t.true(_escapeShellSpy.calledWith('remoteDir'))
  t.true(_escapeShellSpy.calledWith('localDir'))
})

test('pget', (t) => {
  t.plan(12)

  const lftp = lftpInit()
  const rawSpy = rawSpyInit(lftp)
  const _escapeShellSpy = _escapeShellSpyInit(lftp)
  lftp.pget()
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.pget(8)
  t.false(rawSpy.called)
  t.false(_escapeShellSpy.called)

  lftp.pget(8, 'remoteDir/file.ext')
  t.true(rawSpy.calledWith('pget -n 8 remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))

  lftp.pget(8, 'remoteDir/file.ext', 'localDir/file.ext')
  t.true(rawSpy.calledWith('pget -n 8 remoteDir/file.ext -o localDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('localDir/file.ext'))

  lftp.pget(8, 'remoteDir/file.ext', 'localDir/file.ext', {queue: true})
  t.true(rawSpy.calledWith('queue pget -n 8 remoteDir/file.ext -o localDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('remoteDir/file.ext'))
  t.true(_escapeShellSpy.calledWith('localDir/file.ext'))
})
