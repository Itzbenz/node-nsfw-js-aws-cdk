import * as cdk from 'aws-cdk-lib';
import {aws_elasticloadbalancingv2 as elbv2,
    aws_route53 as route53,
    aws_route53_targets as route53_targets,
} from 'aws-cdk-lib';
import {NodeNsfwJs} from "./NodeNsfwJs";
import {ApiStack} from "./ApiStack";
import {throws} from "assert";


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
        if(process.env.R53_ZONE_ID){
            const R53_ZONE_NAME: string = process.env.R53_ZONE_NAME || '';
            const R53_ZONE_ID = process.env.R53_ZONE_ID;
            if(!R53_ZONE_NAME){
                throw new Error('R53_ZONE_NAME is required if R53_ZONE_ID is set');
            }
            new route53.RecordSet(mainStack, 'NodeNsfwJsELBRecord', {
                zone: route53.HostedZone.fromHostedZoneAttributes(mainStack, 'NodeNsfwJsELBRecordZone', {
                    hostedZoneId: R53_ZONE_ID,
                    zoneName: R53_ZONE_NAME
                }),
                recordName: 'api.' + R53_ZONE_NAME,
                recordType: route53.RecordType.A,
                target: route53.RecordTarget.fromAlias(new route53_targets.LoadBalancerTarget(this.publicLoadBalancer)),
            });


        }

    }
}
