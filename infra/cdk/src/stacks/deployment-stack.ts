import { Stack, type StackProps } from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as path from "path";
import type { Construct } from "constructs";

interface DeploymentStackProps extends StackProps {
  websiteBucket: s3.IBucket;
  distribution: cloudfront.IDistribution;
}

export class DeploymentStack extends Stack {
  constructor(scope: Construct, id: string, props: DeploymentStackProps) {
    super(scope, id, props);

    new s3deploy.BucketDeployment(this, "WebsiteDeployment", {
      sources: [s3deploy.Source.asset(path.join(__dirname, "../../../../apps/frontend/dist"))],
      destinationBucket: props.websiteBucket,
      distribution: props.distribution,
      distributionPaths: ["/*"],
    });
  }
}
