import { Stack, type StackProps } from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import type { Construct } from "constructs";

interface DistributionApiOriginStackProps extends StackProps {
  distribution: cloudfront.Distribution;
  apiDomainName: string;
}

export class DistributionApiOriginStack extends Stack {
  constructor(scope: Construct, id: string, props: DistributionApiOriginStackProps) {
    super(scope, id, props);

    props.distribution.addBehavior(
      "/api/*",
      new origins.HttpOrigin(props.apiDomainName, {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      }),
      {
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    );
  }
}
