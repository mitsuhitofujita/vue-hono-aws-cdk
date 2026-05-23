import { Stack, type StackProps, CfnOutput } from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import type { Construct } from "constructs";

interface AuthClientStackProps extends StackProps {
  userPool: cognito.IUserPool;
  googleIdp: cognito.UserPoolIdentityProviderGoogle;
}

export class AuthClientStack extends Stack {
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthClientStackProps) {
    super(scope, id, props);

    this.userPoolClient = new cognito.UserPoolClient(this, "WebClient", {
      userPool: props.userPool,
      generateSecret: false,
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.GOOGLE],
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: ["http://localhost:5173/"],
        logoutUrls: ["http://localhost:5173/"],
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
      },
    });

    this.userPoolClient.node.addDependency(props.googleIdp);

    new CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
    });
  }
}
