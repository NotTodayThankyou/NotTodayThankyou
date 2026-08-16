module.exports = async ({ github, core, inputs }) => {
  const targetOwner = inputs['target-owner'];
  const targetRepo = inputs['target-repo'];
  const enableActions = String(inputs['enable-fork-actions']) === 'true';
  const branchName = `test-branch-${Date.now()}`;

  console.log(`Forking ${targetOwner}/${targetRepo}...`);
  const { data: fork } = await github.rest.repos.createFork({
    owner: targetOwner,
    repo: targetRepo,
    default_branch_only: true
  });

  const forkOwner = fork.owner.login;
  const forkRepo = fork.name;

  await new Promise(r => setTimeout(r, 5000));

  if (enableActions) {
    console.log('Enabling GitHub Actions on fork...');
    await github.rest.actions.setGithubActionsPermissionsRepository({
      owner: forkOwner,
      repo: forkRepo,
      enabled: true,
      allowed_actions: 'all'
    });
  }

  const { data: baseRepo } = await github.rest.repos.get({ owner: targetOwner, repo: targetRepo });
  const defaultBranch = baseRepo.default_branch;

  const { data: refData } = await github.rest.git.getRef({
    owner: targetOwner,
    repo: targetRepo,
    ref: `heads/${defaultBranch}`
  });

  await github.rest.git.createRef({
    owner: forkOwner,
    repo: forkRepo,
    ref: `refs/heads/${branchName}`,
    sha: refData.object.sha
  });

  await github.rest.repos.createOrUpdateFileContents({
    owner: forkOwner,
    repo: forkRepo,
    path: `test-${Date.now()}.txt`,
    message: 'test: nominal automated commit',
    content: Buffer.from(`Test execution at ${new Date().toISOString()}`).toString('base64'),
    branch: branchName
  });

  const { data: pr } = await github.rest.pulls.create({
    owner: targetOwner,
    repo: targetRepo,
    title: `[Automated Test] ${branchName}`,
    head: `${forkOwner}:${branchName}`,
    base: defaultBranch,
    body: inputs['pr-body-content']
  });

  console.log(`🎉 PR #${pr.number} created: ${pr.html_url}`);

  core.setOutput('pr_number', pr.number);
  core.setOutput('fork_owner', forkOwner);
  core.setOutput('fork_repo', forkRepo);
};