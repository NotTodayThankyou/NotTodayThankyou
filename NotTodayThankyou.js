module.exports = async ({ github, context, core, inputs }) => {
  const pr = context.payload.pull_request;

  if (!pr) {
    core.setFailed('This action can only be run on pull_request or pull_request_target events.');
    return;
  }

  const author = pr.user.login;
  const headRepoOwner = pr.head.repo.owner.login;
  const headRepoName = pr.head.repo.name;
  const headRepoFullName = pr.head.repo.full_name;
  const headSha = pr.head.sha;
  const prNumber = pr.number;

  // =========================================================================
  // CHECK (i): ALLOWLIST & EXISTING CONTRIBUTOR BYPASS
  // =========================================================================
  const allowedAuthorsInput = (inputs['allowed-authors'] || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowedAuthorsInput.includes(author.toLowerCase())) {
    console.log(`✅ Author '${author}' is explicitly in the allowlist. Bypassing all checks.`);
    return;
  }

  try {
    const { data: repositoryStats } = await github.rest.repos.getContributorsStats({
      owner: context.repo.owner,
      repo: context.repo.repo
    });

    const isContributor = Array.isArray(repositoryStats) && 
      repositoryStats.some(c => c.author && c.author.login.toLowerCase() === author.toLowerCase());

    if (isContributor) {
      console.log(`✅ Author '${author}' is an existing contributor to this repository. Bypassing all checks.`);
      return;
    }
  } catch (err) {
    console.log(`⚠️ Could not fetch contributor stats (${err.message}). Proceeding with checks.`);
  }

  // State tracking
  let closePr = false;
  let failureMessages = '';

  const failCheck = (reasonMsg, logMsg) => {
    console.log(`❌ Check Failed: ${logMsg}`);
    closePr = true;
    failureMessages += (failureMessages ? '\n\n' : '') + reasonMsg;
  };

  // =========================================================================
  // BASE CHECK: FORK WORKFLOW EXECUTIONS
  // =========================================================================
  const closeMessageInput = inputs['close-message'];
  let workFlowRunsInspectable;
  let workflowRuns;

  try {
    const result = await github.rest.actions.listWorkflowRunsForRepo({
      owner: headRepoOwner,
      repo: headRepoName,
      head_sha: headSha
    });
    workflowRuns = result.data;
    workFlowRunsInspectable = true;
  } catch (error) {
    workflowRuns = null;
    workFlowRunsInspectable = false;
  }

  if (!workFlowRunsInspectable || workflowRuns===null || workflowRuns.total_count === 0) {
    failCheck(closeMessageInput, `No workflow runs found on ${headRepoFullName} for commit ${headSha}.`);
  } else {
    console.log(`✅ Check Passed: Found ${workflowRuns.total_count} workflow run(s) on ${headRepoFullName}.`);
  }

  // =========================================================================
  // CHECK (ii): RATE LIMITING / MAXIMUM PRs CREATED IN LAST 24 HOURS
  // =========================================================================
  const maxPrs = parseInt(inputs['max-prs-per-day'], 10);
  if (maxPrs >= 0) {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: searchResults } = await github.rest.search.issuesAndPullRequests({
        q: `type:pr author:${author} created:>${oneDayAgo}`
      });

      if (searchResults.total_count > maxPrs) {
        failCheck(
          `❌ **PR Closed**: You have opened ${searchResults.total_count} PRs across GitHub in the last 24 hours, exceeding the daily threshold of ${maxPrs}.`,
          `Author '${author}' exceeded rate limit (${searchResults.total_count}/${maxPrs} PRs created in 24h).`
        );
      } else {
        console.log(`✅ Check Passed: Author '${author}' has created ${searchResults.total_count}/${maxPrs} PRs in 24h.`);
      }
    } catch (err) {
      console.log(`⚠️ Failed to query global PR rate limit search (${err.message}).`);
    }
  }

  // =========================================================================
  // CHECK (iii): ASSOCIATED ISSUE (GRAPHQL QUERY)
  // =========================================================================
  if (String(inputs['require-associated-issue']).toLowerCase() === 'true') {
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

      const gqlResult = await github.graphql(query, {
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
        console.log(`✅ Check Passed: Linked issue connection confirmed.`);
      }
    } catch (err) {
      console.log(`⚠️ GraphQL query failed (${err.message}). Proceeding with precautions.`);
    }
  }

  // =========================================================================
  // FINAL EVALUATION & PR CLOSURE
  // =========================================================================
  if (!closePr) {
    console.log('🎉 All checks passed cleanly. PR remains open.');
    return;
  }

  const shouldPostComment = String(inputs['post-comment']) === 'true';
  if (shouldPostComment && failureMessages.trim().length > 0) {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body: failureMessages
    });
  }

  await github.rest.pulls.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: prNumber,
    state: 'closed'
  });

  console.log(`PR #${prNumber} automatically closed due to failed requirement checks.`);
  return;
};