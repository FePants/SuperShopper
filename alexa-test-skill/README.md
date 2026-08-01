# Alexa test skill

This is a minimal custom skill for debugging Alexa routing in the Developer Console.
It has no Firebase, no SDK dependency, and no external calls.

Use it to answer one question: can Alexa invoke a development skill from this account at all?

## What it does

- Invocation name: `purple lantern`
- `open purple lantern` returns: `Purple Lantern test skill is open. Say hello to test an intent.`
- `hello` returns: `Hello from the Purple Lantern test skill.`

If the Alexa Developer Console Test tab does not show Skill I/O JSON after `open purple lantern`,
Alexa did not invoke this skill. That points to the skill setup, testing state, locale, account,
or endpoint configuration, not to Lambda business logic.

## Alexa Developer Console setup

1. Create a new skill.
2. Choose **Custom**.
3. Choose **Provision your own** hosting.
4. In **Interaction Model > JSON Editor**, paste `interaction-model.json`.
5. Click **Save Model**.
6. Click **Build Model** and wait for a successful build.
7. Note the skill ID shown in the Alexa console.
8. In **Endpoint**, paste the Lambda ARN for this test skill.
9. In AWS Lambda, add an **Alexa Skills Kit** trigger using the skill ID from step 7.
10. In **Test**, set testing to **Development**.
11. In the simulator, type:

```text
open purple lantern
```

Then type:

```text
hello
```

## Lambda setup

Create a Lambda function with a current Node.js runtime, upload `function.zip`, add the
**Alexa Skills Kit** trigger with this test skill's skill ID, then copy the Lambda ARN back to
the Alexa skill's **Endpoint** page. No environment variables are required.

To rebuild the zip:

```powershell
cd alexa-test-skill/lambda
tar -a -c -f ../function.zip index.js package.json
```
