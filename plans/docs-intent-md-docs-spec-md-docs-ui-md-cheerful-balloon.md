# Backend Lambda + API Gateway CDK Stack

## Context

`docs/state.md` lists "Backend Lambda resource provisioning" as the current
**In Progress** item, with these requirements:

- Add a backend stack under `infra/cdk`
- Use an API Gateway authorizer for signature/expiry validation
- Evaluate the Cognito user pool authorizer

The goal is to expose the existing Hono backend (`apps/backend/src/lambda.ts`)
through API Gateway behind the existing CloudFront distribution at `/api/*`,
with all requests authenticated by Cognito-issued JWTs. Routing must remain
single-distribution (per spec — no CORS) and every resource must remain
pay-per-use so the AWS bill stays at $0 when idle.

The refactor follows the existing "creation vs. association" stack-separation
pattern used by `WebsiteOriginAccessStack` and `AuthClientStack`, and the
spec's "separate by update frequency" rule (Lambda code changes often;
API Gateway and DynamoDB rarely).

## Decisions (confirmed with user)

| Decision | Choice |
|---|---|
| API Gateway flavor | HTTP API (`aws-cdk-lib/aws-apigatewayv2`) — JWT authorizer, lower cost |
| Lambda packaging | `aws-cdk-lib/aws-lambda-nodejs` `NodejsFunction` (esbuild at synth) |
| Authorizer location | Inside `BackendApiStack` (intrinsic to the API) |
| Lambda → DynamoDB grant | Separate `BackendDataAccessStack` (association) |
| Lambda → API integration | Inside `BackendApiStack` (only meaningful with the API) |
| `/api/*` CloudFront behavior | Separate `DistributionApiOriginStack` (association) |
| SPA fallback fix | Replace `errorResponses` with a CloudFront Function on the default behavior only |

## Files to add or modify

| Path | Change |
|---|---|
| `infra/cdk/src/stacks/backend-stack.ts` | **New** — Lambda function |
| `infra/cdk/src/stacks/backend-data-access-stack.ts` | **New** — Lambda → DynamoDB IAM grant |
| `infra/cdk/src/stacks/backend-api-stack.ts` | **New** — HTTP API + JWT authorizer + Lambda integration |
| `infra/cdk/src/stacks/distribution-api-origin-stack.ts` | **New** — CloudFront `/api/*` behavior |
| `infra/cdk/src/stacks/distribution-stack.ts` | **Modify** — replace `errorResponses` with CloudFront Function on default behavior |
| `infra/cdk/src/main.ts` | **Modify** — instantiate the new stacks and wire props |
| `infra/cdk/package.json` | **Modify** — add `esbuild` devDependency (avoids Docker fallback at synth) |
| `docs/state.md` | **Modify** — move the In Progress item to Completed; promote next item |

No changes to `apps/backend/` source code, `apps/frontend/`, or any other
existing stack besides `DistributionStack`.

## Stack-by-stack design

All stack IDs follow the existing `${envName}-X` convention.

### 1. `BackendStack` — `${envName}-Backend` (frequent updates)

Creates the Lambda function only.

- `NodejsFunction` named `ApiHandler`
  - `entry`: `apps/backend/src/lambda.ts` (resolved with `path.join(__dirname, "../../../../apps/backend/src/lambda.ts")` to match the existing `DeploymentStack` pattern)
  - `handler`: `"handler"`
  - `runtime`: `lambda.Runtime.NODEJS_22_X`
  - `architecture`: `lambda.Architecture.ARM_64`
  - `memorySize`: 256
  - `timeout`: `Duration.seconds(10)`
  - `bundling`: `{ format: OutputFormat.ESM, target: "node22", minify: true, sourceMap: true, mainFields: ["module", "main"], banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" }`
  - `environment`: `{ TABLE_NAME: props.itemsTableName, NODE_OPTIONS: "--enable-source-maps" }`
  - `logRetention`: `logs.RetentionDays.ONE_WEEK`
- Public:
  - `handler: NodejsFunction`
- Props:
  - `itemsTableName: string` (passed as a string token from `DataStack` to keep `DataStack` independent of the L2 Lambda)
- CfnOutputs: `ApiHandlerName`, `ApiHandlerArn`

### 2. `BackendDataAccessStack` — `${envName}-BackendDataAccess` (association)

Pure IAM-grant stack, mirroring `WebsiteOriginAccessStack`'s pattern of
wiring two resources together via string props rather than L2 references.

