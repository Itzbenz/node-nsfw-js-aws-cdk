#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import '../lib/NodeNsfwJs'
import {NodeNsfwJs} from "../lib/NodeNsfwJs";
import {OtherStack} from "../lib/OtherStack";
import {ApiStack} from "../lib/ApiStack";
import {PublicStack} from "../lib/PublicStack";

const app = new cdk.App();
const props = {
    stackName: 'NodeNsfwJs',
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
};
const mainStack = new NodeNsfwJs(app, 'NodeNsfwJs', props);
/*
const otherStack = new OtherStack(app, 'OtherStack', mainStack, props);
const apiStack = new ApiStack(app, 'ApiStack', mainStack, otherStack, props);
const publicStack = new PublicStack(app, 'PublicStack', mainStack, apiStack, props);
*/
app.synth();
