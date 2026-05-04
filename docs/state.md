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

## In Progress

- Backend code scaffolding
    - Initial setup of the Hono framework targeting Lambda
        - Located in the `apps/backend` directory
    - Implement the item list API returning an empty (or dummy) item list

## Planned (not yet started)

- Backend Lambda resource provisioning
    - Add a backend stack under `infra/cdk`
    - Use an API Gateway authorizer for signature verification and expiration handling
        - Evaluate the Cognito user pool authorizer
- Backend access to DynamoDB
- Backend feature tests running locally against a local DynamoDB
    - Isolate the Lambda layer and run tests that exercise storage
- Linter integration
- Item list page implementation
- Item create page implementation
- Frontend refactoring with component architecture
- Backend implementation
- CDK refactoring
    - Currently CloudFront depends on S3
    - Separate into three stages: S3 creation, CloudFront creation, and association of both, to eliminate the dependency