- `iam.CfnPolicy` attached to the Lambda's execution role by **role name**
  - Actions: `dynamodb:GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query`, `BatchWriteItem`
  - Resource ARNs:
    - `arn:aws:dynamodb:${this.region}:${this.account}:table/${itemsTableName}`
    - `arn:aws:dynamodb:${this.region}:${this.account}:table/${itemsTableName}/index/*`
- Props:
  - `itemsTableName: string`
  - `handlerRoleName: string` (sourced from `backendStack.handler.role!.roleName`)
- No public properties.

### 3. `BackendApiStack` — `${envName}-BackendApi` (rare updates)

Creates the HTTP API, JWT authorizer, and proxy integration.

- `apigatewayv2.HttpApi` named `BackendHttpApi`
  - `apiName`: `tocoop-${envName}-api`
  - `createDefaultStage`: true (the auto-deploying `$default` stage is sufficient)
  - No CORS configuration (single-origin by spec)
- `HttpJwtAuthorizer` named `CognitoJwtAuthorizer`
  - `jwtIssuer`: `https://cognito-idp.${this.region}.amazonaws.com/${props.userPoolId}`
  - `jwtAudience`: `[props.userPoolClientId]`
  - Identity source defaults to `$request.header.Authorization` (matches `Bearer <token>`)
  - The frontend must send the **ID token** (its `aud` is the user pool client ID; the access token's is not).
- Lambda integration via `lambda.Function.fromFunctionAttributes(this, "ImportedHandler", { functionArn: props.handlerArn, sameEnvironment: true })` so this stack can mutate the function's resource policy.
- Single proxy route covering all REST endpoints in the spec:
  - `httpApi.addRoutes({ path: "/api/{proxy+}", methods: [HttpMethod.ANY], integration: new HttpLambdaIntegration("ApiIntegration", importedHandler), authorizer })`
- Public:
  - `httpApi: HttpApi`
  - `apiDomainName: string` — `${this.httpApi.httpApiId}.execute-api.${this.region}.amazonaws.com` (string so `DistributionApiOriginStack` doesn't need an L2 cross-stack reference)
- Props:
  - `handlerArn: string`
  - `userPoolId: string`
  - `userPoolClientId: string`
- CfnOutputs: `HttpApiId`, `HttpApiEndpoint`, `ApiDomainName`

### 4. `DistributionApiOriginStack` — `${envName}-DistributionApiOrigin` (association)

Adds the `/api/*` cache behavior to the existing CloudFront distribution.

- `props.distribution.addBehavior("/api/*", new origins.HttpOrigin(props.apiDomainName, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY }), { ... })` with:
  - `viewerProtocolPolicy: REDIRECT_TO_HTTPS`
  - `allowedMethods: AllowedMethods.ALLOW_ALL`
  - `cachePolicy: CachePolicy.CACHING_DISABLED`
  - `originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER`
    - This managed policy forwards `Authorization` (required for JWT auth) but strips `Host` so API Gateway can resolve the API ID. **Do not** use `ALL_VIEWER` — it would forward the CloudFront `Host` and break API Gateway routing.
- Props:
  - `distribution: cloudfront.IDistribution` (L2 — `addBehavior` requires it)
  - `apiDomainName: string`
- No public properties.
- **Note**: because `addBehavior` mutates the L2 `Distribution`, the resulting CFN diff lands in `${envName}-Distribution`'s template, not in this stack's. Code-level separation is intentional and matches the existing pattern.

### 5. `DistributionStack` modifications

The existing `errorResponses` (`403`/`404` → `/index.html`) would rewrite
legitimate API Gateway 401/403/404 responses returning from `/api/*` and
break the API. Replace it with a viewer-request **CloudFront Function**
attached only to the **default behavior**:

- Remove the `errorResponses` array from the `Distribution` props.
- Inline a small `cloudfront.Function`:
  - If the request URI does not start with `/assets/`, does not contain a file extension, and is not `/index.html`, rewrite `event.request.uri` to `/index.html`.
  - Attach to the default behavior only via `defaultBehavior.functionAssociations`.
- Keep `defaultRootObject: "index.html"`.

Because the function is attached to the **default** behavior only (not `/api/*`,
which is added by `DistributionApiOriginStack` with no function association),
API responses pass through untouched.

### 6. `main.ts` wiring

Append to the existing instantiations (`Storage`, `Distribution`,
`WebsiteOriginAccess`, `Deployment`, `Auth`, `AuthClient`, `Data`):

```ts
const backendStack = new BackendStack(app, `${envName}-Backend`, {
  itemsTableName: dataStack.itemsTable.tableName,
});

new BackendDataAccessStack(app, `${envName}-BackendDataAccess`, {
  itemsTableName: dataStack.itemsTable.tableName,
  handlerRoleName: backendStack.handler.role!.roleName,
});

const backendApiStack = new BackendApiStack(app, `${envName}-BackendApi`, {
  handlerArn: backendStack.handler.functionArn,
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authClientStack.userPoolClient.userPoolClientId,
});

new DistributionApiOriginStack(app, `${envName}-DistributionApiOrigin`, {
  distribution: distributionStack.distribution,
  apiDomainName: backendApiStack.apiDomainName,
});
```

`authClientStack` must be assigned to a local variable (currently anonymous) so
its `userPoolClient.userPoolClientId` can flow into `BackendApiStack`.

Stack count: 7 → 11. CDK derives deploy order from the cross-stack references.

### 7. `infra/cdk/package.json`

Add to `devDependencies`:

```json
"esbuild": "^0.24.0"
```

This lets `NodejsFunction` bundle locally and skip the Docker fallback during
`cdk synth`.

## Reuse / no new patterns

- `path.join(__dirname, "../../../../apps/backend/src/lambda.ts")` for the
  `NodejsFunction` entry mirrors the existing `DeploymentStack` reference
  to `apps/frontend/dist`.
- IAM grants by role name + ARN strings mirror `WebsiteOriginAccessStack`'s
  bucket-policy approach.
- String-prop cross-stack references (rather than L2) are the established
  convention everywhere except where the L2 is unavoidable
  (`Distribution` → `addBehavior` in (4); `userPool`/`googleIdp` already
  flow as L2 between `AuthStack` and `AuthClientStack`).

## `docs/state.md` update

Move out of "In Progress":

```
- Backend Lambda resource provisioning
    - Add a backend stack under `infra/cdk`
    - Use an API Gateway authorizer for signature verification and expiration handling
        - Evaluate the Cognito user pool authorizer
```

Add to "Completed":

```
- Backend Lambda resource provisioning
    - Added `BackendStack` for the Lambda function (NodejsFunction with esbuild)
    - Added `BackendDataAccessStack` to grant the Lambda DynamoDB access
    - Added `BackendApiStack` for HTTP API + Cognito JWT authorizer + Lambda proxy integration
    - Added `DistributionApiOriginStack` for the CloudFront `/api/*` behavior
    - Replaced CloudFront SPA fallback `errorResponses` with a CloudFront Function on the default behavior so API responses are not rewritten
```

Promote "Backend access to DynamoDB" from "Planned" to "In Progress".

## Verification (run by user)

```bash
# 1. Backend type-check
pnpm --filter @vue-hono-aws-cdk/backend typecheck

# 2. CDK synth — validate all templates
pnpm --filter @vue-hono-aws-cdk/iac cdk synth \
  -c googleClientId=$G_ID -c googleClientSecret=$G_SECRET

# 3. Deploy all stacks
pnpm --filter @vue-hono-aws-cdk/iac cdk deploy --all --require-approval never \
  -c googleClientId=$G_ID -c googleClientSecret=$G_SECRET

# 4. Unauthenticated request → 401
DIST=$(aws cloudformation describe-stacks --stack-name dev-Distribution \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionDomainName'].OutputValue" --output text)
curl -i "https://${DIST}/api/items"     # expect 401

# 5. Authenticated request — sign in via the frontend, copy idToken from
#    fetchAuthSession() in the browser console
TOKEN=...
curl -i -H "Authorization: Bearer ${TOKEN}" "https://${DIST}/api/items"
# expect 200 with {"items":[ ... ]}

# 6. SPA fallback still works (CloudFront Function rewrites unknown SPA paths)
curl -i "https://${DIST}/items"          # expect 200, index.html

# 7. Tear down
pnpm --filter @vue-hono-aws-cdk/iac cdk destroy --all
```

Additional sanity checks:
- `aws logs tail /aws/lambda/<name> --follow` during step 5 — no error logs expected.
- API Gateway console — confirm the `/api/{proxy+}` route shows the JWT authorizer attached.
- Cognito console — callback URLs unchanged (no AuthClient changes in this work).
