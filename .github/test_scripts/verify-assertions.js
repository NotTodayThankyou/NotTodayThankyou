module.exports = async ({ github, core, inputs, prNumber }) => {
  const owner = inputs['target-owner'];
  const repo = inputs['target-repo'];
  const expectedOpen = String(inputs['expected-pr-open']) === 'true';
  const expectedComment = String(inputs['expected-comment-added']) === 'true';

  console.log(`Polling PR #${prNumber} state...`);
  let prData;
  let comments;

  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise(r => setTimeout(r, 5000));

    const { data: fetchedPr } = await github.rest.pulls.get({ owner, repo, pull_number: prNumber });
    prData = fetchedPr;

    const { data: fetchedComments } = await github.rest.issues.listComments({ owner, repo, issue_number: prNumber });
    comments = fetchedComments;

    const isStateResolved = expectedOpen ? prData.state === 'open' : prData.state === 'closed';
    const isCommentResolved = expectedComment ? comments.length > 0 : comments.length === 0;

    if (isStateResolved && isCommentResolved) {
      break;
    }
  }

  const isPRClosed = prData.state === 'closed';
  const isPROpen = prData.state === 'open';

  if (expectedOpen && !isPROpen) {
    core.setFailed(`Assertion Failed: Expected PR #${prNumber} to remain OPEN, but it was CLOSED.`);
  } else if (!expectedOpen && !isPRClosed) {
    core.setFailed(`Assertion Failed: Expected PR #${prNumber} to be CLOSED, but it remained OPEN.`);
  } else {
    console.log(`✅ Assertion Passed: PR status is '${prData.state}' as expected.`);
  }

  const hasComments = comments.length > 0;
  if (expectedComment && !hasComments) {
    core.setFailed(`Assertion Failed: Expected a comment on PR #${prNumber}, but found 0 comments.`);
  } else if (!expectedComment && hasComments) {
    core.setFailed(`Assertion Failed: Expected NO comments on PR #${prNumber}, but found ${comments.length} comment(s).`);
  } else {
    console.log(`✅ Assertion Passed: Comment presence (${hasComments}) matches expected (${expectedComment}).`);
  }
};