import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {aws_ec2 as ec2, aws_iam as iam, aws_autoscaling as autoscaling, aws_elasticloadbalancingv2 as elbv2} from "aws-cdk-lib";
import {NodeNsfwJs} from "./NodeNsfwJs";
import {OtherStack} from "./OtherStack";
import {aws_elasticloadbalancingv2} from "aws-cdk-lib";

export class ApiStack{
    private apiLaunchTemplate: ec2.LaunchTemplate;
    private apiAutoScalingGroup: autoscaling.AutoScalingGroup;
    apiTargetGroup: elbv2.ApplicationTargetGroup;
    constructor(mainStack: NodeNsfwJs, otherStack: OtherStack) {

        /**
         * #!/bin/bash -xe
         * exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
         * echo whoami
         * whoami
         * sudo whoami
         * #Install dependency
         * curl --silent --location https://rpm.nodesource.com/setup_16.x | bash -
         * yum -y install nodejs git gcc-c++ make amazon-efs-utils nfs-utils
         * node -e "console.log('Running Node.js ' + process.version)"
         * #Download code
         * mkdir /home/ec2-user/NodeNsfwJSAPI
         * chmod 775 /home/ec2-user/NodeNsfwJSAPI
         * git clone https://github.com/o7-Fire/NodeNsfwJSAPI.git /home/ec2-user/NodeNsfwJSAPI/
         * #EFS
         * file_system_dns_1=fs-067a0d1cd6bed96a4.efs.us-east-1.amazonaws.com
         * efs_mount_point_1=/home/ec2-user/fs1
         * mkdir -p "${efs_mount_point_1}"
         * mount -t efs -o tls "${file_system_id_1}" "${efs_mount_point_1}"
         * #ENV
         * cd /home/ec2-user/NodeNsfwJSAPI/
         * touch .env
         * echo "MAX_CACHE_SIZE=64" >> .env
         * echo "CACHE_IMAGE_HASH_FILE=/home/ec2-user/fs1/image_cache/" >> .env
         * echo "REDIS_CLUSTER_CONFIGURATION_ENDPOINT=clusterfuck.sj1zm9.clustercfg.use1.cache.amazonaws.com:6379" >> .env
         * #Run
         * npm ci
         * npm run start
         */


        const userData = ec2.UserData.forLinux();
        //Install dependency
        userData.addCommands('curl --silent --location https://rpm.nodesource.com/setup_16.x | bash -');
        userData.addCommands('yum -y install nodejs git gcc-c++ make amazon-efs-utils nfs-utils');
        userData.addCommands('node -e "console.log(\'Running Node.js \' + process.version)"');
        //Download code
        userData.addCommands('mkdir /home/ec2-user/NodeNsfwJSAPI');
        userData.addCommands('chmod 775 /home/ec2-user/NodeNsfwJSAPI');
        userData.addCommands('git clone https://github.com/o7-Fire/NodeNsfwJSAPI.git /home/ec2-user/NodeNsfwJSAPI/');
        //EFS
        userData.addCommands('file_system_id_1='+ otherStack.fileSystem.fileSystemId);
        userData.addCommands('efs_mount_point_1=/home/ec2-user/fs1/');
        userData.addCommands('mkdir -p "${efs_mount_point_1}"');
        userData.addCommands('mount -t efs -o tls "${file_system_id_1}" "${efs_mount_point_1}"');
        //ENV
        userData.addCommands('cd /home/ec2-user/NodeNsfwJSAPI/');
        userData.addCommands('touch .env');
        userData.addCommands('echo "MAX_CACHE_SIZE=64" >> .env');
        userData.addCommands('echo "CACHE_IMAGE_HASH_FILE=/home/ec2-user/fs1/image_cache/" >> .env');
        userData.addCommands('echo "REDIS_CLUSTER_CONFIGURATION_ENDPOINT='+ otherStack.redisEndpoint +'" >> .env');
        //Run
        userData.addCommands('npm ci');
        userData.addCommands('npm run start');

        //print userData
        new cdk.CfnOutput(mainStack, 'UserData', {
            value: userData.render(),
            description: "User Data for API"
        });

        //Amazon Linux 2 AMI (HVM), SSD Volume Type - ami-026b57f3c383c2eec
        //c6a.large
        this.apiLaunchTemplate = new ec2.LaunchTemplate(mainStack, 'apiLaunchTemplate', {
            launchTemplateName: 'NodeNsfwJsApiLaunchTemplate',
            machineImage: ec2.MachineImage.latestAmazonLinux({
                generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
            }),
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.C6A, ec2.InstanceSize.LARGE),
            securityGroup: mainStack.apiSecurityGroup,
            userData: userData,

        });


        //Target Group
        this.apiTargetGroup = new elbv2.ApplicationTargetGroup(mainStack, 'apiTargetGroup', {
            vpc: mainStack.vpc,
            targetGroupName: 'NodeNsfwJsApiTargetGroup',
            port: parseInt(process.env.API_PORT || "5656"),
            protocol: elbv2.ApplicationProtocol.HTTP,
            targetType: elbv2.TargetType.INSTANCE,
            healthCheck: {
                path: '/',
                interval: cdk.Duration.seconds(30),
                timeout: cdk.Duration.seconds(5),
                healthyHttpCodes: '200-399',
            }
        });

        //AutoScaling Group
        this.apiAutoScalingGroup = new autoscaling.AutoScalingGroup(mainStack, 'apiAutoScalingGroup', {
            vpc: mainStack.vpc,
            autoScalingGroupName: 'NodeNsfwJsApiAutoScalingGroup',
            launchTemplate: this.apiLaunchTemplate,
            minCapacity: 0,
            maxCapacity: 3,
            desiredCapacity: 2,
            vpcSubnets: mainStack.apiSubnets,
            healthCheck: autoscaling.HealthCheck.elb({
                grace: cdk.Duration.seconds(300)
            }),

        });

        this.apiAutoScalingGroup.scaleOnCpuUtilization('apiAutoScalingGroupScaleOnCpuUtilization', {
            targetUtilizationPercent: 90,
            cooldown: cdk.Duration.seconds(60)
        });

        this.apiAutoScalingGroup.attachToApplicationTargetGroup(this.apiTargetGroup);


    }
}