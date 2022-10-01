import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {aws_ec2 as ec2, aws_elasticloadbalancingv2 as elbv2} from "aws-cdk-lib";
import {NodeNsfwJs} from "./NodeNsfwJs";
import {ApiStack} from "./ApiStack";


export class PublicStack {
    private publicLoadBalancer: elbv2.ApplicationLoadBalancer;
    constructor(mainStack: NodeNsfwJs, apiStack: ApiStack) {


        //Public Load Balancer
        this.publicLoadBalancer = new elbv2.ApplicationLoadBalancer(mainStack, 'PublicLoadBalancer', {
            vpc: mainStack.vpc,
            internetFacing: true,
            vpcSubnets: mainStack.publicSubnets,
            idleTimeout: cdk.Duration.seconds(60),
            ipAddressType: elbv2.IpAddressType.DUAL_STACK,
            securityGroup: mainStack.loadBalancerSecurityGroup
        });

        this.publicLoadBalancer.addListener('HTTP', {
            port: 80,
            open: true,
            protocol: elbv2.ApplicationProtocol.HTTP,
            defaultAction: elbv2.ListenerAction.forward([apiStack.apiTargetGroup])
        });

        new cdk.CfnOutput(mainStack, 'PublicLoadBalancerDNS', {
            value: this.publicLoadBalancer.loadBalancerDnsName
        });

    }
}