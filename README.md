# autoclose-PR
Automatically close PRs for various reasons, e.g. PRs for which the parent repo's test workflows did not run.


## Usage

```yml      
name: Close PRs from Forks that didn't run CI

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

    steps:
      - name: Verify Fork CI
        uses: JamesParrott/autoclose-PR@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }} 
```
