module.exports = async ({ github, core, inputs, prNumber }) => {
  const owner = inputs['target-owner'];
  const repo = inputs['target-repo'];
  const expectedOpen = String(inputs['expected-pr-open']) === 'true';
  const expectedComment = String(inputs['expected-comment-added']) === 'true';

  console.log(`Polling PR #${prNumber} state and calling workflow status...`);
  let prData;
  let comments;
  let targetWorkflowRun;

  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise(r => setTimeout(r, 5000));

    // 1. Fetch PR State
    const { data: fetchedPr } = await github.rest.pulls.get({ owner, repo, pull_number: prNumber });
    prData = fetchedPr;

    // 2. Fetch PR Comments
    const { data: fetchedComments } = await github.rest.issues.listComments({ owner, repo, issue_number: prNumber });
    comments = fetchedComments;

    // 3. Fetch Calling Workflow Runs triggered on pull_request_target
    const { data: workflowRuns } = await github.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      event: 'pull_request_target'
    });

    // Find the specific run associated with this PR number
    targetWorkflowRun = workflowRuns.workflow_runs.find(run => 
      run.pull_requests.some(p => p.number === prNumber)
    );

    const isWorkflowCompleted = targetWorkflowRun && targetWorkflowRun.status === 'completed';
    const isStateResolved = expectedOpen ? prData.state === 'open' : prData.state === 'closed';
    const isCommentResolved = expectedComment ? comments.length > 0 : comments.length === 0;

    if (isWorkflowCompleted && isStateResolved && isCommentResolved) {
      break;
    }
  }

  // =========================================================================
  // ASSERTION 1: Calling Workflow Execution & Conclusion Check
  // =========================================================================
  if (!targetWorkflowRun) {
    core.setFailed(`Assertion Failed: No calling workflow run found for PR #${prNumber}.`);
  } else if (targetWorkflowRun.status !== 'completed') {
    core.setFailed(`Assertion Failed: Calling workflow run #${targetWorkflowRun.id} did not complete in time (status: '${targetWorkflowRun.status}').`);
  } else if (targetWorkflowRun.conclusion !== 'success') {
    core.setFailed(`Assertion Failed: Calling workflow run #${targetWorkflowRun.id} failed or errored with conclusion '${targetWorkflowRun.conclusion}'. Expected 'success'.`);
  } else {
    console.log(`✅ Assertion Passed: Calling workflow run #${targetWorkflowRun.id} executed and completed with conclusion 'success'.`);
  }

  // =========================================================================
  // ASSERTION 2: PR Open/Closed State Check
  // =========================================================================
  const isPRClosed = prData.state === 'closed';
  const isPROpen = prData.state === 'open';

  if (expectedOpen && !isPROpen) {
    core.setFailed(`Assertion Failed: Expected PR #${prNumber} to remain OPEN, but it was CLOSED.`);
  } else if (!expectedOpen && !isPRClosed) {
    core.setFailed(`Assertion Failed: Expected PR #${prNumber} to be CLOSED, but it remained OPEN.`);
  } else {
    console.log(`✅ Assertion Passed: PR status is '${prData.state}' as expected.`);
  }

  // =========================================================================
  // ASSERTION 3: PR Comment Presence Check
  // =========================================================================
  const hasComments = comments.length > 0;
  if (expectedComment && !hasComments) {
    core.setFailed(`Assertion Failed: Expected a comment on PR #${prNumber}, but found 0 comments.`);
  } else if (!expectedComment && hasComments) {
    core.setFailed(`Assertion Failed: Expected NO comments on PR #${prNumber}, but found ${comments.length} comment(s).`);
  } else {
    console.log(`✅ Assertion Passed: Comment presence (${hasComments}) matches expected (${expectedComment}).`);
  }
};