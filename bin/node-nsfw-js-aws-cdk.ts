#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import '../lib/NodeNsfwJs'
import {NodeNsfwJs} from "../lib/NodeNsfwJs";

const app = new cdk.App();
let props = {
    stackName: 'NodeNsfwJs',
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
};
if (process.env.REGIONS) {
    const regions = process.env.REGIONS.split(',');
    const primaryRegion = regions[0];
    for (const region of process.env.REGIONS.split(',')) {
        region.trim();
        props.env.region = region;
        const isPrimaryRegion = region === primaryRegion;
        const mainStack = new NodeNsfwJs(app, 'NodeNsfwJs-' + region, props, isPrimaryRegion);
    }
} else {
    const mainStack = new NodeNsfwJs(app, 'NodeNsfwJs', props);
}

/*
const otherStack = new OtherStack(app, 'OtherStack', mainStack, props);
const apiStack = new ApiStack(app, 'ApiStack', mainStack, otherStack, props);
const publicStack = new PublicStack(app, 'PublicStack', mainStack, apiStack, props);
*/
app.synth();
