import * as core from '@actions/core';
import * as github from '@actions/github';

interface TimelineNode {
  subject?: { __typename?: string };
  source?: { __typename?: string };
}

interface GraphQLResponse {
  repository?: {
    pullRequest?: {
      closingIssuesReferences?: { totalCount: number };
      timelineItems?: { nodes: TimelineNode[] };
    };
  };
}

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token') || process.env.GITHUB_TOKEN;
    if (!token) {
      core.setFailed('Missing GITHUB_TOKEN or github-token input.');
      return;
    }

    const octokit = github.getOctokit(token);
    const context = github.context;
    const pr = context.payload.pull_request;

    if (!pr) {
      core.setFailed('This action can only be run on pull_request or pull_request_target events.');
      return;
    }

    const author: string = pr.user.login;
    const headRepoOwner: string = pr.head.repo.owner.login;
    const headRepoName: string = pr.head.repo.name;
    const headRepoFullName: string = pr.head.repo.full_name;
    const headSha: string = pr.head.sha;
    const prNumber: number = pr.number;

    // =========================================================================
    // CHECK (i): ALLOWLIST & EXISTING CONTRIBUTOR BYPASS
    // =========================================================================
    const allowedAuthorsInput = core.getInput('allowed-authors') || '';
    const allowedAuthors = allowedAuthorsInput
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (allowedAuthors.includes(author.toLowerCase())) {
      core.info(`✅ Author '${author}' is explicitly in the allowlist. Bypassing all checks.`);
      return;
    }

    try {
      const { data: repositoryStats } = await octokit.rest.repos.getContributorsStats({
        owner: context.repo.owner,
        repo: context.repo.repo
      });

      const isContributor = Array.isArray(repositoryStats) &&
        repositoryStats.some(c => c.author && c.author.login.toLowerCase() === author.toLowerCase());

      if (isContributor) {
        core.info(`✅ Author '${author}' is an existing contributor to this repository. Bypassing all checks.`);
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      core.info(`⚠️ Could not fetch contributor stats (${message}). Proceeding with checks.`);
    }

    // State tracking
    let closePr = false;
    let failureMessages = '';

    const failCheck = (reasonMsg: string, logMsg: string): void => {
      core.info(`❌ Check Failed: ${logMsg}`);
      closePr = true;
      failureMessages += (failureMessages ? '\n\n' : '') + reasonMsg;
    };

    // =========================================================================
    // BASE CHECK: FORK WORKFLOW EXECUTIONS
    // =========================================================================
    const closeMessageInput = core.getInput('close-message');
    let workFlowRunsInspectable = false;
    let workflowRuns: any = null;

    try {
      const result = await octokit.rest.actions.listWorkflowRunsForRepo({
        owner: headRepoOwner,
        repo: headRepoName,
        head_sha: headSha
      });
      workflowRuns = result.data;
      workFlowRunsInspectable = true;
    } catch {
      workflowRuns = null;
      workFlowRunsInspectable = false;
    }

    if (!workFlowRunsInspectable || workflowRuns === null || workflowRuns.total_count === 0) {
      failCheck(closeMessageInput, `No workflow runs found on ${headRepoFullName} for commit ${headSha}.`);
    } else {
      core.info(`✅ Check Passed: Found ${workflowRuns.total_count} workflow run(s) on ${headRepoFullName}.`);
    }

    // =========================================================================
    // CHECK (ii): RATE LIMITING / MAXIMUM PRs CREATED IN LAST 24 HOURS
    // =========================================================================
    const maxPrsInput = core.getInput('max-prs-per-day') || '-1';
    const maxPrs = parseInt(maxPrsInput, 10);

    if (maxPrs >= 0) {
      try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: searchResults } = await octokit.rest.search.issuesAndPullRequests({
          q: `type:pr author:${author} created:>${oneDayAgo}`
        });

        if (searchResults.total_count > maxPrs) {
          failCheck(
            `❌ **PR Closed**: You have opened ${searchResults.total_count} PRs across GitHub in the last 24 hours, exceeding the daily threshold of ${maxPrs}.`,
            `Author '${author}' exceeded rate limit (${searchResults.total_count}/${maxPrs} PRs created in 24h).`
          );
        } else {
          core.info(`✅ Check Passed: Author '${author}' has created ${searchResults.total_count}/${maxPrs} PRs in 24h.`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        core.info(`⚠️ Failed to query global PR rate limit search (${message}).`);
      }
    }

    // =========================================================================
    // CHECK (iii): ASSOCIATED ISSUE (GRAPHQL QUERY)
    // =========================================================================
    const requireAssociatedIssue = core.getInput('require-associated-issue') || 'false';

    if (requireAssociatedIssue.toLowerCase() === 'true') {
      try {
        const query = `
          query($owner: String!, $repo: String!, $prNumber: Int!) {
            repository(owner: $owner, name: $repo) {
              pullRequest(number: $prNumber) {
                closingIssuesReferences(first: 5) { totalCount }
                timelineItems(first: 25, itemTypes: [CONNECTED_EVENT, CROSS_REFERENCED_EVENT]) {
                  nodes {
                    ... on ConnectedEvent { subject { __typename ... on Issue { number } } }
                    ... on CrossReferencedEvent { source { __typename ... on Issue { number } } }
                  }
                }
              }
            }
          }
        `;

        const gqlResult = await octokit.graphql<GraphQLResponse>(query, {
          owner: context.repo.owner,
          repo: context.repo.repo,
          prNumber: prNumber
        });

        const prData = gqlResult.repository?.pullRequest;
        const closingIssuesCount = prData?.closingIssuesReferences?.totalCount || 0;

        const hasTimelineIssueReference = prData?.timelineItems?.nodes?.some(node => {
          const isConnectedIssue = node.subject?.__typename === 'Issue';
          const isCrossReferencedIssue = node.source?.__typename === 'Issue';
          return isConnectedIssue || isCrossReferencedIssue;
        }) || false;

        if (closingIssuesCount === 0 && !hasTimelineIssueReference) {
          failCheck(
            '❌ **PR Closed**: This repository requires pull requests to be linked to an associated issue.',
            'No linked issue found via closingIssuesReferences or timelineItems cross-references.'
          );
        } else {
          core.info(`✅ Check Passed: Linked issue connection confirmed.`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        core.info(`⚠️ GraphQL query failed (${message}). Proceeding with precautions.`);
      }
    }

    // =========================================================================
    // FINAL EVALUATION & PR CLOSURE
    // =========================================================================
    if (!closePr) {
      core.info('🎉 All checks passed cleanly. PR remains open.');
      return;
    }

    const postCommentInput = core.getInput('post-comment') || 'true';
    const shouldPostComment = postCommentInput.toLowerCase() === 'true';

    if (shouldPostComment && failureMessages.trim().length > 0) {
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: prNumber,
        body: failureMessages
      });
    }

    await octokit.rest.pulls.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
      state: 'closed'
    });

    core.info(`PR #${prNumber} automatically closed due to failed requirement checks.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(message);
  }
}

run();