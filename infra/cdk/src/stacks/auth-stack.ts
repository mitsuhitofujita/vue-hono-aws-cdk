import {
  RemovalPolicy,
  SecretValue,
  Stack,
  type StackProps,
  CfnOutput,
} from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import type { Construct } from "constructs";

interface AuthStackProps extends StackProps {
  distributionDomainName: string;
  googleClientId: string;
  googleClientSecret: string;
}

export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const envName = this.node.tryGetContext("envName") ?? "dev";

    this.userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
        profilePicture: { required: false, mutable: true },
      },
      accountRecovery: cognito.AccountRecovery.NONE,
      removalPolicy: RemovalPolicy.DESTROY,
      featurePlan: cognito.FeaturePlan.LITE,
      mfa: cognito.Mfa.OFF,
    });

    const googleIdp = new cognito.UserPoolIdentityProviderGoogle(
      this,
      "GoogleIdp",
      {
        userPool: this.userPool,
        clientId: props.googleClientId,
        clientSecretValue: SecretValue.unsafePlainText(
          props.googleClientSecret,
        ),
        scopes: ["openid", "email", "profile"],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          fullname: cognito.ProviderAttribute.GOOGLE_NAME,
          profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        },
      },
    );

    this.userPool.addDomain("CognitoDomain", {
      cognitoDomain: { domainPrefix: `${envName}-tocoop` },
    });

    this.userPoolClient = this.userPool.addClient("WebClient", {
      generateSecret: false,
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: [
          `https://${props.distributionDomainName}/`,
          "http://localhost:5173/",
        ],
        logoutUrls: [
          `https://${props.distributionDomainName}/`,
          "http://localhost:5173/",
        ],
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
      },
    });

    this.userPoolClient.node.addDependency(googleIdp);

    new CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
    });

    new CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
    });

    new CfnOutput(this, "UserPoolDomainPrefix", {
      value: `${envName}-tocoop`,
    });
  }
}
