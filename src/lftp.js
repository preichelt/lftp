import _includes from 'lodash/includes'
import _map from 'lodash/map'
import _inRange from 'lodash/inRange'
import _times from 'lodash/times'
import _last from 'lodash/last'
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
      this.fail('at() requires time argument')
    } else {
      return this.raw(`at ${this._escapeShell(time)}`)
    }
  }

  attach(pid) {
    if(!pid) {
      this.fail('attach() requires pid argument')
    } else {
      return this.raw(`attach ${pid}`)
    }
  }

  bookmark(subCmd, opts = {}) {
    const cmd = ['bookmark']

    switch(subCmd) {
      case 'add':
        if(opts.hasOwnProperty('name')) {
          cmd.push(`add ${this._escapeShell(opts.name)}`)

          if(opts.hasOwnProperty('loc')) {
            cmd.push(this._escapeShell(opts.loc))
          }
        } else {
          this.fail('bookmark(add) opts argument requires name property')
        }

        break
      case 'del':
        if(opts.hasOwnProperty('name')) {
          cmd.push(`del ${this._escapeShell(opts.name)}`)
        } else {
          this.fail('bookmark(del) opts argument requires name property')
        }

        break
      case 'edit':
        cmd.push('edit')

        break
      case 'import':
        if(opts.hasOwnProperty('type')) {
          cmd.push(`import ${this._escapeShell(opts.type)}`)
        } else {
          this.fail('bookmark(import) opts argument requires type property')
        }

        break
      case 'list':
        cmd.push('list')

        break
      default:
        this.fail('bookmark() requires subCmd argument')
    }

    return this.raw(cmd.join(' '))
  }

  cache(subCmd, opts = {}) {
    const cmd = ['cache']

    switch(subCmd) {
      case 'stat':
      case 'on':
      case 'off':
      case 'flush':
        cmd.push(subCmd)

        break
      case 'size':
        if(opts.hasOwnProperty('lim')) {
          cmd.push(`size ${opts.lim}`)
        } else {
          this.fail('cache(size) opts argument requires lim property')
        }

        break
      case 'expire':
        const acceptableUnits = ['s', 'm', 'h', 'd']

        if( opts.hasOwnProperty('n') &&
            opts.hasOwnProperty('unit') &&
            _includes(acceptableUnits, opts.unit) ) {

          cmd.push(`expire ${opts.n}${opts.unit}`)
        } else {
          this.fail('cache(expire) opts argument requires n and unit properties')
        }

        break
      default:
        this.fail('cache() requires subCmd argument')
    }

    return this.raw(cmd.join(' '))
  }

  cat(path) {
    if(!path) {
      this.fail('cat() requires path argument')
    } else {
      return this.raw(`cat ${this._escapeShell(path)}`)
    }
  }

  cd(dir) {
    if(!dir) {
      this.fail('cd() requires dir argument')
    } else {
      return this.raw(`cd ${this._escapeShell(dir)}`)
    }
  }

  chmod(mode, ...files) {
    if(!mode) {
      this.fail('chmod() requires mode argument')
    } else if(files.length === 0) {
      this.fail('chmod() requires files argument(s)')
    } else {
      const filesStr = _map(files, this._escapeShell.bind(this)).join(' ')

      return this.raw(`chmod ${mode} ${filesStr}`)
    }
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

    if(opts.singleColumn) {
      cmd.push('-1')
    }

    if(opts.dirsFirst) {
      cmd.push('-D')
    }

    return this.raw(cmd.join(' '))
  }

  command(cmd, args) {
    if(!cmd) {
      this.fail('command() requires cmd argument')
    } else if(!args) {
      this.fail('command() requires args argument')
    } else {
      const cmdString = _last(this[cmd](args).cmds)

      return this.raw(`command ${cmdString}`)
    }
  }

  debug(level, opts = {}) {
    if(!level) {
      this.fail('debug() requires level argument')
    } else if(typeDetect(level) === 'string' && level !== 'off') {
      this.fail('debug() level argument must be a number or "off"')
    } else {
      const cmd = ['debug']

      if(opts.hasOwnProperty('truncate')) {
        cmd.push('-T')
      }

      if(opts.hasOwnProperty('outputFile')) {
        cmd.push(`-o ${this._escapeShell(opts.outputFile)}`)
      }

      if(opts.hasOwnProperty('context')) {
        cmd.push('-c')
      }

      if(opts.hasOwnProperty('pid')) {
        cmd.push('-p')
      }

      if(opts.hasOwnProperty('timestamps')) {
        cmd.push('-t')
      }

      cmd.push(level)

      return this.raw(cmd.join(' '))
    }
  }

  echo(str) {
    return this.raw(`echo ${this._escapeShell(str)}`)
  }

  edit(file, opts = {}) {
    if(!file) {
      this.fail('edit() requires file argument')
    } else if (typeDetect(file) !== 'string') {
      this.fail('edit() file argument must be a string')
    } else {
      const cmd = ['edit']

      if(opts.keepTempFile) {
        cmd.push('-k')
      }

      if(opts.hasOwnProperty('tempFileLocation')) {
        cmd.push(`-o ${opts.tempFileLocation}`)
      }

      cmd.push(this._escapeShell(file))

      return this.raw(cmd.join(' '))
    }
  }

  eval(args, opts = {}) {
    if(!args) {
      this.fail('eval() requires args argument')
    } else {
      const cmd = ['eval']

      if(opts.hasOwnProperty('format')) {
        cmd.push(`-f ${opts.format}`)
      }

      cmd.push(args)

      return this.raw(cmd.join(' '))
    }
  }

  exit(subCmd, opts = {}) {
    const cmd = ['exit']

    switch(subCmd) {
      case 'bg':
        cmd.push('bg')
        break
      case 'top':
        cmd.push('top')
        break
      case 'parent':
        cmd.push('parent')
        break
      case 'kill':
        cmd.push('kill')
        break
      default:
        this.fail('exit() requires subCmd argument')
    }

    if(opts.hasOwnProperty('code')) {
      cmd.push(opts.code)
    }

    this.raw(cmd.join(' '))
  }

  // NOTE: NEED TO IMPLEMENT
  // fg() {
  //
  // }

  find(opts = {}) {
    const cmd = ['find']

    if(opts.hasOwnProperty('maxScanDepth')) {
      cmd.push(`-d ${opts.maxScanDepth}`)
    }

    if(opts.longListing) {
      cmd.push('-l')
    }

    if(opts.hasOwnProperty('directory')) {
      cmd.push(this._escapeShell(opts.directory))
    }

    return this.raw(cmd.join(' '))
  }

  get(remotePath, opts = {}) {
    if(!remotePath) {
      this.fail('get() require remotePath argument')
    } else {
      const cmd = ['get']

      if(opts.continue) {
        cmd.push('-c')
      }

      if(opts.deleteSrcOnSuccess) {
        cmd.push('-E')
      }

      if(opts.deleteTargetBefore) {
        cmd.push('-e')
      }

      if(opts.asciiMode) {
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
  }

  get1(remoteFile, opts = {}) {
    if(!remoteFile) {
      this.fail('get1() requires remoteFile argument')
    } else {
      const cmd = ['get1']

      if(opts.hasOwnProperty('destFileName')) {
        cmd.push(`-o ${this._escapeShell(opts.destFileName)}`)
      }

      if(opts.continue) {
        cmd.push('-c')
      }

      if(opts.deleteSrcOnSuccess) {
        cmd.push('-E')
      }

      if(opts.asciiMode) {
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
  }

  glob(patterns, opts = {}) {
    if(!patterns) {
      this.fail('glob() requires patterns argument')
    } else {
      const cmd = ['glob']

      if(opts.plainFiles) {
        cmd.push('-f')
      }

      if(opts.directories) {
        cmd.push('-d')
      }

      if(opts.allTypes) {
        cmd.push('-a')
      }

      let existanceSpecified = false

      if(opts.exist) {
        cmd.push(`--exist ${this._escapeShell(patterns)}`)
        existanceSpecified = true
      }

      if(opts.notExist) {
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
        this.fail('glob() opts argument requires exist, notExist, and/or command properties')
      }

      return this.raw(cmd.join(' '))
    }
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

    if(opts.notRecursive) {
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
    if(!existingFile) {
      this.fail('ln() requires existingFile argument')
    } else if(!newLink) {
      this.fail('ln() requires newLink argument')
    } else {
      const cmd = ['ln']

      if(opts.symbolic) {
        cmd.push('-s')
      }

      cmd.push(this._escapeShell(existingFile))
      cmd.push(this._escapeShell(newLink))

      return this.raw(cmd.join(' '))
    }
  }

  local(command) {
    if(!command) {
      this.fail('local() requires command argument')
    } else {
      return this.raw(`local ${command}`)
    }
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

  put(localPath, opts = {}) {
    if(!localPath) {
      this.fail('put() requires localPath argument')
    } else {
      const remotePath = opts.remotePath
      if(!remotePath) {
        return this.raw(`put ${this._escapeShell(localPath)}`)
      }

      return this.raw(`put ${
        this._escapeShell(localPath)
      } -o ${
        this._escapeShell(remotePath)
      }`)
    }
  }

  mv(src, dest) {
    if(!src) {
      this.fail('mv() requires src argument')
    } else if(!dest) {
      this.fail('mv() requires dest argument')
    } else {
      return this.raw(`mv ${this._escapeShell(src)} ${this._escapeShell(dest)}`)
    }
  }

  rm(...files) {
    if(files.length === 0){
      this.fail('rm() requires files argument(s)')
    } else {
      const filesStr = _map(files, this._escapeShell.bind(this)).join(' ')

      return this.raw(`rm ${filesStr}`)
    }
  }

  rmdir(...directories) {
    if(directories.length === 0){
      this.fail('rmdir() requires directories argument(s)')
    } else {
      const directoriesStr = _map(
        directories, this._escapeShell.bind(this)
      ).join(' ')

      return this.raw(`rmdir ${directoriesStr}`)
    }
  }

  mirror(remoteDir, opts = {}) {
    const upload = opts.upload
    const localDir = opts.localDir

    if(!remoteDir) {
      this.fail('mirror() requires remoteDir argument')
    } else if(upload && !localDir) {
      this.fail('mirror(opts = {upload: true}) opts argument requires localDir property')
    } else {
      const cmd = opts.queue ? ['queue mirror'] : ['mirror']

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

      return this.raw(cmd.join(' '))
    }
  }

  pget(remotePath, opts = {}) {
    if(!remotePath) {
      this.fail('pget() requires remotePath argument')
    } else {
      const cmd = opts.queue ? ['queue pget'] : ['pget']

      const n = opts.n || 4
      cmd.push(`-n ${n}`)
      cmd.push(`${this._escapeShell(remotePath)}`)

      const localPath = opts.localPath
      if(localPath) {
        cmd.push(`-o ${this._escapeShell(localPath)}`)
      }

      return this.raw(cmd.join(' '))
    }
  }
}
