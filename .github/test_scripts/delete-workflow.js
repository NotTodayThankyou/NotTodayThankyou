module.exports = async ({ github, inputs }) => {
  const targetOwner = inputs['target-owner'];
  const targetRepo = inputs['target-repo'];
  const path = inputs['workflow-path'];

  if (!targetOwner || !targetRepo) {
    console.log('ℹ️ Missing target owner/repo parameters. Skipping workflow file deletion.');
    return;
  }

  console.log(`Cleaning up generated workflow file '${path}' from ${targetOwner}/${targetRepo}...`);

  try {
    const { data: currentFile } = await github.rest.repos.getContent({
      owner: targetOwner,
      repo: targetRepo,
      path
    });

    await github.rest.repos.deleteFile({
      owner: targetOwner,
      repo: targetRepo,
      path,
      message: 'ci: clean up test NotTodayThankyou workflow file',
      sha: currentFile.sha
    });
    console.log('🗑️ Workflow file deleted successfully from target repo.');
  } catch (err) {
    if (err.status === 404) {
      console.log('ℹ️ Workflow file already absent in target repo.');
    } else {
      console.log(`⚠️ Failed to delete workflow file from target repo: ${err.message}`);
    }
  }
};