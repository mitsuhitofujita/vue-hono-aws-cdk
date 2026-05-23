#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { StorageStack } from "./stacks/storage-stack";
import { DistributionStack } from "./stacks/distribution-stack";
import { WebsiteOriginAccessStack } from "./stacks/website-origin-access-stack";
import { DeploymentStack } from "./stacks/deployment-stack";
import { AuthStack } from "./stacks/auth-stack";
import { AuthClientStack } from "./stacks/auth-client-stack";
import { AuthClientCallbackStack } from "./stacks/auth-client-callback-stack";
import { DataStack } from "./stacks/data-stack";
import { BackendStack } from "./stacks/backend-stack";
import { BackendDataAccessStack } from "./stacks/backend-data-access-stack";
import { BackendApiStack } from "./stacks/backend-api-stack";
import { DistributionApiOriginStack } from "./stacks/distribution-api-origin-stack";

const app = new cdk.App();
const envName = (app.node.tryGetContext("envName") as string | undefined) ?? "dev";

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

const googleClientId = (app.node.tryGetContext("googleClientId") as string | undefined) ?? "";
const googleClientSecret =
  (app.node.tryGetContext("googleClientSecret") as string | undefined) ?? "";

const authStack = new AuthStack(app, `${envName}-Auth`, {
  googleClientId,
  googleClientSecret,
});

const authClientStack = new AuthClientStack(app, `${envName}-AuthClient`, {
  userPool: authStack.userPool,
  googleIdp: authStack.googleIdp,
});

const dataStack = new DataStack(app, `${envName}-Data`);

const backendStack = new BackendStack(app, `${envName}-Backend`, {
  itemsTableName: dataStack.itemsTable.tableName,
});

new BackendDataAccessStack(app, `${envName}-BackendDataAccess`, {
  itemsTableName: dataStack.itemsTable.tableName,
  handlerRoleName: backendStack.handler.role!.roleName,
});

const backendApiStack = new BackendApiStack(app, `${envName}-BackendApi`, {
  handlerArn: backendStack.handler.functionArn,
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authClientStack.userPoolClient.userPoolClientId,
});

new DistributionApiOriginStack(app, `${envName}-DistributionApiOrigin`, {
  distribution: distributionStack.distribution,
  apiDomainName: backendApiStack.apiDomainName,
});

new AuthClientCallbackStack(app, `${envName}-AuthClientCallback`, {
  userPoolId: authStack.userPool.userPoolId,
  userPoolArn: authStack.userPool.userPoolArn,
  userPoolClientId: authClientStack.userPoolClient.userPoolClientId,
  distributionDomainName: distributionStack.distribution.distributionDomainName,
});
