'use strict'

const PassThrough = require('stream').PassThrough
const inherits = require('util').inherits
const temp = require('temp-path')
const assert = require('assert')
const knox = require('knox')
const zlib = require('zlib')
const fs = require('fs')

inherits(Stream, PassThrough)

module.exports = Stream

function Stream(options) {
  if (!(this instanceof Stream)) return new Stream(options)

  const self = this

  PassThrough.call(this, options)

  // s3 client
  this.client = options.client || knox.createClient(options)

  // buffer filename
  this.filename = temp()
  // date started
  this.start = new Date()
  // content type for uploaded file
  this.type = options.type || 'application/json; charset=UTF-8'
  // how much has been written to the buffer file
  this.length = 0

  this.filestream = fs.createWriteStream(this.filename)
  this.gzipstream = zlib.createGzip()

  // handling piping logic
  this
  .pipe(this.gzipstream)
  .on('data', function (buf) {
    self.length += buf.length
  })
  .on('error', onerror)
  .pipe(this.filestream)
  .on('error', onerror)

  // proxy errors
  /* istanbul ignore next */
  function onerror(err) {
    self.emit('error', err)
  }
}

Stream.prototype.send = function (key) {
  assert(typeof key === 'string', 'Invalid S3 key!')
  // nothing to upload
  if (!this.length) return Promise.resolve(false)

  const self = this

  return new Promise(function (_resolve, _reject) {
    self.filestream
    .on('close', resolve)
    .on('finish', resolve)
    self
    .on('error', reject)
    .end()

    function resolve() {
      cleanup()
      _resolve()
    }

    /* istanbul ignore next */
    function reject(err) {
      cleanup()
      _reject(err)
    }

    function cleanup() {
      self.filestream
      .removeListener('close', resolve)
      .removeListener('finish', resolve)
      self
      .removeListener('error', reject)
    }
  }).then(function () {
    return new Promise(function (resolve, reject) {
      self.client.putFile(self.filename, key, {
        'Content-Type': self.type,
        'Content-Encoding': 'gzip',
      }, function (err, res) {
        /* istanbul ignore if */
        if (err) return reject(err)
        res.resume()
        resolve(res)
      })
    })
  }).then(function (res) {
    assert(res.statusCode === 200, 'Could not upload file: ' + self.filename)
    fs.unlink(self.filename, onerror)
    return key
  })
}

function onerror(err) {
  console.error(err.stack)
}
