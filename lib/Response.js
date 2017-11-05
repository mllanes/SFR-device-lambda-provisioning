'use strict'

class Response {
  static send (statusCode, payload, cb) {
    const response = {
      statusCode: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Expires': 'Sat, 01 Jan 1970 00:00:00 GMT'
      },
      body: JSON.stringify(payload, null, 2)
    }

    cb(null, response)
  }
}

module.exports = Response
