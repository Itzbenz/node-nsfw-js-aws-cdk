import * as cdk from 'aws-cdk-lib';
import {aws_efs as efs, aws_elasticache as elastiCache} from 'aws-cdk-lib';
import {NodeNsfwJs} from "./NodeNsfwJs";


export class OtherStack {
    public readonly redisEndpoint: string;
    public readonly redis: elastiCache.CfnReplicationGroup;
    public readonly fileSystem: efs.FileSystem;

    constructor(mainStack: NodeNsfwJs) {

        if (!process.env.NO_REDIS) {
            const redisSubnetGroup = new elastiCache.CfnSubnetGroup(mainStack, 'NodeNsfwJs ElastiCache', {
                description: 'Redis subnet group',
                subnetIds: mainStack.otherSubnets.subnetIds
            });

            this.redis = new elastiCache.CfnReplicationGroup(mainStack, 'NodeNsfwJs ElastiCache Failover', {
                replicationGroupDescription: "NodeNsfwJs ElastiCache Failover",
                cacheNodeType: 'cache.t4g.micro',
                engine: 'redis',
                multiAzEnabled: true,
                replicasPerNodeGroup: 2,
                numNodeGroups: 3,
                automaticFailoverEnabled: true,
                securityGroupIds: [mainStack.redisSecurityGroup.securityGroupId],
                cacheSubnetGroupName: redisSubnetGroup.ref,
                autoMinorVersionUpgrade: true,
                cacheParameterGroupName: 'default.redis6.x.cluster.on',
                port: 6379
            });


            this.redisEndpoint = this.redis.attrConfigurationEndPointAddress + ':' + this.redis.attrConfigurationEndPointPort;
        }
        if (!process.env.NO_EFS) {
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
        }
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