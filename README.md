# Node Nsfw Js API TypeScript AWS CDK
- Multi-AZ
- Dual Stack
- Auto Scaling Group
- Load Balancer
- Security Best Practice
- Fault Tolerant
- Horizontally Scalable
- Three Tier Architecture

Link to source code: https://github.com/o7-Fire/NodeNsfwJSAPI


## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
* `export NO_REDIS=true` to disable Redis
* `export NO_EFS=true` to disable EFS and CACHE_IMAGE_HASH_FILE
* `export NO_CLOUDWATCH=true` to disable CloudWatch file logging
* `export NO_SPOT=true` to disable Spot Instance
* `export REGIONS=us-east-1,us-east-2` to deploy to multiple regions
* `export R53_ZONE_ID=Z123456789` to deploy with Route53
* `export R53_ZONE_NAME=example.com` to deploy with Route53

## Architecture
![NodeNsfwJsApiAWSCDKArchitecture](https://user-images.githubusercontent.com/49940811/193414050-d7b74f45-3113-4597-980f-f3c03c5e5c8a.png)

Sorry for the wacky design, OP burned his billing while drawing this 
