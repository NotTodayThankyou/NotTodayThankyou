module.exports = async ({ github, forkOwner, forkRepo }) => {
  console.log(`Cleaning up fork ${forkOwner}/${forkRepo}...`);
  try {
    await github.rest.repos.delete({
      owner: forkOwner,
      repo: forkRepo
    });
    console.log('🗑️ Fork deleted successfully.');
  } catch (err) {
    console.log(`⚠️ Failed to delete fork: ${err.message}`);
  }
};