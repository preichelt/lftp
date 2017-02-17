import _includes from 'lodash/includes'
import _map from 'lodash/map'
import _inRange from 'lodash/inRange'
import _times from 'lodash/times'
import cp from 'child_process'
import typeDetect from 'type-detect'

export class LFTP {
  constructor(opts) {
    this.validateOptions(opts)

    const protocol = (opts.protocol || 'sftp').toLowerCase()
    const port = opts.port || 22
    const host = `${protocol}://${opts.host}:${port}`

    this.options = {
      host: host,
      username: opts.username,
      password: opts.password || '',
      protocol: protocol,
      escape: opts.hasOwnProperty('escape') ? opts.escape : true,
      retries: opts.retries || 1,
      timeout: opts.timeout || 10,
      retryInterval: opts.retryInterval || 5,
      retryIntervalMultiplier: opts.retryIntervalMultiplier || 1,
      autoConfirm: opts.hasOwnProperty('autoConfirm') ? opts.autoConfirm : false
    }

    this.spawn = cp.spawn
    this.spawnOptions = {}

    if(opts.hasOwnProperty('cwd')) {
      this.spawnOptions.cwd = opts.cwd
    }

    this.cmds = []
  }

  fail(msg) {
    throw new Error(msg)
  }

  validateOptions(opts) {
    if(!opts.hasOwnProperty('host')) {
      this.fail('LFTP opts must include host')
    }

    if(!opts.hasOwnProperty('username')) {
      this.fail('LFTP opts must include username')
    }

    const requiresPassword = opts.requiresPassword || true
    if(requiresPassword && !opts.hasOwnProperty('password')) {
      this.fail('LFTP opts must include password')
    }

    const acceptableProtocols = ['ftp', 'sftp', 'ftps']
    if(opts.hasOwnProperty('protocol') &&
       !_includes(acceptableProtocols, opts.protocol)) {

      this.fail('LFTP opts.protocol must be ftp, sftp, or ftps.')
    }
  }

