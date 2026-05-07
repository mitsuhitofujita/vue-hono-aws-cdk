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
    - `AuthStack` no longer depends on the `Distribution`
- CDK refactoring
    - CloudFront previously depended on S3 via cross-stack references
    - Decompose into three stages — S3 creation, CloudFront creation, and the association between them — to eliminate the dependency
- Backend Lambda resource provisioning
    - Add backend stacks under `infra/cdk`
    - Use an HTTP API JWT authorizer for signature and expiry validation
        - Cognito JWT authorizer integration
- Call the backend from the frontend and render the response JSON on the page
    - Request `/api/items` and render the returned JSON
- Item list page implementation
    - Core features only
- Backend access to DynamoDB
    - Read from DynamoDB and return its contents in the response
    - Scope: `/api/items` only
    - Expected result: empty

## In Progress

- Item create page implementation
- Item list page feature additions
    - ADD button

## Planned (not yet started)

- Item list page implementation
    - Avatar menu, pagination, sorting
- Backend feature tests running locally against a local DynamoDB
    - Decouple the Lambda runtime layer so tests can exercise the storage layer
- Linter integration
- Frontend refactoring with component architecture in mind
