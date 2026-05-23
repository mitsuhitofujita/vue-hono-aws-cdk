import { Stack, type StackProps } from "aws-cdk-lib";
import * as cr from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";

interface AuthClientCallbackStackProps extends StackProps {
  userPoolId: string;
  userPoolArn: string;
  userPoolClientId: string;
  distributionDomainName: string;
}

export class AuthClientCallbackStack extends Stack {
  constructor(scope: Construct, id: string, props: AuthClientCallbackStackProps) {
    super(scope, id, props);

    const callbackUrls = [`https://${props.distributionDomainName}/`, "http://localhost:5173/"];

    const updateCall: cr.AwsSdkCall = {
      service: "CognitoIdentityServiceProvider",
      action: "updateUserPoolClient",
      parameters: {
        UserPoolId: props.userPoolId,
        ClientId: props.userPoolClientId,
        AllowedOAuthFlows: ["code"],
        AllowedOAuthFlowsUserPoolClient: true,
        AllowedOAuthScopes: ["openid", "email", "profile"],
        CallbackURLs: callbackUrls,
        LogoutURLs: callbackUrls,
        SupportedIdentityProviders: ["Google"],
      },
      physicalResourceId: cr.PhysicalResourceId.of(`${props.userPoolClientId}-callbacks`),
    };

    new cr.AwsCustomResource(this, "UpdateOAuthCallbacks", {
      onCreate: updateCall,
      onUpdate: updateCall,
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [props.userPoolArn],
      }),
      installLatestAwsSdk: false,
    });
  }
}
