'use strict'

const assert = require('assert')

const Stream = require('..')

const options = {
  key: process.env.S3_BUFFER_STREAM_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
  secret: process.env.S3_BUFFER_STREAM_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  bucket: process.env.S3_BUFFER_STREAM_BUCKET,
}

const hostname = 'https://' + options.bucket + '.aws.amazon.com/'

describe('when the stream is not null', function () {
  const stream = Stream(options)
  const key = '/' + Math.random().toString(36).slice(2) + '.json'

  it('should work as a stream', function (done) {
    stream.write(JSON.stringify({
      message: 'a'
    }) + '\n')
    stream.write(JSON.stringify({
      message: 'b'
    }) + '\n', done)
  })

  it('should flush the response', function () {
    return stream.send(key)
  })

  it('should have saved the file', function (done) {
    stream.client.getFile(key, function (err, res) {
      if (err) return done(err)

      const headers = res.headers
      assert.equal(headers['content-encoding'], 'gzip')
      assert.equal(headers['content-type'], 'application/json; charset=UTF-8')
      assert.equal(headers['content-length'], String(stream.length))

      res.resume()
      done()
    })
  })
})

describe('when the stream is null', function () {
  const stream = Stream(options)
  const key = '/' + Math.random().toString(36).slice(2) + '.json'

  it('should flush the response', function () {
    return stream.send(key)
  })

  it('should have saved the file', function (done) {
    stream.client.getFile(key, function (err, res) {
      if (err) return done(err)

      assert.equal(res.statusCode, 403)
      done()
    })
  })
})
