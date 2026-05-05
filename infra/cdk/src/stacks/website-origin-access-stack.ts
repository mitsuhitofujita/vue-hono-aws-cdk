import { Stack, type StackProps, Fn } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

interface WebsiteOriginAccessStackProps extends StackProps {
  websiteBucketName: string;
  distributionId: string;
}

export class WebsiteOriginAccessStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: WebsiteOriginAccessStackProps,
  ) {
    super(scope, id, props);

    new s3.CfnBucketPolicy(this, "WebsiteBucketPolicy", {
      bucket: props.websiteBucketName,
      policyDocument: {
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "cloudfront.amazonaws.com" },
            Action: "s3:GetObject",
            Resource: `arn:aws:s3:::${props.websiteBucketName}/*`,
            Condition: {
              StringEquals: {
                "AWS:SourceArn": Fn.join("", [
                  `arn:aws:cloudfront::${this.account}:distribution/`,
                  props.distributionId,
                ]),
              },
            },
          },
        ],
      },
    });
  }
}
