import { Stack, type StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

interface BackendDataAccessStackProps extends StackProps {
  itemsTableName: string;
  handlerRoleName: string;
}

export class BackendDataAccessStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: BackendDataAccessStackProps,
  ) {
    super(scope, id, props);

    const tableArn = `arn:aws:dynamodb:${this.region}:${this.account}:table/${props.itemsTableName}`;
    const tableIndexArn = `${tableArn}/index/*`;

    new iam.CfnPolicy(this, "BackendDataAccessPolicy", {
      policyName: `${id}-policy`,
      roles: [props.handlerRoleName],
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "dynamodb:GetItem",
              "dynamodb:PutItem",
              "dynamodb:UpdateItem",
              "dynamodb:DeleteItem",
              "dynamodb:Query",
              "dynamodb:BatchWriteItem",
            ],
            Resource: [tableArn, tableIndexArn],
          },
        ],
      },
    });
  }
}
