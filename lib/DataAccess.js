'use strict'

const AWS = require('aws-sdk')
const bluebird = require('bluebird')
const constants = require('lib/config/constants')
const DynamoDB = bluebird.promisifyAll(new AWS.DynamoDB.DocumentClient({
  apiVersion: constants.DynamoDB.version,
  region: process.env.PROVISIONED_AWS_REGION
}))
const _ = require('lodash')

class DataAccess {
  static query (customerId, serialNumber, lastEvaluatedKey) {
    return bluebird.try(() => {
      const hashSortMatch = {
        serialNumber: serialNumber
      }
      const filter = {customerId: customerId}

      const ExpressionAttributeValues = {}
      const ExpressionAttributeNames = {}
      const FilterExpression = []
      const KeyConditionExpression = []

      _.forOwn(hashSortMatch, (value, field) => {
        ExpressionAttributeNames[`#${field}`] = field
        ExpressionAttributeValues[`:${field}`] = value

        KeyConditionExpression.push(`#${field} = :${field}`)
      })

      _.forOwn(filter, (value, field) => {
        ExpressionAttributeNames[`#${field}`] = field
        ExpressionAttributeValues[`:${field}`] = value

        FilterExpression.push(`#${field} = :${field}`)
      })

      const params = {
        TableName: constants.dataSamplesTableName,
        /**
         * It's ok.. we don't need strong consistency for those data samples...
         */
        ConsistentRead: false,
        KeyConditionExpression: KeyConditionExpression.join(' AND '),
        ExpressionAttributeNames: ExpressionAttributeNames,
        ExpressionAttributeValues: ExpressionAttributeValues,
        Limit: constants.DynamoDB.itemsPageLimit
      }

      if (FilterExpression.length > 0) {
        params.FilterExpression = FilterExpression.join(' AND ')
      }

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey
      }

      return DynamoDB.queryAsync(params)
    })
  }
}

module.exports = DataAccess
