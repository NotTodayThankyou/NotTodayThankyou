# NotTodayThankyou
Automatically closes PRs that fail selected tests and checks.  
![Tests passing](https://github.com/NotTodayThankyou/NotTodayThankyou/actions/workflows/test_matrix.yml/badge.svg)

Close PRs e.g.:
 - for which no workflows were run on the fork,
 - whose authors simply have made far too many PRs recently (the limit is configurable),
 - that don't refer to an Issue.

The Action has been fully tested end to end, and with real user accounts (a machine account) and 
with real repos and forks.  If there are any gaps, please raise an Issue.

## Quick start

```yml      
name: Close PRs from forks that didn't run workflows (unless author is a previous contributor)

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

    steps:
      - uses: NotTodayThankyou/NotTodayThankyou@v1
```

### Examples
PRs from previous contributors are never closed. 
#### Allow list
```yml
    steps:
      - uses: NotTodayThankyou/NotTodayThankyou@v1
        with:
          allowed-authors: "Author_1, Author_2" # Comma separated list.
```

#### Close PRs with no message.
Providing further messages to an Agent, simply feeds more prompts into the LLM.
```yml
    steps:
      - uses: NotTodayThankyou/NotTodayThankyou@v1
        with:
          post-comment: "false"
```

#### Close PRs with no associated issue.
Neither PRs that close an issue, nor PRs that only refer to one, are closed.  
The API is polled, so the issues must exist, to avoid PR closure. 
```yml
    steps:
      - uses: NotTodayThankyou/NotTodayThankyou@v1
        with:
          require-associated-issue: "true"
```

#### Close PRs from authors who've recently created more PRs than some limit.
The count includes PRs against all Github repos that the API will tell us about.
```yml
    steps:
      - uses: NotTodayThankyou/NotTodayThankyou@v1
        with:
          max-prs-per-day: 30
```


#### Close PRs with a custom message.
Providing further messages to an Agent, simply feeds more prompts into the LLM.
```yml
    steps:
      - uses: NotTodayThankyou/NotTodayThankyou@v1
        with:
          close-message: "PR closed - please see CONTRIBUTING.md or contact admin@example.com"
```

All selected checks must be passed to avoid the PR being closed, except the
PR author being a previous contributor, or on the Allow List.

### Open Source
To continue welcoming new contributers to your project, we recommend
use of this Action, is accompanied by clearly laid out rules,
e.g. in CONTRIBUTING.md.

The message posted in a comment before PRs are closed can be customised.


### AI Declaration.
I've used Google Gemini extensively (in chatbot mode).  And I claim, carefully.  
I hope even the strongest objectors to AI generated code, would allow an exception for
using AI tools, to help manage spam PRs.


### Security considerations.  
 - Write permissions to Pull Requests are required to close Pull Requests.  
 - The code actually in the PR is never checked out by NotTodayThankyou, let alone run. 
 - This Action only makes calls to Github's APIs. 


 