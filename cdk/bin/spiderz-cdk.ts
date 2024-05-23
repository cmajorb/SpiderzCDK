#!/usr/bin/env node
import 'source-map-support/register';
import {App} from 'aws-cdk-lib';
import { SpiderzCdkStack } from '../lib/spiderz-cdk-stack';
import { FrontEndStack } from '../lib/front-end-stack';

const app = new App();
new SpiderzCdkStack(app, 'SpiderzCdkStack', {
  env: { region: 'us-east-1' },
});

new FrontEndStack(app, 'FrontEndStack', {
  env: { 
    account: '432083695606',
    region: 'us-east-1' 
  },
});