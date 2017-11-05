'use strict'

require('rootpath')()
const Deployment = require('lib/Deployment')
const sourcePath = process.cwd()
const parameters = process.argv[2] ? process.argv.slice(2).join(' ') : false

Deployment.deploy(sourcePath, parameters)
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(process.exit)
