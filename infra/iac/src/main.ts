#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { StorageStack } from "./stacks/storage-stack";
import { DistributionStack } from "./stacks/distribution-stack";

const app = new cdk.App();
const envName = app.node.tryGetContext("envName") ?? "dev";

const storageStack = new StorageStack(app, `${envName}-Storage`);

new DistributionStack(app, `${envName}-Distribution`, {
  websiteBucketName: storageStack.websiteBucket.bucketName,
});
