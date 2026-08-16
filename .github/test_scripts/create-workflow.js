module.exports = async ({ github, inputs }) => {
  const owner = inputs['target-owner'];
  const repo = inputs['target-repo'];
  const path = inputs['workflow-path'];
  const actionsInputs = JSON.parse(inputs['actions-inputs']);
  const withInputs = Object.entries(obj)
                       .map(([key, val]) => `${key}: "${val}"`)
                       .join('\n          '); // 10 spaces for correct YAML indentation level
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
      - uses: NotTodayThankyou/NotTodayThankyou@main
        with:
          ${withInputs}
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