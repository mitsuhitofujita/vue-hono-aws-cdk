#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { StorageStack } from "./stacks/storage-stack";
import { DistributionStack } from "./stacks/distribution-stack";
import { DeploymentStack } from "./stacks/deployment-stack";

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
