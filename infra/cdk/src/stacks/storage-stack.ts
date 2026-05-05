import { RemovalPolicy, Stack, type StackProps, CfnOutput } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

interface StorageStackProps extends StackProps {
  websiteBucketName: string;
}

export class StorageStack extends Stack {
  public readonly websiteBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    this.websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      bucketName: props.websiteBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new CfnOutput(this, "BucketName", {
      value: this.websiteBucket.bucketName,
    });
  }
}
