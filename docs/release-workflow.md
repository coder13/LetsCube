# Release Workflow

`dev` is the integration branch. `master` is the reviewed release branch.
Production deployment remains a separately authorized operation described in
[Production operations](operations.md).

## Branch Flow

1. Open each focused feature pull request against `dev`.
2. Review and merge the feature into `dev`.
3. Treat the resulting `dev` merge commit as the release candidate. Its push
   CI run must finish before promotion is considered.
4. Open a reviewed promotion from that exact `dev` commit to `master`.
5. After the promotion is merged and its `master` push CI passes, perform the
   separately authorized deployment procedure.

Do not bypass `dev` by merging feature work directly to `master`. A new commit
on `dev` after release-candidate validation requires a new validation run.

## Promotion Evidence

Before approving a `dev` to `master` promotion, record or link the following in
the promotion pull request:

- the exact `dev` commit SHA and its successful CI run, including Cypress for
  full-stack changes;
- the review that approved the promotion and any issue or milestone links;
- focused and broad checks relevant to the change, including checks not run;
- schema migration compatibility and data-backfill evidence when persistence
  changes are included; and
- the intended deployment target plus the rollback path validated under
  [Production operations](operations.md#failed-deployments-and-rollback).

## Release Blockers

A reviewer or release maintainer must block promotion when any required CI check
fails, the candidate SHA is unclear, review is incomplete, a migration cannot
run alongside the previous application image, deployment preflight or backup
restore evidence is missing, rollback has not been verified, or a security or
privacy concern is unresolved. Production deployment also stops without the
explicit operational authorization required by the operations guide.

## Deployment Handoff

After `master` CI is green, follow the operations guide in order:

1. complete the [preflight](operations.md#preflight) checks;
2. deploy with the documented procedure;
3. perform the [verification and monitoring](operations.md#verification-and-monitoring)
   checks; and
4. use the documented rollback procedure if readiness or verification fails.

This checklist is release evidence, not a substitute for the production
authorization, secrets, backups, or host-level checks described in the
operations guide.
