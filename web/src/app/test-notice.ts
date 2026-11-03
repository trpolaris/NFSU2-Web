import { N } from './i18n';

// Shown on every page load until the visitor acknowledges the test status.
export const TEST_NOTICE_TEXT = Object.freeze({
  kicker: N('TEST ENVIRONMENT / TEST BUILD'),
  title: N('Test server notice'),
  stability: N('This server is currently running for testing only and should not be considered a stable, production-ready service.'),
  details: N('The project is still in development and testing. You may encounter bugs, interruptions, or unexpected behavior in gameplay, multiplayer connections, chat, or website features.'),
  acknowledgement: N('By continuing, you acknowledge that you are using a test build.'),
  button: N('I understand, continue'),
});
