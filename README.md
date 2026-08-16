# NotTodayThankyou
Automatically close PRs for various reasons, e.g. PRs for which the parent repo's test workflows did not run.

## Untested Disclaimer / WIP / Alpha / Subsub Beta
I've only created this repo this afternoon (14th August 2026), I still need to test it to make sure it actually works.
If you've stumbled on this and decide to try it anyway regardless (I too like to live dangerously), 
please let me know how it goes.  
Otherwise, watch this space....

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
      - uses: NotTodayThankyou/NotTodayThankyou@v1
```

## AI Declaration
- I have used Gemini extensively, but ironically.  The main use case for this Action, is to close spam PRs from LLMs.