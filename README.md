# Welcome to your sample CDK TypeScript project for Fonasa!

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

## Deployment steps

1. Provision your AWS account via https://dashboard.eventengine.run/dashboard by entering the event hash provided by AWS
2. Select Email OTP option and enter your email used for registration
3. Follow login steps and open the AWS console
4. Launch an AWS Cloud9 m5.large environment in ca-central-1 with default settings
5. Open the IDE environment and clone the provided git repo
```
git clone https://github.com/ejahnke/workshopVpc.git
```
6. update/workshopVpc/bin/my_vpcmoh_application.ts with your current AWS account number and region
7. navigate into the recently cloned folder workshopVpc and install required libraries
```
cd workshopVpc
```
```
npm install aws-cdk-lib
```
8. bootstrap the AWS account for CDK deployments
```
cdk bootstrap
```
9. deploy the CDK stack which will create an AWS CodeCommit repository and an AWS CodePipeline for our subsequent deployments
```
cdk deploy
```
