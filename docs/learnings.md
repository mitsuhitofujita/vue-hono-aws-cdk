# Learnings

A log of non-obvious tradeoffs, migration know-how, and engineering decisions
that do not belong in `intent.md`, `spec.md`, `ui.md`, or `state.md`.
Append new entries chronologically; each entry is self-contained.

## 2026-05-05 — Separating CDK stack creation from association

### Background

The S3 website bucket (`StorageStack`) and the CloudFront distribution
(`DistributionStack`) were tightly coupled: `DistributionStack` received the
bucket name as a CFN token from `StorageStack` (producing an `Fn::ImportValue`)
and also owned the `s3.CfnBucketPolicy` that linked them. The refactor moved
the bucket policy into a new `WebsiteOriginAccessStack` and switched the
bucket name to a literal computed once in `main.ts`. After the change there
is zero `Fn::ImportValue` between Storage and Distribution; only the wiring
stack imports the distribution ID.

### Tradeoffs realized

**Benefits**

- Single responsibility per stack: creation stacks own resources, wiring
  stacks own associations. The same pattern is expected to pay off as the
  Lambda / API Gateway / Cognito Authorizer stacks are added — the
  "updated frequently" tier in `spec.md`'s CDK Stack Strategy can stay
  thin while the foundation stacks remain stable.
- `cdk diff` output is easier to read: S3 setting changes do not churn
  the CloudFront template, and vice versa.
- Each sub-system can be destroyed and recreated independently for
  experimentation.

**Costs**

- Migration is painful. Switching to an explicit bucket name forces a
  bucket replacement, and any pre-existing CFN export between the old
  stacks must be dismantled in dependency order before destroy can
  complete.
- Globally unique bucket naming is now the developer's responsibility.
  `envName` collisions become real failures rather than CDK-suffixed
  auto-names.
- More stacks means longer `cdk deploy --all` and more places to inspect.
  At single-developer scale the marginal value is mostly educational;
  the clearer payoff arrives once the backend stacks land.
- Working against `S3BucketOrigin.withOriginAccessControl()` produces a
  CDK synth warning ("Cannot update bucket policy of an imported
  bucket"). The warning is benign — the policy is supplied by the wiring
  stack — but it is a signal that we are off the L2 happy path.

### Migration know-how (gained the hard way)

`cdk destroy --all` is **not** safe in one shot when stacks share
`Fn::ImportValue` references. CloudFormation refuses to delete an export
while it is still imported, and CDK's chosen order is not always reliable.
Procedure for next time:

1. Inventory exports before starting:

   ```bash
   aws cloudformation list-exports \
     --query "Exports[?starts_with(Name, 'dev-')]"
   ```

2. Destroy importing stacks before exporting stacks. Run `cdk destroy`
   per stack from the leaves toward the roots, not `--all`.

3. **Do not delete underlying resources by hand** to "speed up"
   destruction. Once the actual resource is gone, CFN cannot reach it
   via the API and subsequent `delete-stack` calls fail on cleanup
   operations (e.g., `s3:PutBucketPolicy` against a missing bucket
   surfaces as the misleading "Last applied policy cannot be deleted"
   error).

4. `--retain-resources` is only valid on a stack already in
   `DELETE_FAILED`. The first delete attempt must fail before retain
   becomes available:

   ```bash
   # First call: ordinary destroy.
   aws cloudformation delete-stack --stack-name dev-Storage

   # Only after the stack reaches DELETE_FAILED:
   aws cloudformation describe-stack-events \
     --stack-name dev-Storage \
     --query "StackEvents[?ResourceStatus=='DELETE_FAILED'].[LogicalResourceId,ResourceStatusReason]" \
     --output table

   aws cloudformation delete-stack \
     --stack-name dev-Storage \
     --retain-resources <LogicalId> [...]
   ```

5. When recovering from a manually-deleted bucket, include both the
   bucket logical id and `Custom::S3AutoDeleteObjects` in
   `--retain-resources`, since the auto-delete custom resource will
   fail to invoke against a non-existent bucket.
