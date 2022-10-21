import * as cdk from 'aws-cdk-lib';
import {aws_elasticloadbalancingv2 as elbv2, aws_route53 as route53} from 'aws-cdk-lib';
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

        //add Route 53 Health Check
        new route53.CfnHealthCheck(mainStack, 'NodeNsfwJsELBCheck', {
            healthCheckConfig: {
                type: 'HTTP',
                resourcePath: '/api/v2/test',
                failureThreshold: 3,
                fullyQualifiedDomainName: this.publicLoadBalancer.loadBalancerDnsName,
                port: 80,
                requestInterval: 30,
            },
            healthCheckTags: [
                {
                    key: 'Name',
                    value: 'NodeNsfwJsELBCheck-' + mainStack.region
                }
            ]
        });

        new cdk.CfnOutput(mainStack, 'PublicLoadBalancerDNS', {
            value: this.publicLoadBalancer.loadBalancerDnsName
        });


    }
}
