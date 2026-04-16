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
    - Display name, identifier, and profile picture

## In Progress

## Planned (not yet started)

- Apply design to the home page
- Implement authentication on the home page
- Linter integration
- Authentication implementation
- Frontend refactoring with component architecture
- Backend implementation
- CDK refactoring
    - Currently CloudFront depends on S3
    - Separate into three stages: S3 creation, CloudFront creation, and association of both, to eliminate the dependency
