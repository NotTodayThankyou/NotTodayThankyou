# NotTodayThankyou
Automatically closes PRs that fail selected tests and checks.  
![Tests passing](https://github.com/NotTodayThankyou/NotTodayThankyou/actions/workflows/test_matrix.yml/badge.svg)

Close PRs e.g.:
 - for which no workflows were run on the fork,
 - whose authors simply have made far too many PRs recently (the limit is configurable),
 - that don't refer to an Issue.

The Action has been fully tested end to end, and with actual user accounts, repos, and forks.  

## Quick start

```yml      
name: Close PRs from forks that didn't run workflows (unless author is a previous contributor)

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
The message body of the comment added to PRs that are closed, can be customised.
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


### AI Declaration.
Gemini was used extensively (in chatbot mode), and Deepseek, ChatGPT and Claude were all consulted.  
I hope even the strongest objectors to AI generated code, would forgive using AI tools, to 
help manage spam PRs.


### Security considerations.  
 - Write permissions to Pull Requests are required to close Pull Requests.  
 - Workflows calling NotTodayThankyou, cannot use the `on: pull_request` trigger, as
its default `secrets.GITHUB_TOKEN` cannot be given write access[^1]. E.g. the `on: pull_request_target:` 
trigger must be used instead.  As per the [special security considerations](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target) for that trigger, it must 
be ensured that nothing else in the workflow running from this trigger runs untrusted code in a PR.
 - The code actually in the PR is never checked out by NotTodayThankyou, let alone run. 
 - This Action only makes calls to Github's APIs.

#### Vulnerability disclosure
Please send reports to [James](https://github.com/JamesParrott).  Any grace period at all that you can grant 
is much appreciated.  But if you prefer to post an issue on this repo, that's fine too, users deserve to be told.
No bug bounty, but full credit will be given.

### Development

#### Testing
*"Why can't I run the tests?"*
The tests are run with real repos and a real user account (e.g. a "machine account"), so 
require a classic token and a couple of PATS: 
i) to push a workflow to a test repo, that runs the code under test
ii) to fork the repo, make a branch, create a commit, raise a PR (classic token required for this step),
and so trigger the workflow that runs the code under test.
iii) Retrieve the open/closed status and number of comments on the raised PR.
iv) Delete the fork (closes the PR if it was open)
v) Delete the test workflow (avoiding test pollution, should step i) ever silently fail)

The tests on this repo are only run if a simple check on the account that instigated them is passed (in the `user_authorization_check` job).
James is happy to explain further how to reproduce a complete test setup for yourself.  But he doesn't wish 
to exceed Github's fair use limits, and does not want to allow others to run workflows with access to secret
tokens, that even if tightly scoped with minimum privileges, allow control over his accounts.

 [^1]: Whatever the reason may be, running NotTodayThankyou with `on: pull_request` 
 [doesn't](https://github.com/NotTodayThankyou/NotTodayThankyou/actions?query=branch%3ATest-on-pull-request) [work](https://github.com/NotTodayThankyou/NotTodayThankyou/blob/Test-on-pull-request/errors.txt).