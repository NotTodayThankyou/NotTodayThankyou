#!/usr/bin/env bash
set -e

echo "Checking workflow runs for $HEAD_REPO at commit $HEAD_SHA..."

# Fetch action runs triggered on the fork repository for the head commit
RUN_COUNT=$(gh api "repos/$HEAD_REPO/actions/runs?head_sha=$HEAD_SHA" --jq '.total_count')

if [ "$RUN_COUNT" -eq 0 ]; then
  echo "Failure: No workflow runs found on $HEAD_REPO for commit $HEAD_SHA."

  # Post explanatory comment
  gh pr comment "$PR_NUMBER" --body "❌ **PR Automatically Closed**: Workflows have not been executed on your fork (`$HEAD_REPO`). Please enable GitHub Actions on your fork, run your workflow suite, and reopen this PR."

  # Close the PR
  gh pr close "$PR_NUMBER"

  exit 1
fi

echo "Success: Found $RUN_COUNT workflow run(s) on $HEAD_REPO."
exit 0