const Alexa = require('ask-sdk-core');
const admin = require('firebase-admin');

// FIREBASE_SERVICE_ACCOUNT is a Lambda environment variable holding the
// full service-account JSON as a string (see alexa-skill/README.md).
// Reused across warm Lambda invocations rather than re-initialized per call.
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}
const db = admin.firestore();
const listDocRef = db.collection('lists').doc('shared');

async function addItemToList(rawName) {
  const name = rawName.trim();
  if (!name) return null;
  const item = name.charAt(0).toUpperCase() + name.slice(1);
  await listDocRef.update({
    'master.inbox.name': 'Quick Add',
    'master.inbox.items': admin.firestore.FieldValue.arrayUnion(item)
  });
  return item;
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speak = 'Shopping List is ready. You can say, add milk, to add an item.';
    return handlerInput.responseBuilder
      .speak(speak)
      .reprompt(speak)
      .getResponse();
  }
};

const AddItemIntentHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest' && request.intent.name === 'AddItemIntent';
  },
  async handle(handlerInput) {
    const slotValue = Alexa.getSlotValue(handlerInput.requestEnvelope, 'Item');
    if (!slotValue) {
      const speak = "Sorry, what should I add to the list?";
      return handlerInput.responseBuilder.speak(speak).reprompt(speak).getResponse();
    }
    try {
      const item = await addItemToList(slotValue);
      return handlerInput.responseBuilder
        .speak(`Added ${item} to your list.`)
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
    const speak = 'You can say, add milk, and I\'ll add it to your shopping list.';
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
    const speak = "Sorry, I didn't catch that. You can say, add milk.";
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

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    AddItemIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
