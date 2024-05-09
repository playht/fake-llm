import type { Server } from 'http';
import express, { Express, json, Request } from 'express';
import { nanoid } from 'nanoid';
import * as fs from 'node:fs';

type RunMode = 'echo' | 'length' | { fixedResponse: string } | { dynamic: (req: express.Request) => string };

export const spinUpOpenAICompatibleServer = async ({
  serverPort,
  delayMs,
  runMode,
}: {
  serverPort: number;
  delayMs?: number;
  runMode?: RunMode;
}) => {
  const app = express();
  app.use(json());

  app.post('/chat/completions', (req, res) => {
    logRequest(req);

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    req.on('error', (err) => {
      console.log('Error in SSE connection:', err.message);
      res.end();
    });

    const responseContent = generateResponseContent(runMode, app, req);
    console.log('Sending:', JSON.stringify(responseContent), '\n');

    const chatId = nanoid();
    const systemFingerprint = nanoid();
    const messages = toMessages(chunkify(responseContent));

    const sendMessage = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    void (async () => {
      for (const choice of messages) {
        if (res.writableEnded) return; // client disconnected

        sendMessage({
          id: `chatcmpl-${chatId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'gpt-3.5-turbo-0125',
          system_fingerprint: systemFingerprint,
          choices: [choice],
        });
        await sleep(delayMs ?? 100);
      }
      res.write(`data: [DONE]\n\n`);
      res.end();
    })();
  });

  // For everything else, we just serve an HTML page
  app.all('*', (req, res) => {
    res.status(200).send(getIndexHtmlPageContent(req, runMode));
  });

  const server = await new Promise<Server>((resolve) => {
    const srv = app.listen(serverPort, () => {
      console.log(`*** OpenAI API-Compatible server running on port ${serverPort}.`);
      console.log(`*** Selected runMode: ${JSON.stringify(runMode)}.`);
      resolve(srv);
    });
  });

  // returns a function that closes the server
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
};

const logRequest = (req: Request) => {
  if (Array.isArray(req.body.messages)) {
    console.log(`Received:\n - ${req.body.messages.map(({ role, content }) => `${role}: ${JSON.stringify(content)}`).join('\n - ')}`);
  } else {
    console.log(`Received ${req.method} request at ${req.url}: ${JSON.stringify(req.body, null, 2)}`);
  }
};

const chunkify = (s: string) => s.split(/(?=[^a-z])(?!$)/i);

const generateResponseContent = (runMode: RunMode | undefined, app: Express, request: Request): string => {
  if (!runMode) {
    return 'Hello, world';
  }
  if (runMode === 'echo') {
    return request.body.messages.at(-1).content;
  }
  if (runMode === 'length') {
    return `${request.body.messages.length}.`;
  }
  if (typeof runMode === 'object' && 'fixedResponse' in runMode) {
    return runMode.fixedResponse;
  }
  return runMode.dynamic(request);
};

const toMessages = (responseChunks: Array<string>) => [
  ...responseChunks.map((content) => ({ index: 0, delta: { content }, flogprobs: null, finishReason: null })),
  { index: 0, delta: {}, logprobs: null, finishReason: 'stop' },
];

const sleep = async (timeout: number) => await new Promise((resolve) => setTimeout(resolve, timeout));

const getIndexHtmlPageContent = (req: Request, runMode?: RunMode) => {
  const SERVER_URL = req.protocol + '://' + req.get('host') + req.originalUrl;
  const RUN_MODE = JSON.stringify(runMode);
  return fs
    .readFileSync(`${import.meta.dirname}/index.html`, 'utf8')
    .replaceAll('<%= SERVER_URL %>', SERVER_URL)
    .replaceAll('<%= RUN_MODE %>', RUN_MODE);
};
