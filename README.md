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
      - uses: JamesParrott/autoclose-PR@v1
```

## AI Declaration
- I have used Gemini extensibly, but in my defence, given the main usage case I have in mind, ironically.
- The Github APIs are undeniably incredible, but I am not itching to write any more JS embedded in Yaml than I need to.