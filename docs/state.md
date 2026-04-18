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

## In Progress

## Planned (not yet started)

- Implement authentication on the home page
- Apply design to the home page
    - Implement the authenticated view
- Backend resource provisioning
    - Implement the item list API that returns an empty item list
    - Use an API Gateway authorizer for signature verification and expiration handling
        - Evaluate the Cognito user pool authorizer
- Linter integration
- Item list page implementation
- Item create page implementation
- Frontend refactoring with component architecture
- Backend implementation
- CDK refactoring
    - Currently CloudFront depends on S3
    - Separate into three stages: S3 creation, CloudFront creation, and association of both, to eliminate the dependency
