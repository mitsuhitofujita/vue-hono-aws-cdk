import { Stack, type StackProps, CfnOutput, Fn } from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

interface DistributionStackProps extends StackProps {
  websiteBucketName: string;
}

export class DistributionStack extends Stack {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: DistributionStackProps) {
    super(scope, id, props);

    const websiteBucket = s3.Bucket.fromBucketName(
      this,
      "WebsiteBucket",
      props.websiteBucketName,
    );

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin:
          origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
    });

    new s3.CfnBucketPolicy(this, "WebsiteBucketPolicy", {
      bucket: props.websiteBucketName,
      policyDocument: {
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "cloudfront.amazonaws.com" },
            Action: "s3:GetObject",
            Resource: `${websiteBucket.bucketArn}/*`,
            Condition: {
              StringEquals: {
                "AWS:SourceArn": Fn.join("", [
                  `arn:aws:cloudfront::${this.account}:distribution/`,
                  this.distribution.distributionId,
                ]),
              },
            },
          },
        ],
      },
    });

    new CfnOutput(this, "DistributionDomainName", {
      value: this.distribution.distributionDomainName,
    });

    new CfnOutput(this, "DistributionId", {
      value: this.distribution.distributionId,
    });
  }
}
