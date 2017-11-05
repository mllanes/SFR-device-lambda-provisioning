'use strict'

const bluebird = require('bluebird')
const exec = bluebird.promisify(require('child_process').exec)
const fs = require('fs-extra')
const path = require('path')
const constants = require('lib/config/constants')
const chunk = require('chunk')
const _ = require('lodash')

class Deployment {
  static deploy (sourcePath, parameters) {
    return bluebird.try(() => {
      sourcePath = path.resolve(sourcePath)

      const pkg = require(`${sourcePath}/package.json`)
      const lambdaName = pkg.name
      const tmpDir = path.resolve(`${process.env.HOME}/.${lambdaName}`)
      const bundle = `code.zip`
      const testDevicesFile = `${sourcePath}/test-devices.json`

      console.log(`Deploying lambda ${lambdaName} and it's infrastructure. Please wait...`)

      return fs.remove(tmpDir)
        .then(() => fs.mkdirs(tmpDir))
        .then(() => fs.copy(`${sourcePath}/`, `${tmpDir}/`))
        .then(() => exec(`cd ${tmpDir} && zip -r ${tmpDir}/${bundle} * >/dev/null`))
        .then(() => exec(`aws s3api create-bucket --bucket ${lambdaName} --acl private`))
        .then(() => exec(`aws s3 cp ${tmpDir}/${bundle} s3://${lambdaName}/${bundle}`))
        .then(() => Deployment._deployInfrastructure(sourcePath, parameters))
        .then(() => exec(`aws lambda update-function-code --function-name ${lambdaName} --s3-bucket ${lambdaName} --s3-key ${bundle}`))
        .then(() => exec(`aws lambda publish-version --function-name ${lambdaName}`))
        .then(() => fs.pathExists(testDevicesFile))
        .then(exists => exists ? Deployment._importTestDevices(testDevicesFile) : Promise.resolve())
        .then(() => console.log(`Infrastructure and Lambda ready!`))
    })
  }

  static _importTestDevices (testDevicesFile) {
    console.log(`Importing tests devices from ${testDevicesFile} ...`)
    return fs.readJson(testDevicesFile)
      .then(testDevices => {
        const chunks = chunk(testDevices, constants.DynamoDB.bathWriteSize)

        return bluebird.each(chunks, devices => {
          const params = {
            Devices: []
          }

          devices.forEach(device => {
            params.Devices.push({
              PutRequest: {
                Item: Deployment._deviceObjectToDynamoItem(device)
              }
            })
          })
          return exec(`aws dynamodb batch-write-item --request-items '${JSON.stringify(params)}'`)
        })
      })
  }

  static _deviceObjectToDynamoItem (obj) {
    const item = {}

    _.forOwn(obj, (value, key) => {
      switch (typeof value) {
        case 'string':
          item[key] = {
            S: value
          }
          break

        case 'number':
          item[key] = {
            N: value
          }
          break

        case 'boolean':
          item[key] = {
            BOOL: value
          }
          break

        default:
          break
      }
    })
    return item
  }

  static _deployInfrastructure (sourcePath, parameters) {
    const templateFile = `${sourcePath}/infrastructure/template.json`
    const pkg = require(`${sourcePath}/package.json`)
    const lambdaName = pkg.name

    return fs.pathExists(templateFile)
      .then(exists => {
        if (!exists) {
          throw new Error(`Couldn't find resources for lambda ${lambdaName} at ${sourcePath}/infrastructure/template.json`)
        }

        const stackFile = `${process.env.HOME}/.stack-${lambdaName}.json`
        let cfOptions = `--capabilities CAPABILITY_NAMED_IAM --template-body file:///${stackFile}`

        if (parameters) {
          cfOptions += ` --parameters ${parameters}`
        }

        return fs.writeJson(stackFile, require(templateFile), {spaces: 2})
          .then(() => Deployment._upsertStack(lambdaName, cfOptions))
      })
  }

  static _upsertStack (stackName, cfOptions) {
    return exec(`aws cloudformation create-stack --stack-name ${stackName} ${cfOptions}`)
      .catch(err => {
        if (err.toString().indexOf(`Stack [${stackName}] already exists`) > -1) {
          return exec(`aws cloudformation update-stack --stack-name ${stackName} ${cfOptions}`)
        }
        throw err
      })
      .catch(err => {
        if (err.toString().indexOf(`No updates are to be performed`) === -1) {
          throw err
        }
      })
      .then(() => exec(`aws cloudformation describe-stacks --stack-name ${stackName} --query Stacks[0] --output json`))
      .then(res => {
        res = JSON.parse(res)
        const statusToWaitFor = res.StackStatus.indexOf('CREATE') > -1 ? 'stack-create-complete' : 'stack-update-complete'
        return exec(`aws cloudformation wait ${statusToWaitFor} --stack-name ${stackName}`)
      })
      .then(() => Deployment._printStackOutputs(stackName))
  }

  static _printStackOutputs (stackName) {
    return exec(`aws cloudformation describe-stacks --stack-name ${stackName} --query Stacks[0] --output json`)
      .then(res => console.log('\n---OUTPUTS----\n', JSON.stringify(JSON.parse(res).Outputs || {}, null, 2), '\n-------\n'))
  }
}

module.exports = Deployment
