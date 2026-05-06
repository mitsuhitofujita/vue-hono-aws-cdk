# Development State

## Completed

- Development environment setup using devcontainer
- Core documentation
- CDK project initialization
- CloudFront distribution resource
- S3 bucket for static website hosting
- Vue.js setup in `apps/frontend`
- Display only the application title on the home page
- Static web deployment
    - Home page displaying only the title is served
- UI design
- Home page implementation
    - No authentication
- Cognito resource definition in CDK
    - Google authentication only
    - Only display name and identifier are required by the application
- Apply design to the home page
    - Implement the unauthenticated view
        - Includes the Sign in with Google button
- Implement authentication on the home page
    - Enable the button and integrate with Cognito
    - Since only Google authentication is used, the Cognito hosted login UI is not used
    - Refer to `infra/cdk` and propagate the authentication credentials to the application via the Cognito callback
- Apply design to the home page
    - Implement the authenticated view
- Design of the item list page
    - Create an HTML design mockup under `docs/html`
    - This is an HTML file for design purposes only; Vue components or other application-level concerns need not be considered
    - Tailwind CSS may be used, but it does not need to match the v4 version adopted by the application
- Design of the item detail page
    - Create an HTML design mockup under `docs/html`
    - Keep the shared global header and footer, as well as the page header, font sizes, color palette, and icon sizes, exactly identical to the item list page
- DynamoDB table design and provisioning
- DynamoDB table definition added to CDK under `infra/cdk`
- Backend code scaffolding
    - Initial setup of the Hono framework targeting Lambda
        - Located in the `apps/backend` directory
    - Implement the item list API returning an empty (or dummy) item list
- Split the user pool client out of the Cognito stack
    - `AuthStack` no longer depends on the CloudFront `Distribution`
- Split the S3 bucket policy out of the CloudFront stack
    - Introduced `WebsiteOriginAccessStack` for the OAC bucket policy
    - `StorageStack` and `DistributionStack` no longer have a cross-stack reference
- Backend Lambda resource provisioning
    - Added `BackendStack` for the Lambda function (NodejsFunction with esbuild)
    - Added `BackendDataAccessStack` to grant the Lambda DynamoDB access
    - Added `BackendApiStack` for HTTP API + Cognito JWT authorizer + Lambda proxy integration
    - Added `DistributionApiOriginStack` for the CloudFront `/api/*` behavior
    - Replaced CloudFront SPA fallback `errorResponses` with a CloudFront Function on the default behavior so API responses are not rewritten
    - Broke the AuthClient/Distribution/BackendApi 3-stack circular dependency by deferring CloudFront-domain OAuth callback updates to a new `AuthClientCallbackStack` (uses an `AwsCustomResource` calling `cognito-idp:UpdateUserPoolClient`)
- Wire the frontend to the backend and render the response JSON on the page
    - Calls `GET /api/items` from the SPA and renders the returned items
    - Sends `Authorization: Bearer <idToken>` (Cognito ID token, matching the HTTP API JWT authorizer audience)
    - Response body shape (mock):
      ```json
      { "items": [
        { "itemId": "i1", "name": "エアコン", "purchaseYear": 2026, "purchaseMonth": 3 },
        { "itemId": "i2", "name": "冷蔵庫", "purchaseYear": 2025, "purchaseMonth": 11 },
        { "itemId": "i3", "name": "洗濯機", "purchaseYear": 2024, "purchaseMonth": 6 }
      ] }
      ```
- Item list page implementation (initial)
    - `/items` route added via `vue-router`; auth-guarded (unauthenticated users redirect to `/`)
    - Layout matches `docs/html/item-list.html` (header with avatar, page header, ADD button, list, pagination UI)
    - Avatar slide-in nav menu deferred — the avatar currently links back to `/`
    - ADD button rendered but inert
    - Pagination UI rendered but inert (backend has no pagination yet); shows `1 / 1`

## In Progress

## Planned (not yet started)

- Backend access to DynamoDB
    - Read from DynamoDB and return its contents in the response
    - Scope: `/api/items` only
    - Expected result: empty
- Backend feature tests running locally against a local DynamoDB
    - Decouple the Lambda runtime layer so tests can exercise the storage layer
- Linter integration
- Item create page implementation
- Frontend refactoring with component architecture in mind
- Backend implementation
