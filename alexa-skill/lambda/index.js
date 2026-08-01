const Alexa = require('ask-sdk-core');
const crypto = require('crypto');

// FIREBASE_SERVICE_ACCOUNT is a Lambda environment variable holding the
// full service-account JSON as a string (see alexa-skill/README.md).
const FIRESTORE_WRITE_TIMEOUT_MS = 6500;
const OAUTH_SCOPE = 'https://www.googleapis.com/auth/datastore';
let serviceAccount;
let accessToken;
let accessTokenExpiresAt = 0;

function withTimeout(work, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  const operation = Promise.resolve().then(work);
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

function getServiceAccount() {
  if (serviceAccount) return serviceAccount;
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawServiceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  }

  try {
    serviceAccount = JSON.parse(rawServiceAccount);
  } catch (err) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT must be valid JSON: ${err.message}`);
  }

  if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT must include client_email, private_key, and project_id');
  }

  return serviceAccount;
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function fetchJsonWithTimeout(url, options, ms, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`${label} timed out after ${ms}ms`)), ms);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error(`${label} returned non-JSON response: ${text.slice(0, 300)}`);
      }
    }
    if (!response.ok) {
      throw new Error(`${label} failed with HTTP ${response.status}: ${JSON.stringify(data).slice(0, 500)}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (accessToken && accessTokenExpiresAt - 60 > now) return accessToken;

  const account = getServiceAccount();
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: account.client_email,
    scope: OAUTH_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  const unsignedJwt = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsignedJwt).sign(account.private_key);
  const assertion = `${unsignedJwt}.${base64url(signature)}`;

  console.log('Requesting Google OAuth access token');
  const data = await fetchJsonWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  }, FIRESTORE_WRITE_TIMEOUT_MS, 'Google OAuth token request');

  accessToken = data.access_token;
  accessTokenExpiresAt = now + (data.expires_in || 3600);
  return accessToken;
}

async function writeItemViaRest(item) {
  const account = getServiceAccount();
  const token = await getAccessToken();
  const database = `(default)`;
  const document = `projects/${account.project_id}/databases/${database}/documents/lists/shared`;
  const url = `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/${database}/documents:commit`;

  return fetchJsonWithTimeout(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: document,
            fields: {
              master: {
                mapValue: {
                  fields: {
                    inbox: {
                      mapValue: {
                        fields: {
                          name: { stringValue: 'Quick Add' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          updateMask: {
            fieldPaths: ['master.inbox.name']
          }
        },
        {
          transform: {
            document,
            fieldTransforms: [
              {
                fieldPath: 'master.inbox.items',
                appendMissingElements: {
                  values: [{ stringValue: item }]
                }
              }
            ]
          }
        }
      ]
    })
  }, FIRESTORE_WRITE_TIMEOUT_MS, 'Firestore REST commit');
}

async function addItemToList(rawName) {
  const name = rawName.trim();
  if (!name) return null;
  const item = name.charAt(0).toUpperCase() + name.slice(1);
  console.log('Writing item to Firestore inbox', { item });
  await withTimeout(() => writeItemViaRest(item), FIRESTORE_WRITE_TIMEOUT_MS + 500, 'Firestore write');
  console.log('Firestore inbox write succeeded', { item });
  return item;
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speak = 'Blue Spatula is ready. You can say, stash milk.';
    return handlerInput.responseBuilder
      .speak(speak)
      .reprompt(speak)
      .getResponse();
  }
};

const AddItemIntentHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' &&
      (request.intent.name === 'RememberItemIntent' || request.intent.name === 'AddItemIntent');
  },
  async handle(handlerInput) {
    const slotValue = Alexa.getSlotValue(handlerInput.requestEnvelope, 'Item');
    if (!slotValue) {
      const speak = "Sorry, what should I stash?";
      return handlerInput.responseBuilder.speak(speak).reprompt(speak).getResponse();
    }
    try {
      const item = await addItemToList(slotValue);
      return handlerInput.responseBuilder
        .speak(`Stashed ${item}.`)
        .withShouldEndSession(true)
        .getResponse();
    } catch (err) {
      console.error('Firestore write failed', err);
      return handlerInput.responseBuilder
        .speak("Sorry, I couldn't reach your shopping list right now.")
        .withShouldEndSession(true)
        .getResponse();
    }
  }
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speak = "You can say, stash milk, and I'll save it.";
    return handlerInput.responseBuilder.speak(speak).reprompt(speak).getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' &&
      (request.intent.name === 'AMAZON.CancelIntent' || request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.speak('Okay.').withShouldEndSession(true).getResponse();
  }
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.FallbackIntent';
  },
  handle(handlerInput) {
    const speak = "Sorry, I didn't catch that. You can say, stash milk.";
    return handlerInput.responseBuilder.speak(speak).reprompt(speak).getResponse();
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error('Unhandled error', error);
    return handlerInput.responseBuilder
      .speak("Sorry, something went wrong.")
      .withShouldEndSession(true)
      .getResponse();
  }
};

const skill = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    AddItemIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .create();

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  return skill.invoke(event, context);
};
