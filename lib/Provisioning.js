'use strict'

const AWS = require('aws-sdk')
const bluebird = require('bluebird')
const constants = require('lib/config/constants')
const DynamoDB = bluebird.promisifyAll(new AWS.DynamoDB.DocumentClient({
  apiVersion: constants.DynamoDB.version,
  region: process.env.PROVISIONED_AWS_REGION
}))
const Iot = bluebird.promisifyAll(new AWS.Iot({
  apiVersion: constants.Iot.version,
  region: process.env.PROVISIONED_AWS_REGION
}))

class Provisioning {
  constructor (customerId, serialNumber) {
    this.customerId = customerId
    this.serialNumber = serialNumber
  }

  verify () {
    return DynamoDB.getAsync({
      TableName: 'Devices',
      ConsistentRead: true,
      Key: {
        customerId: this.customerId,
        serialNumber: this.serialNumber
      }
    })
      .then(res => res.Item)
  }

  getProvisioningData () {
    const params = {
      thingName: this.serialNumber,
      attributePayload: {
        attributes: {
          customerId: this.customerId
        },
        merge: false
      }
    }

    let payload

    return Promise.all([
      Iot.createThingAsync(params),
      Iot.describeEndpointAsync(),
      Iot.createKeysAndCertificateAsync({
        setAsActive: true
      })
    ])
      .then(res => {
        payload = {
          endpoint: res[1].endpointAddress,
          certificatePem: res[2].certificatePem,
          privateKey: res[2].keyPair.PrivateKey
        }

        return Promise.all([
          Iot.attachPrincipalPolicyAsync({
            policyName: 'SFR-sensors',
            principal: res[2].certificateArn
          }),
          Iot.attachThingPrincipalAsync({
            thingName: this.serialNumber,
            principal: res[2].certificateArn
          })
        ])
      })
      .then(() => payload)
  }
}

module.exports = Provisioning
