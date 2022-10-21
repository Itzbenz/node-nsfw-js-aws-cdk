import * as cdk from 'aws-cdk-lib';
import {
    aws_autoscaling as autoscaling,
    aws_ec2 as ec2,
    aws_elasticloadbalancingv2 as elbv2,
    aws_iam as iam,
    aws_logs as awslogs
} from 'aws-cdk-lib';
import {NodeNsfwJs} from "./NodeNsfwJs";
import {OtherStack} from "./OtherStack";

export class ApiStack{
    private apiLaunchTemplate: ec2.LaunchTemplate;
    private apiAutoScalingGroup: autoscaling.AutoScalingGroup;
    apiTargetGroup: elbv2.ApplicationTargetGroup;
    constructor(mainStack: NodeNsfwJs, otherStack: OtherStack) {
        //create EC2 role for Cloudwatch
        /**
         * CreateLogStream
         * DescribeLogStreams
         * CreateLogGroup
         * PutLogEvents
         */
        const ec2Role = new iam.Role(mainStack, 'NodeNsfwJsEC2Role-' + mainStack.region, {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        });
        ec2Role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'));
        ec2Role.addToPolicy(new iam.PolicyStatement({
            actions: [
                'logs:CreateLogStream',
                'logs:DescribeLogStreams',
                'logs:CreateLogGroup',
                'logs:PutLogEvents',
            ],
            resources: ['arn:aws:logs:*:*:*'],
        }));

        //Create log group
        const logGroup = new awslogs.LogGroup(mainStack, 'NodeNsfwJsLogGroup-' + mainStack.region, {
            logGroupName: '/aws/lambda/NodeNsfwJs-' + mainStack.region,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            retention: awslogs.RetentionDays.ONE_MONTH,
        });


        const userData: string[] = [];
        userData.push('#!/bin/bash -xe');
        userData.push("exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1");
        if (!process.env.NO_CLOUDWATCH) {
            userData.push('yum install -y amazon-cloudwatch-agent awslogs');
            //log /var/log/user-data.log
            userData.push('mkdir -p /var/awslogs/etc');
            userData.push('touch /var/awslogs/etc/awslogs.conf');
            userData.push("echo '[general]' >> /var/awslogs/etc/awslogs.conf");
            userData.push("echo 'state_file = /var/awslogs/state/agent-state' >> /var/awslogs/etc/awslogs.conf");
            userData.push("echo ' ' >> /var/awslogs/etc/awslogs.conf");
            userData.push('echo "[/NodeNsfwJs/' + mainStack.region + ']" >> /var/awslogs/etc/awslogs.conf');
            userData.push('echo "datetime_format = %b %d %H:%M:%S" >> /var/awslogs/etc/awslogs.conf');
            userData.push('echo "file = /var/log/user-data.log" >> /var/awslogs/etc/awslogs.conf');
            userData.push('echo "buffer_duration = 5000" >> /var/awslogs/etc/awslogs.conf');
            userData.push('echo "log_stream_name = {instance_id}" >> /var/awslogs/etc/awslogs.conf');
            userData.push('echo "initial_position = start_of_file" >> /var/awslogs/etc/awslogs.conf');
            userData.push('echo "log_group_name = NodeNsfwJs-"' + mainStack.region + ' >> /var/awslogs/etc/awslogs.conf');

            userData.push('systemctl enable awslogsd');
            userData.push('systemctl start awslogsd');
            userData.push("cat /var/log/awslogs.log");
        }
        //Install dependency
        userData.push('curl --silent --location https://rpm.nodesource.com/setup_16.x | bash -');
        userData.push('yum -y install nodejs git gcc-c++ make amazon-efs-utils nfs-utils');
        userData.push('node -e "console.log(\'Running Node.js \' + process.version)"');
        //Download code
        userData.push('mkdir /home/ec2-user/NodeNsfwJSAPI');
        userData.push('chmod 775 /home/ec2-user/NodeNsfwJSAPI');
        userData.push('git clone https://github.com/o7-Fire/NodeNsfwJSAPI.git /home/ec2-user/NodeNsfwJSAPI/');
        if (!process.env.NO_EFS) {
            //EFS
            userData.push('file_system_id_1=' + otherStack.fileSystem.fileSystemId);
            userData.push('efs_mount_point_1=/home/ec2-user/fs1/');
            userData.push('mkdir -p "${efs_mount_point_1}"');
            userData.push('mount -t efs -o tls "${file_system_id_1}" "${efs_mount_point_1}"');
        }
        //ENV
        userData.push('cd /home/ec2-user/NodeNsfwJSAPI/');
        userData.push('touch .env');
        userData.push('echo "MAX_CACHE_SIZE=64" >> .env');//lower number to keep hydrated with Redis
        userData.push('echo "ALLOW_ALL_HOSTS=true" >> .env');
        if (!process.env.NO_EFS) userData.push('echo "CACHE_IMAGE_HASH_FILE=/home/ec2-user/fs1/image_cache/" >> .env');
        if (!process.env.NO_REDIS) userData.push('echo "REDIS_CLUSTER_CONFIGURATION_ENDPOINT=' + otherStack.redisEndpoint + '" >> .env');
        if (process.env.TEST_MODE) userData.push('echo "TEST_MODE=true" >> .env');
        for (const env of (process.env.EXTRA_ENV || "").split(";")) {
            if (env) userData.push('echo "' + env + '" >> .env');
        }

        //Run
        userData.push('npm ci');
        userData.push('npm run start');

        console.log(userData.join('\n'));
        const userDataEc2 = ec2.UserData.custom(userData.join('\n'));
        //print userData
        new cdk.CfnOutput(mainStack, 'UserData', {
            value: userDataEc2.render(),
            description: "User Data for API"
        });

        //Amazon Linux 2 AMI (HVM), SSD Volume Type - ami-026b57f3c383c2eec
        //c6a.large
        let templateProps: any = {
            launchTemplateName: 'NodeNsfwJsApiLaunchTemplate',
            machineImage: ec2.MachineImage.latestAmazonLinux({
                generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
            }),
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.C5, ec2.InstanceSize.LARGE),
            securityGroup: mainStack.apiSecurityGroup,
            role: ec2Role,
            userData: userDataEc2,
        };
        if (!process.env.NO_SPOT) {
            templateProps.spotOptions = {
                interruptionBehavior: ec2.SpotInstanceInterruption.TERMINATE,
                requestType: ec2.SpotRequestType.ONE_TIME,
            }
        }
        this.apiLaunchTemplate = new ec2.LaunchTemplate(mainStack, 'apiLaunchTemplate', templateProps);


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
                timeout: cdk.Duration.seconds(10),
                unhealthyThresholdCount: 6,
                healthyHttpCodes: '200-399',
            }
        });

        //AutoScaling Group
        //enable CloudWatch monitoring
        //enable warm pool
        this.apiAutoScalingGroup = new autoscaling.AutoScalingGroup(mainStack, 'apiAutoScalingGroup', {
            vpc: mainStack.vpc,
            autoScalingGroupName: 'NodeNsfwJsApiAutoScalingGroup',
            launchTemplate: this.apiLaunchTemplate,
            minCapacity: 1,
            maxCapacity: 3,
            vpcSubnets: mainStack.apiSubnets,
            healthCheck: autoscaling.HealthCheck.elb({
                grace: cdk.Duration.seconds(30)
            }),

        });


        //Hyperscaling
        this.apiAutoScalingGroup.scaleOnCpuUtilization('apiAutoScalingGroupScaleOnCpuUtilization', {
            targetUtilizationPercent: 15,
            cooldown: cdk.Duration.seconds(180)
        });


        this.apiAutoScalingGroup.attachToApplicationTargetGroup(this.apiTargetGroup);
    }
}
