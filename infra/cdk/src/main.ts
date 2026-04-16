#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { StorageStack } from "./stacks/storage-stack";
import { DistributionStack } from "./stacks/distribution-stack";
import { DeploymentStack } from "./stacks/deployment-stack";
import { AuthStack } from "./stacks/auth-stack";

const app = new cdk.App();
const envName = app.node.tryGetContext("envName") ?? "dev";

const storageStack = new StorageStack(app, `${envName}-Storage`);

const distributionStack = new DistributionStack(app, `${envName}-Distribution`, {
  websiteBucketName: storageStack.websiteBucket.bucketName,
});

new DeploymentStack(app, `${envName}-Deployment`, {
  websiteBucket: storageStack.websiteBucket,
  distribution: distributionStack.distribution,
});

const googleClientId = app.node.tryGetContext("googleClientId") ?? "";
const googleClientSecret = app.node.tryGetContext("googleClientSecret") ?? "";

new AuthStack(app, `${envName}-Auth`, {
  distributionDomainName: distributionStack.distribution.distributionDomainName,
  googleClientId,
  googleClientSecret,
});
