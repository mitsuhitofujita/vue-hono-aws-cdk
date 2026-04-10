# Development State

## Completed

- Development environment setup using devcontainer
- Core documentation
- CDK project initialization
- CloudFront distribution resource
- S3 bucket for static website hosting
- Vue.js setup in `apps/frontend`
- Display only the application title on the home page

## In Progress

- Static web deployment

## Planned (not yet started)

- Linter integration
- Page layout implementation
- UI/UX design
- Authentication implementation
- Backend implementation
- CDK refactoring
    - Currently CloudFront depends on S3
    - Separate into three stages: S3 creation, CloudFront creation, and association of both, to eliminate the dependency
