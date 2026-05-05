#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { StorageStack } from "./stacks/storage-stack";
import { DistributionStack } from "./stacks/distribution-stack";
import { WebsiteOriginAccessStack } from "./stacks/website-origin-access-stack";
import { DeploymentStack } from "./stacks/deployment-stack";
import { AuthStack } from "./stacks/auth-stack";
import { AuthClientStack } from "./stacks/auth-client-stack";
import { DataStack } from "./stacks/data-stack";

const app = new cdk.App();
const envName = app.node.tryGetContext("envName") ?? "dev";

const websiteBucketName = `tocoop-${envName}-website`;

const storageStack = new StorageStack(app, `${envName}-Storage`, {
  websiteBucketName,
});

const distributionStack = new DistributionStack(app, `${envName}-Distribution`, {
  websiteBucketName,
});

new WebsiteOriginAccessStack(app, `${envName}-WebsiteOriginAccess`, {
  websiteBucketName,
  distributionId: distributionStack.distribution.distributionId,
});

new DeploymentStack(app, `${envName}-Deployment`, {
  websiteBucket: storageStack.websiteBucket,
  distribution: distributionStack.distribution,
});

const googleClientId = app.node.tryGetContext("googleClientId") ?? "";
const googleClientSecret = app.node.tryGetContext("googleClientSecret") ?? "";

const authStack = new AuthStack(app, `${envName}-Auth`, {
  googleClientId,
  googleClientSecret,
});

new AuthClientStack(app, `${envName}-AuthClient`, {
  userPool: authStack.userPool,
  googleIdp: authStack.googleIdp,
  distributionDomainName: distributionStack.distribution.distributionDomainName,
});

new DataStack(app, `${envName}-Data`);
