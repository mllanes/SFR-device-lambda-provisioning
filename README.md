# AWS IoT Challenge 2017 - [HVAC Smart Filter Replacement (SFR) project](http://aws-iot-challenge-2017.marcos.io)

### What is this app for?

It's a Lambda service that along with an Api Gateway, provides API endpoints for automatic on-boarding of the [SFR-devices](https://github.com/mllanes/SFR-device) (raspberry pi +  pressure sensors) data samples access

### What do I need to deploy this?

* An AWS account
* AWS CLI an a profile with permissions to provision all the infrastructure (multiple services are used so the quick answer here is AdministratorAccess)
* Node.JS

### How do I deploy the lambda service and necessary infrastructure:

    npm install --production
    npm run deploy

**Note** that you are going to get the value for a **SFRApiBaseURL** variable as an output. This base URL is needed when running the simulations with [SFR-device](https://github.com/mllanes/SFR-device)

