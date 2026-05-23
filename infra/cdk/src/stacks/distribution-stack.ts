import { Stack, type StackProps, CfnOutput } from "aws-cdk-lib";
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

    const websiteBucket = s3.Bucket.fromBucketName(this, "WebsiteBucket", props.websiteBucketName);

    const spaFallbackFunction = new cloudfront.Function(this, "SpaFallbackFunction", {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.indexOf('/assets/') === 0) {
    return request;
  }
  if (uri === '/index.html') {
    return request;
  }
  var lastSlash = uri.lastIndexOf('/');
  var lastSegment = uri.substring(lastSlash + 1);
  if (lastSegment.indexOf('.') !== -1) {
    return request;
  }
  request.uri = '/index.html';
  return request;
}
`),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          {
            function: spaFallbackFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    new CfnOutput(this, "DistributionDomainName", {
      value: this.distribution.distributionDomainName,
    });

    new CfnOutput(this, "DistributionId", {
      value: this.distribution.distributionId,
    });
  }
}
