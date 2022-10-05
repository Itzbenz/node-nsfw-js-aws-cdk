import * as cdk from 'aws-cdk-lib';
import {aws_ec2 as ec2, custom_resources as cr} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {SecurityGroup, SelectedSubnets, Vpc} from 'aws-cdk-lib/aws-ec2';
import {OtherStack} from "./OtherStack";
import {ApiStack} from "./ApiStack";
import {PublicStack} from "./PublicStack";


export class NodeNsfwJs extends cdk.Stack {
    //make 1 public subnet each AZ for load balancer
    //make 1 private subnet each AZ for API app
    //make 1 private subnet each AZ for Other
    //ipv4 and ipv6
    public publicSubnets: SelectedSubnets;
    public apiSubnets: SelectedSubnets;
    public otherSubnets: SelectedSubnets;
    public vpc: Vpc;
    public apiSecurityGroup: SecurityGroup;
    public redisSecurityGroup: SecurityGroup;
    public efsSecurityGroup: SecurityGroup;
    public loadBalancerSecurityGroup: SecurityGroup;
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        this.vpc = new ec2.Vpc(this, 'NodeNsfwJs', {

            cidr: '172.16.0.0/22',
            maxAzs: 2,
            vpcName: 'NodeNsfwJs-VPC',
            enableDnsHostnames: true,
            enableDnsSupport: true,
            subnetConfiguration: [
                {
                    cidrMask: 25,
                    name: 'Public',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 25,
                    name: 'API',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
                {
                    cidrMask: 25,
                    name: 'Other',
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                },
            ],
        });


        this.otherSubnets = this.vpc.selectSubnets({subnetGroupName: 'Other'});
        this.apiSubnets = this.vpc.selectSubnets({subnetGroupName: 'API'});
        this.publicSubnets = this.vpc.selectSubnets({subnetGroupName: 'Public'});

        //IPv6 Hack and auto assign: https://github.com/aws/aws-cdk/issues/894
        // Associate an IPv6 CIDR block to our VPC
        const ipv6Block = new ec2.CfnVPCCidrBlock(this, 'IPv6Block', {
            amazonProvidedIpv6CidrBlock: true,
            vpcId: this.vpc.vpcId
        })

        // Using escape hatches to assign an Ipv6 address to every subnet as well as a custom resource that enables auto-assigned Ipv6 addresses
        this.vpc.publicSubnets.forEach((subnet: ec2.ISubnet, idx: number) => {
            const unboxedSubnet = subnet as ec2.Subnet
            unboxedSubnet.addRoute("IPv6Default", {
                routerId: (this.vpc.node.children.find(c => c instanceof ec2.CfnInternetGateway) as ec2.CfnInternetGateway)?.ref,
                routerType: ec2.RouterType.GATEWAY,
                destinationIpv6CidrBlock: "::/0"
            })

            const vpcCidrBlock = cdk.Fn.select(0, this.vpc.vpcIpv6CidrBlocks);
            const ipv6Cidrs = cdk.Fn.cidr(
                vpcCidrBlock,
                this.vpc.publicSubnets.length,
                "64"
            )
            let cfnSubnet = subnet.node.children.find(c => c instanceof ec2.CfnSubnet) as ec2.CfnSubnet ?? new Error("Why am I still doing this?");
            cfnSubnet.ipv6CidrBlock = cdk.Fn.select(idx, ipv6Cidrs)
            cfnSubnet.addDependsOn(ipv6Block)

            // Define a custom resource to auto-assign IPv6 addresses to all of our subnets
            const autoAssignCR = new cr.AwsCustomResource(this, `AutoAssignIPv6CustomResource${Math.random() * 100}`, {
                policy: cr.AwsCustomResourcePolicy.fromSdkCalls({resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE}),
                onCreate: {
                    physicalResourceId: cr.PhysicalResourceId.of(`AutoAssignIPv6Create${Math.random() * 100}`),
                    service: 'EC2',
                    action: 'modifySubnetAttribute',
                    parameters: {
                        AssignIpv6AddressOnCreation: {Value: true},
                        SubnetId: subnet.subnetId
                    }
                }
            });
            autoAssignCR.node.addDependency(cfnSubnet);
        });


        //create security group for load balancer, allow http, https and icmp
        //create security group for API app, allow 5656 from load balancer
        //create security group for Redis, allow 6379 from API app
        //create security group for EFS, allow 2049 from API app

        this.loadBalancerSecurityGroup = new ec2.SecurityGroup(this, 'Load Balancer Security Group', {
            vpc: this.vpc,
            allowAllOutbound: true,
            description: 'Allow http and https IPv4/IPv6 from anywhere',
            securityGroupName: 'LoadBalancerSecurityGroup',
        });
        this.loadBalancerSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow http IPv4 from anywhere');
        this.loadBalancerSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow https IPv4 from anywhere');
        this.loadBalancerSecurityGroup.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(80), 'Allow http IPv6 from anywhere');
        this.loadBalancerSecurityGroup.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(443), 'Allow https IPv6 from anywhere');
        this.loadBalancerSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.icmpPing(), 'Allow icmp IPv4 from anywhere');
        this.loadBalancerSecurityGroup.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.icmpPing(), 'Allow icmp IPv6 from anywhere');

        this.apiSecurityGroup = new ec2.SecurityGroup(this, 'API Security Group', {
            vpc: this.vpc,
            allowAllOutbound: true,
            description: 'Allow 5656 from load balancer',
            securityGroupName: 'APISecurityGroup',
        });

        this.apiSecurityGroup.addIngressRule(this.loadBalancerSecurityGroup, ec2.Port.tcp(5656), 'Allow 5656 from load balancer');

        //if(!process.env.NO_REDIS) {
        this.redisSecurityGroup = new ec2.SecurityGroup(this, 'Redis Security Group', {
            vpc: this.vpc,
            allowAllOutbound: true,
            description: 'Allow 6379 from API app',
            securityGroupName: 'RedisSecurityGroup',
        });

        this.redisSecurityGroup.addIngressRule(this.apiSecurityGroup, ec2.Port.tcp(6379), 'Allow 6379 from API app');
        //}
        if (!process.env.NO_EFS) {
            this.efsSecurityGroup = new ec2.SecurityGroup(this, 'EFS Security Group', {
                vpc: this.vpc,
                allowAllOutbound: true,
                description: 'Allow 2049 from API app',
                securityGroupName: 'EFSSecurityGroup',
            });

            this.efsSecurityGroup.addIngressRule(this.apiSecurityGroup, ec2.Port.tcp(2049), 'Allow 2049 from API app');

        }

        const otherStack = new OtherStack(this);
        const apiStack = new ApiStack(this, otherStack);
        const publicStack = new PublicStack(this, apiStack);

    }

}