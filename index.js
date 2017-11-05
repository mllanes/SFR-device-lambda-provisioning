'use strict'

require('rootpath')()
const Response = require('./lib/Response')
const Provisioning = require('lib/Provisioning')
const DataAccess = require('lib/DataAccess')
const bluebird = require('bluebird')

exports.handler = (event, context, cb) => {
  return bluebird.try(() => {
    const customerId = event.headers['x-customer-id']
    const serialNumber = event.headers['x-serial-number']

    if (!customerId || !serialNumber) {
      return Response.send(422, {
        error: 'validationError',
        message: `Missing required fields. Please provide header values for 'x-customer-id' and 'x-serial-number'`
      }, cb)
    }

    if (event.path === '/files' && event.httpMethod === 'POST') {
      const provisioning = new Provisioning(customerId, serialNumber)

      return provisioning.verify()
        .then(knownDevice => {
          if (!knownDevice) {
            return Response.send(404, {
              error: 'notFound',
              message: `Customer's device not found`
            }, cb)
          }

          return provisioning.getProvisioningData()
            .then(res => Response.send(201, res, cb))
        })
    }

    if (event.path === '/data' && event.httpMethod === 'GET') {
      let LastEvaluatedKey
      if (event.queryStringParameters) {
        LastEvaluatedKey = JSON.parse(event.queryStringParameters.LastEvaluatedKey)
      }
      return DataAccess.query(customerId, serialNumber, LastEvaluatedKey)
        .then(res => Response.send(200, res, cb))
    }
  })
    .catch(cb)
}
