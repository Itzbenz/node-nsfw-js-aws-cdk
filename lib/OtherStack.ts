import * as cdk from 'aws-cdk-lib';
import {aws_ec2 as ec2, aws_efs as efs, aws_elasticache as elastiCache} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {NodeNsfwJs} from "./NodeNsfwJs";


export class OtherStack {
    public readonly redisEndpoint: string;
    public readonly redis: elastiCache.CfnReplicationGroup;
    public readonly fileSystem: efs.FileSystem;

    constructor(mainStack: NodeNsfwJs) {


        const redisSubnetGroup = new elastiCache.CfnSubnetGroup(mainStack, 'NodeNsfwJs ElastiCache', {
            description: 'Redis subnet group',
            subnetIds: mainStack.otherSubnets.subnetIds
        });

        this.redis = new elastiCache.CfnReplicationGroup(mainStack, 'NodeNsfwJs ElastiCache Failover', {
            replicationGroupDescription: "",
            cacheNodeType: 'cache.t3.micro',
            engine: 'redis',
            multiAzEnabled: true,
            numCacheClusters: 3,
            replicasPerNodeGroup: 2,
            automaticFailoverEnabled: true,
            securityGroupIds: [mainStack.redisSecurityGroup.securityGroupId],
            cacheSubnetGroupName: redisSubnetGroup.ref,
            autoMinorVersionUpgrade: true,
            port: 6379
        });

        this.redisEndpoint = this.redis.attrConfigurationEndPointAddress + ':' + this.redis.attrConfigurationEndPointPort;

        this.fileSystem = new efs.FileSystem(mainStack, 'NodeNsfwJsEFS', {
            encrypted: true,
            lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS,
            vpc: mainStack.vpc,
            vpcSubnets: mainStack.otherSubnets,
            securityGroup: mainStack.efsSecurityGroup,
            performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
            throughputMode: efs.ThroughputMode.BURSTING,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        /*
        const efsMountTargets = [];
        mainStack.otherSubnets.subnetIds.forEach((subnetId: string) => {
            efsMountTargets.push(new efs.CfnMountTarget(this, 'NodeNsfwJsEFSMountTarget' + subnetId, {
                fileSystemId: this.fileSystem.fileSystemId,
                securityGroups: [mainStack.efsSecurityGroup.securityGroupId],
                subnetId: subnetId,
            }));
        });

         */
    }
}