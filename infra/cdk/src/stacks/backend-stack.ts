import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";
import type { Construct } from "constructs";

interface BackendStackProps extends StackProps {
  itemsTableName: string;
}

export class BackendStack extends Stack {
  public readonly handler: NodejsFunction;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    this.handler = new NodejsFunction(this, "ApiHandler", {
      entry: path.join(__dirname, "../../../../apps/backend/src/lambda.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      bundling: {
        format: OutputFormat.ESM,
        target: "node22",
        minify: true,
        sourceMap: true,
        mainFields: ["module", "main"],
        banner:
          "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
      environment: {
        TABLE_NAME: props.itemsTableName,
        NODE_OPTIONS: "--enable-source-maps",
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    new CfnOutput(this, "ApiHandlerName", {
      value: this.handler.functionName,
    });

    new CfnOutput(this, "ApiHandlerArn", {
      value: this.handler.functionArn,
    });
  }
}
