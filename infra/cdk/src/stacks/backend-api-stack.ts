import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambda from "aws-cdk-lib/aws-lambda";
import type { Construct } from "constructs";

interface BackendApiStackProps extends StackProps {
  handlerArn: string;
  userPoolId: string;
  userPoolClientId: string;
}

export class BackendApiStack extends Stack {
  public readonly httpApi: HttpApi;
  public readonly apiDomainName: string;

  constructor(scope: Construct, id: string, props: BackendApiStackProps) {
    super(scope, id, props);

    const envName = (this.node.tryGetContext("envName") as string | undefined) ?? "dev";

    this.httpApi = new HttpApi(this, "BackendHttpApi", {
      apiName: `tocoop-${envName}-api`,
      createDefaultStage: true,
    });

    const authorizer = new HttpJwtAuthorizer(
      "CognitoJwtAuthorizer",
      `https://cognito-idp.${this.region}.amazonaws.com/${props.userPoolId}`,
      {
        jwtAudience: [props.userPoolClientId],
      },
    );

    const importedHandler = lambda.Function.fromFunctionAttributes(this, "ImportedHandler", {
      functionArn: props.handlerArn,
      sameEnvironment: true,
    });

    this.httpApi.addRoutes({
      path: "/api/{proxy+}",
      methods: [HttpMethod.ANY],
      integration: new HttpLambdaIntegration("ApiIntegration", importedHandler),
      authorizer,
    });

    this.apiDomainName = `${this.httpApi.httpApiId}.execute-api.${this.region}.amazonaws.com`;

    new CfnOutput(this, "HttpApiId", {
      value: this.httpApi.httpApiId,
    });

    new CfnOutput(this, "HttpApiEndpoint", {
      value: this.httpApi.apiEndpoint,
    });

    new CfnOutput(this, "ApiDomainName", {
      value: this.apiDomainName,
    });
  }
}
