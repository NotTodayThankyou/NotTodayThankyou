module.exports = async ({ github, inputs }) => {
  const owner = inputs['target-owner'];
  const repo = inputs['target-repo'];
  const path = inputs['workflow-path'];
  const actionsInput = inputs['action-inputs'];
  let parsed;
  try {
    parsed = JSON.parse(actionsInput);
  } catch (error) {
    console.log(`Could not parse: ${actionsInput}`, error.message);
    parsed = {};
    throw error;
  }
  let withBlock;
  if (Object.keys(parsed).length === 0) {
    withBlock = "";
  } else {
    withBlock = `with:
          `; // 10 spaces
    withBlock += Object.entries(parsed)
                       .map(([key, val]) => `${key}: "${val}"`)
                       .join('\n          '); // 10 spaces for correct YAML indentation level
  }
  const updatedWorkflowContent = `name: Close PRs from Forks that didn't run CI

on:
  pull_request:
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
      - uses: NotTodayThankyou/NotTodayThankyou@Test-on-pull-request
        ${withBlock}
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