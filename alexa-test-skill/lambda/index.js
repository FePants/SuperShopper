function speechResponse(text, shouldEndSession = false) {
  return {
    version: '1.0',
    response: {
      outputSpeech: {
        type: 'PlainText',
        text
      },
      shouldEndSession
    }
  };
}

function repromptResponse(text, repromptText = text) {
  return {
    version: '1.0',
    response: {
      outputSpeech: {
        type: 'PlainText',
        text
      },
      reprompt: {
        outputSpeech: {
          type: 'PlainText',
          text: repromptText
        }
      },
      shouldEndSession: false
    }
  };
}

exports.handler = async (event) => {
  const request = event && event.request;

  if (!request) {
    return speechResponse('Purple Lantern received an invalid request.', true);
  }

  if (request.type === 'LaunchRequest') {
    return repromptResponse(
      'Purple Lantern test skill is open. Say hello to test an intent.',
      'Say hello to test an intent.'
    );
  }

  if (request.type === 'IntentRequest') {
    const intentName = request.intent && request.intent.name;

    if (intentName === 'HelloIntent') {
      return speechResponse('Hello from the Purple Lantern test skill.', true);
    }

    if (intentName === 'AMAZON.HelpIntent') {
      return repromptResponse(
        'This is a routing test skill. You can say hello.',
        'Say hello to test an intent.'
      );
    }

    if (intentName === 'AMAZON.CancelIntent' || intentName === 'AMAZON.StopIntent') {
      return speechResponse('Goodbye.', true);
    }

    return repromptResponse(
      'Purple Lantern did not understand that. Say hello to test an intent.',
      'Say hello to test an intent.'
    );
  }

  if (request.type === 'SessionEndedRequest') {
    return {
      version: '1.0',
      response: {}
    };
  }

  return speechResponse('Purple Lantern handled an unknown request type.', true);
};