  escapeShell(cmd) {
    if(typeDetect(cmd) !== 'string') {
      return ''
    }

    return cmd.replace(/(["\s'$`\[\]\\])/g,'\\$1')
  }

  _escapeShell(cmd) {
    if(this.options.escape) {
      return this.escapeShell(cmd)
    }

    return cmd
  }

  baseCmd() {
    const cmd = []

    if(this.options.protocol === 'sftp' && this.options.autoConfirm) {
      cmd.push('set sftp:auto-confirm yes')
    }

    cmd.push(`set net:max-retries ${this.options.retries}`)
    cmd.push(`set net:timeout ${this.options.timeout}`)
    cmd.push(`set net:reconnect-interval-base ${this.options.retryInterval}`)

    cmd.push(`set net:reconnect-interval-multiplier ${
      this.options.retryIntervalMultiplier
    }`)

    cmd.push(`open -u "${
      this._escapeShell(this.options.username)
    }","${
      this._escapeShell(this.options.password)
    }" "${
      this.options.host
    }"`)

    return cmd
  }

  exec(extraCmds) {
    const cmd = this.baseCmd()

    if(typeDetect(extraCmds) === 'string') {
      cmd.push(extraCmds)
    } else if(Array.isArray(extraCmds)) {
      cmd.push(...extraCmds)
    }

    cmd.push(...this.cmds)
    this.cmds = []
    const cmdString = cmd.join(';')
    const lftp = this.spawn('lftp', ['-c', cmdString], this.spawnOptions)

    return new Promise((resolve, reject) => {
      const stdout = []
      const stderr = []

      lftp.stdout.on('data', (res) => {
        stdout.push(res)
      })

      lftp.stderr.on('data', (res) => {
        stderr.push(res)
      })

      lftp.on('error', () => reject({error: stderr.join('')}))
      lftp.on('close', () => resolve({
        error: stderr.join(''),
        data: stdout.join('')
      }))
    })
  }

  raw(cmd) {
    if(typeDetect(cmd) === 'string') {
      this.cmds.push(cmd)
    }

    return this
  }

  alias(name, value) {
    if(!name) {
      return this.raw('alias')
    }

    if(!value) {
      return this.raw(`alias ${this._escapeShell(name)}`)
    }

    return this.raw(`alias ${
      this._escapeShell(name)
    } ${
      this._escapeShell(value)
    }`)
  }

  at(time) {
    if(!time) {
      return this
    }

    return this.raw(`at ${this._escapeShell(time)}`)
  }

  attach(pid) {
    if(!pid) {
      return this
    }

    return this.raw(`attach ${pid}`)
  }

  bookmark(subCMD, opts = {}) {
    const cmd = ['bookmark']

    switch(subCMD) {
      case 'add':
        if(opts.hasOwnProperty('name')) {
          cmd.push(`add ${this._escapeShell(opts.name)}`)

          if(opts.hasOwnProperty('loc')) {
            cmd.push(this._escapeShell(opts.loc))
          }
        }

        break
      case 'del':
        if(opts.hasOwnProperty('name')) {
          cmd.push(`del ${this._escapeShell(opts.name)}`)
        }

        break
      case 'edit':
        cmd.push('edit')

        break
      case 'import':
        if(opts.hasOwnProperty('type')) {
          cmd.push(`import ${this._escapeShell(opts.type)}`)
        }

        break
      case 'list':
        cmd.push('list')

        break
    }

    if(cmd.length === 1) {
      return this
    }

    return this.raw(cmd.join(' '))
  }

  cache(subCMD, opts = {}) {
    const cmd = ['cache']

    switch(subCMD) {
      case 'stat':
      case 'on':
      case 'off':
      case 'flush':
        cmd.push(subCMD)

        break
      case 'size':
        if(opts.hasOwnProperty('lim')) {
          cmd.push(`size ${opts.lim}`)
        }

        break
      case 'expire':
        const acceptableUnits = ['s', 'm', 'h', 'd']

        if( opts.hasOwnProperty('n') &&
            opts.hasOwnProperty('unit') &&
            _includes(acceptableUnits, opts.unit) ) {

          cmd.push(`expire ${opts.n}${opts.unit}`)
        }

        break
    }

    if(cmd.length === 1) {
      return this
    }

    return this.raw(cmd.join(' '))
  }

  cat(path) {
    if(!path) {
      return this
    }

    return this.raw(`cat ${this._escapeShell(path)}`)
  }

  cd(dir) {
    if(!dir) {
      return this
    }

    return this.raw(`cd ${this._escapeShell(dir)}`)
  }

  chmod(mode, ...files) {
    if(!mode || files.length === 0) {
      return this
    }

    return this.raw(`chmod ${mode} ${
      _map(files, this._escapeShell.bind(this)).join(' ')
    }`)
  }

  close(all = false) {
    const cmd = ['close']

    if(all) {
      cmd.push('-a')
    }

    return this.raw(cmd.join(' '))
  }

  cls(opts = {}) {
    const cmd = ['cls']

    const singleColumn = opts.hasOwnProperty('singleColumn') &&
      opts.singleColumn

    if(singleColumn) {
      cmd.push('-1')
    }

    const dirsFirst = opts.hasOwnProperty('dirsFirst') && opts.dirsFirst
    if(dirsFirst) {
      cmd.push('-D')
    }

    const cmdString = cmd.join(' ')
    return this.raw(cmdString)
  }

  // NOTE: NEED TO IMPLEMENT
  // debug(opts = {}) {
  //
  // }

  echo(str) {
    return this.raw(`echo ${this._escapeShell(str)}`)
  }

  edit(file, opts = {}) {
    const cmd = ['edit']

    if(!file && typeDetect(file) !== 'string') {
      return this
    }

    if(opts.hasOwnProperty('keepTempFile') && opts.keepTempFile) {
      cmd.push('-k')
    }

    if(opts.hasOwnProperty('tempFileLocation')) {
      cmd.push(`-o ${opts.tempFileLocation}`)
    }

    cmd.push(this._escapeShell(file))

    return this.raw(cmd.join(' '))
  }

  // NOTE: NEED TO IMPLEMENT
  // eval() {
  //
  // }

  // NOTE: NEED TO IMPLEMENT
  // exit() {
  //
  // }

  // NOTE: NEED TO IMPLEMENT
  // fg() {
  //
  // }

  find(opts = {}) {
    const cmd = ['find']

    if(opts.hasOwnProperty('maxScanDepth')) {
      cmd.push(`-d ${opts.maxScanDepth}`)
    }

    if(opts.hasOwnProperty('longListing') && opts.longListing) {
      cmd.push('-l')
    }

    if(opts.hasOwnProperty('directory')) {
      cmd.push(this._escapeShell(opts.directory))
    }

    return this.raw(cmd.join(' '))
  }

  get(remotePath, opts = {}) {
    if(!remotePath) {
      return this
    }

    const cmd = ['get']

    if(opts.hasOwnProperty('continue') && opts.continue) {
      cmd.push('-c')
    }

    if(opts.hasOwnProperty('deleteSrcOnSuccess') && opts.deleteSrcOnSuccess) {
      cmd.push('-E')
    }

    if(opts.hasOwnProperty('deleteTargetBefore') && opts.deleteTargetBefore) {
      cmd.push('-e')
    }

    if(opts.hasOwnProperty('asciiMode') && opts.asciiMode) {
      cmd.push('-a')
    }

    if(opts.hasOwnProperty('base')) {
      cmd.push(`-O ${this._escapeShell(opts.base)}`)
    }

    cmd.push(this._escapeShell(remotePath))

    if(opts.hasOwnProperty('localPath')) {
      cmd.push(`-o ${this._escapeShell(opts.localPath)}`)
    }

    return this.raw(cmd.join(' '))
  }

  get1(remoteFile, opts = {}) {
    if(!remoteFile) {
      return this
    }

    const cmd = ['get1']

    if(opts.hasOwnProperty('destFileName')) {
      cmd.push(`-o ${this._escapeShell(opts.destFileName)}`)
    }

    if(opts.hasOwnProperty('continue') && opts.continue) {
      cmd.push('-c')
    }

    if(opts.hasOwnProperty('deleteSrcOnSuccess') && opts.deleteSrcOnSuccess) {
      cmd.push('-E')
    }

    if(opts.hasOwnProperty('asciiMode') && opts.asciiMode) {
      cmd.push('-a')
    }

    if(opts.hasOwnProperty('srcRegion')) {
      cmd.push(`--source-region=${opts.srcRegion}`)
    }

    if(opts.hasOwnProperty('targetPos')) {
      cmd.push(`--target-position=${opts.targetPos}`)
    }

    cmd.push(this._escapeShell(remoteFile))

    return this.raw(cmd.join(' '))
  }

  glob(patterns, opts = {}) {
    if(!patterns) {
      return this
    }

    const cmd = ['glob']

    if(opts.hasOwnProperty('plainFiles') && opts.plainFiles) {
      cmd.push('-f')
    }

    if(opts.hasOwnProperty('directories') && opts.directories) {
      cmd.push('-d')
    }

    if(opts.hasOwnProperty('allTypes') && opts.allTypes) {
      cmd.push('-a')
    }

    let existanceSpecified = false

    if(opts.hasOwnProperty('exist') && opts.exist) {
      cmd.push(`--exist ${this._escapeShell(patterns)}`)
      existanceSpecified = true
    }

    if(opts.hasOwnProperty('notExist') && opts.notExist) {
      cmd.push(`--not-exist ${this._escapeShell(patterns)}`)
      existanceSpecified = true
    }

    const commandSpecified = opts.hasOwnProperty('command') ? true : false

    if(existanceSpecified && commandSpecified) {
      cmd.push(`&& ${opts.command}`)
    } else if(!existanceSpecified && commandSpecified) {
      cmd.push(opts.command)
      cmd.push(this._escapeShell(patterns))
    } else if(!existanceSpecified && !commandSpecified) {
      return this
    }

    return this.raw(cmd.join(' '))
  }

  help(opts = {}) {
    const cmd = ['help']

    if(opts.hasOwnProperty('command')) {
      cmd.push(opts.command)
    }

    return this.raw(cmd.join(' '))
  }

  jobs(opts = {}) {
    const cmd = ['jobs']

    if(opts.hasOwnProperty('verbosity') && _inRange(opts.verbosity, 1, 4)) {
      cmd.push(`-${_times(opts.verbosity, () => { return 'v' }).join('')}`)
    }

    if(opts.hasOwnProperty('notRecursive') && opts.notRecursive) {
      cmd.push('-r')
    }

    if(opts.hasOwnProperty('jobNumber')) {
      cmd.push(opts.jobNumber)
    }

    return this.raw(cmd.join(' '))
  }

  kill(opts = {}){
    const cmd = ['kill']

    if(opts.hasOwnProperty('jobNumber')) {
      cmd.push(opts.jobNumber)
    }

    return this.raw(cmd.join(' '))
  }

  lcd(dir) {
    return this.raw(`lcd ${this._escapeShell(dir)}`)
  }

  ln(existingFile, newLink, opts = {}) {
    if(!existingFile || !newLink) {
      return this
    }

    const cmd = ['ln']

    if(opts.hasOwnProperty('symbolic') && opts.symbolic) {
      cmd.push('-s')
    }

    cmd.push(this._escapeShell(existingFile))
    cmd.push(this._escapeShell(newLink))

    return this.raw(cmd.join(' '))
  }

  local(command) {
    if(!command) {
      return this
    }

    return this.raw(`local ${command}`)
  }

  lpwd() {
    return this.raw('lpwd')
  }

  ls() {
    return this.raw('ls')
  }

  pwd() {
    return this.raw('pwd')
  }

  put(localPath, remotePath) {
    if(!localPath) {
      return this
    }

    if(!remotePath) {
      return this.raw(`put ${this._escapeShell(localPath)}`)
    }

    return this.raw(`put ${
      this._escapeShell(localPath)
    } -o ${
      this._escapeShell(remotePath)
    }`)
  }

  mv(src, dest) {
    if(!src || !dest) {
      return this
    }

    return this.raw(`mv ${this._escapeShell(src)} ${this._escapeShell(dest)}`)
  }

  rm(...files) {
    if(files.length === 0){
      return this
    }

    return this.raw(`rm ${
      _map(files, this._escapeShell.bind(this)).join(' ')
    }`)
  }

  rmdir(...directories) {
    if(directories.length === 0){
      return this
    }

    return this.raw(`rmdir ${
      _map(directories, this._escapeShell.bind(this)).join(' ')
    }`)
  }

  mirror(remoteDir, localDir, opts = {}) {
    const upload = opts.hasOwnProperty('upload') && opts.upload

    if(!remoteDir || (upload && !localDir)) {
      return this
    }

    const queue = opts.hasOwnProperty('queue') && opts.queue
    const cmd = queue ? ['queue mirror'] : ['mirror']

    if(upload) {
      cmd.push('--reverse')
    }

    if(opts.hasOwnProperty('parallel')) {
      cmd.push(`--parallel=${opts.parallel}`)
    }

    if(opts.hasOwnProperty('filter')) {
      cmd.push(`--include='${opts.filter}'`)
    }

    if(opts.hasOwnProperty('pget')) {
      cmd.push(`--use-pget-n=${opts.pget}`)
    }

    if(opts.hasOwnProperty('options')) {
      cmd.push(opts.options)
    }

    if(upload) {
      cmd.push(`${this._escapeShell(localDir)} ${this._escapeShell(remoteDir)}`)
    } else if(!localDir) {
      cmd.push(`${this._escapeShell(remoteDir)}`)
    } else {
      cmd.push(`${this._escapeShell(remoteDir)} ${this._escapeShell(localDir)}`)
    }

    const cmdString = cmd.join(' ')
    return this.raw(cmdString)
  }

  pget(n, remotePath, localPath, opts = {}) {
    if(!n || !remotePath) {
      return this
    }

    const queue = opts.hasOwnProperty('queue') && opts.queue
    const cmd = queue ? ['queue pget'] : ['pget']
    cmd.push(`-n ${n}`)
    cmd.push(`${this._escapeShell(remotePath)}`)

    if(localPath) {
      cmd.push(`-o ${this._escapeShell(localPath)}`)
    }

    const cmdString = cmd.join(' ')
    return this.raw(cmdString)
  }
}
