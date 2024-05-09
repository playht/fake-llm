// Use tsx to run this file. It is useful if you want to do manual testing.
import { spinUpOpenAICompatibleServer } from './spinUpOpenAICompatibleServer';

const serverPort = 8080;
spinUpOpenAICompatibleServer({
  serverPort,
  delayMs: 200,

  runMode: 'echo',
  // runMode: 'length',
  // runMode: { fixedResponse: 'Hello, world.' },
  // runMode: { dynamic: (req) => `${`${req.body.messages[0].content}`.toUpperCase()}!` },
}).catch(console.error);
