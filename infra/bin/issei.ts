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
  // --- Domain: ON. Serves HTTPS at api.issei.app via an ACM cert (DNS-validated
  //     against the Route53 hosted zone created when issei.app was registered) and
  //     a Route53 A-alias → ALB. Requires the hosted zone to exist at deploy time.
  //     To go back to raw-ALB HTTP, comment these two lines out. ---
  domainName: 'issei.app',
  apiSubdomain: 'api',             // → https://api.issei.app
  githubOrg: 'charman02',          // GitHub org/user for OIDC trust
  githubRepo: 'issei',             // GitHub repo name
});
