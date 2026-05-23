import { RemovalPolicy, SecretValue, Stack, type StackProps, CfnOutput } from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import type { Construct } from "constructs";

interface AuthStackProps extends StackProps {
  googleClientId: string;
  googleClientSecret: string;
}

export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly googleIdp: cognito.UserPoolIdentityProviderGoogle;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const envName = (this.node.tryGetContext("envName") as string | undefined) ?? "dev";

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

    this.googleIdp = new cognito.UserPoolIdentityProviderGoogle(this, "GoogleIdp", {
      userPool: this.userPool,
      clientId: props.googleClientId,
      clientSecretValue: SecretValue.unsafePlainText(props.googleClientSecret),
      scopes: ["openid", "email", "profile"],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        fullname: cognito.ProviderAttribute.GOOGLE_NAME,
        profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
      },
    });

    this.userPool.addDomain("CognitoDomain", {
      cognitoDomain: { domainPrefix: `${envName}-tocoop` },
    });

    new CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
    });

    new CfnOutput(this, "UserPoolDomainPrefix", {
      value: `${envName}-tocoop`,
    });
  }
}
