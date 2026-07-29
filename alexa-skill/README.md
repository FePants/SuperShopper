# Alexa voice control — setup guide

Lets you say "Alexa, tell Shopping List to add milk" and have it show up in the app under a new
always-visible **Quick Add** category, in real time, on every device. This is for personal use on
your own Amazon developer account/devices — it's never submitted for certification or published
to the public Skill Store, so none of Amazon's store-listing requirements (privacy policy, icons,
review) apply.

## How it fits together

```
Echo device → Alexa skill (your Developer Console account)
            → AWS Lambda function (index.js in this folder)
            → Firebase Admin SDK → Firestore lists/shared document
            → same document the web app already reads/writes
```

The Lambda writes with a single atomic Firestore `update()` call using `FieldValue.arrayUnion`
on the dotted path `master.inbox.items` — this creates the `inbox` category the first time it's
used, and can't race or clobber the app's own writes, since it only ever touches that one field.

## Files here

```
lambda/index.js         Skill request handlers (Launch, AddItem, Help, Cancel/Stop, Fallback)
lambda/package.json     Dependencies: ask-sdk-core, firebase-admin
interaction-model.json  Alexa voice interaction model (intents/slots/sample phrases)
function.zip            Deployable package (index.js + package.json + node_modules), built via
                         `npm install` + `tar` — gitignored, regenerate if you change index.js
```

## One-time setup

### 1. Firebase service-account key

Firebase Console → **Project settings → Service accounts → Generate new private key**. This
downloads a JSON file. **Treat it like a password** — it grants full read/write access to your
entire Firestore project, bypassing the security rules the web app is subject to. Never commit
it to the repo; it only ever goes into the Lambda environment variable in step 3.

### 2. Alexa skill

1. [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) → **Create Skill**.
2. Model: **Custom**. Hosting: **Provision your own** (we're using Lambda directly, not
   Alexa-hosted).
3. Once created, go to the **JSON Editor** (left sidebar, under Interaction Model) and paste the
   entire contents of `interaction-model.json` from this folder. **Save Model**, then **Build
   Model**.
4. Note the **Skill ID** shown under Endpoint / at the top of the console — you'll need it for
   the Lambda trigger in step 3.

### 3. AWS Lambda function

1. AWS Console → **Lambda → Create function**.
2. **Author from scratch**, runtime **Node.js 20.x** (or latest available), architecture x86_64.
3. After creation, **Code → Upload from → .zip file**, select `alexa-skill/function.zip` from
   this repo on your machine.
4. **Configuration → Environment variables → Add**:
   - Key: `FIREBASE_SERVICE_ACCOUNT`
   - Value: the *entire contents* of the service-account JSON file from step 1, pasted as one
     line (open the file in a text editor, select all, copy).
5. **Configuration → Triggers → Add trigger → Alexa Skills Kit**. Paste the Skill ID from step 2.
6. **Configuration → General configuration**: bump timeout to at least 10 seconds (Firestore
   cold-start writes can take a few seconds) and memory to 256 MB.
7. Copy the function's **ARN** (top right of the Lambda console page).

### 4. Wire the skill to the Lambda

Back in the Alexa Developer Console → **Endpoint** (left sidebar) → **AWS Lambda ARN** → paste
the ARN from step 3 → **Save Endpoints**.

### 5. Test

Developer Console → **Test** tab → enable testing in **Development** → type or speak:

```
open shopping list
add milk
```

Then check the Firebase Console's Firestore **Data** tab: `lists/shared` → `master.inbox.items`
should now include "Milk". Open the app — a **Quick Add** section with a **New** badge should
show it. Once the Test tab round-trips correctly, try it on a real Echo device signed in with
the same Amazon account used to build the skill (no store submission needed for that to work).

## Regenerating `function.zip` after editing `index.js`

```powershell
cd alexa-skill/lambda
npm install
tar -a -c -f ../function.zip index.js package.json node_modules
```

(`tar` is used instead of PowerShell's `Compress-Archive`, which writes backslash path
separators that break when Lambda's Linux runtime unzips the package.)
