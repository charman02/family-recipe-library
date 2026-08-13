#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { IsseiStack } from '../lib/issei-stack';

const app = new cdk.App();

new IsseiStack(app, 'IsseiStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-west-2',
  },
  // --- Domain: OFF for now (verify-and-teardown artifact on the raw ALB DNS,
  //     no paid Route53 domain needed). To serve HTTPS at api.<domain> later,
  //     register the domain in Route53 and uncomment these two lines — no other
  //     change; the stack branches on their presence. ---
  // domainName: 'issei.app',
  // apiSubdomain: 'api',
  githubOrg: 'charman02',          // GitHub org/user for OIDC trust
  githubRepo: 'issei',             // GitHub repo name
});
