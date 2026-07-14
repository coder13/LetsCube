# Let's Cube Agent Guidelines

This file is only for durable, repository-specific instructions that change how
coding agents should work. Feature behavior, architecture, deployment details,
known bugs, and operational procedures belong in normal documentation and tests.
Do not duplicate them here.

## Find The Source Of Truth

- Read the relevant README, `docs/` file, tests, configuration, and surrounding
  code before changing behavior. Prefer those sources over conversation history
  or assumptions from similarly named branches.
- When a change introduces a durable feature rule or operational procedure,
  update the owning documentation or tests instead of adding it to this file.
- Keep this file short. Do not use it for task status, backlog notes, temporary
  workarounds, or descriptions of individual features.

## Keep Changes Focused

- Match existing project patterns and make the smallest coherent change. The
  repository contains legacy and modernized areas side by side, so avoid broad
  rewrites or dependency upgrades unless they are part of the task.
- Do not mix cleanup, refactoring, generated-file churn, or unrelated fixes into
  a feature branch. Preserve pre-existing user changes and untracked files.
- If the requested direction changes, remove the abandoned implementation before
  building the replacement.

## Code Structure And Comments

- Prefer clear names and structure over comments. Add a comment only to explain a
  non-obvious invariant, external constraint, compatibility requirement, safety
  concern, or intentional tradeoff. Explain why, not what the next line does.
- Do not leave development narration, conversation history, commented-out code,
  or vague TODO/FIXME notes. Link actionable follow-up work to an issue, and
  update or remove comments when the surrounding behavior changes.
- Keep functions cohesive and easy to understand, but do not mechanically
  extract every expression. A function should own a meaningful unit of behavior,
  not merely wrap a one-liner unless an interface or callback requires it.
- Treat a convoluted function name as a design smell: simplify the responsibility
  or keep the operation inline. Split functions that mix responsibilities or
  accumulate difficult branching, without maximizing the number of functions.
- Do not add speculative abstractions, configuration, or fallback paths for
  hypothetical future needs. Implement the current contract and make violated
  invariants visible instead of silently masking them.

## Branch And Worktree Hygiene

- This repository often has several active worktrees and stale local branches.
  Confirm the current worktree, branch, status, and merge base before editing.
- Start unrelated work in a fresh branch and worktree so active changes remain
  isolated. Unless explicitly told otherwise, fetch first and create the new
  worktree from `origin/master`, not from the currently checked-out feature
  branch.
- Before publishing, inspect both the commit list and
  `git diff --stat origin/master...HEAD`. Rebase or cherry-pick onto the intended
  base if the diff contains unrelated work.

## Monorepo Discipline

- This is a Yarn classic workspace monorepo. Install from the repository root,
  use the root `yarn.lock`, and do not create workspace-level lockfiles.
- Prefer root Turbo commands for broad checks and workspace-filtered commands
  for focused iteration. Follow existing package boundaries rather than adding
  cross-workspace source imports.
- Before adding a dependency, check whether the platform or an existing
  dependency already solves the problem clearly. Add it only to the workspace
  that uses it and explain non-obvious choices.

## Local Machine Gotcha

- Use the system Docker engine on this machine. The Docker Desktop context is
  unreliable, so inspect the current context and run project Compose commands
  with `DOCKER_CONTEXT=default`.

## Verification And Handoff

- Run the narrowest meaningful lint and tests while iterating, then broaden
  checks when a change crosses workspace or runtime boundaries.
- Before handoff, review the complete diff for scope, run `git diff --check`,
  and state exactly which checks passed, failed, or were not run.
- When committing, include a concise body explaining what changed and why.
