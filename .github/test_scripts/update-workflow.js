module.exports = async ({ github, inputs }) => {
  const owner = inputs['target-owner'];
  const repo = inputs['target-repo'];
  const path = '.github/workflows/NotTodayThankyou.yml';

  const updatedWorkflowContent = `name: Close PRs from Forks that didn't run CI

on:
  pull_request_target:
    types: [opened, reopened]
    branches:
      - main

jobs:
  verify:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - uses: NotTodayThankyou/NotTodayThankyou@v1
        with:
          close-message: "${inputs['close-message']}"
          post-comment: "${inputs['post-comment']}"
          allowed-authors: "${inputs['allowed-authors']}"
          max-prs-per-day: "${inputs['max-prs-per-day']}"
          require-associated-issue: "${inputs['require-associated-issue']}"
`;

  let sha;
  try {
    const { data: currentFile } = await github.rest.repos.getContent({ owner, repo, path });
    sha = currentFile.sha;
  } catch (err) {
    console.log('Workflow file does not exist yet. Creating new file.');
  }

  await github.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: 'ci: update NotTodayThankyou workflow inputs for matrix test',
    content: Buffer.from(updatedWorkflowContent).toString('base64'),
    sha
  });
  console.log('✅ Updated NotTodayThankyou.yml in target repository.');
};