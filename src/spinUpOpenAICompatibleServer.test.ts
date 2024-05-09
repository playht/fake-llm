import { OpenAI } from 'openai';
import { ChatOpenAI } from '@langchain/openai';
import { afterEach, describe, it } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { spinUpOpenAICompatibleServer } from './spinUpOpenAICompatibleServer';

describe('spinUpOpenAICompatibleServer', () => {
  const serverPort = faker.number.int({ min: 50000, max: 60000 });
  let closeServer: () => Promise<void>;
  afterEach(() => closeServer?.());

  describe('basic functionality', () => {
    beforeEach(async () => {
      closeServer = await spinUpOpenAICompatibleServer({
        serverPort,
        delayMs: 1,
        runMode: { fixedResponse: 'Basic functionality.' },
      });
    });

    it(
      'works for OpenAI SDK',
      async () => {
        const openai = new OpenAI({
          baseURL: `http://localhost:${serverPort}`,
          apiKey: 'mykey',
        });

        const stream = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'system', content: 'Dummy' }],
          stream: true,
        });

        const receivedTextChunks: Array<string> = [];
        for await (const chunk of stream) {
          receivedTextChunks.push(chunk.choices[0]?.delta?.content!);
        }

        expect(receivedTextChunks).toEqual(['Basic', ' functionality', '.', undefined]);
      },
      9999 * 9999,
    );

    it('works for LangChain ChatOpenAI SDK', async () => {
      const chatOpenApiModel = new ChatOpenAI({
        apiKey: 'mykey',
        model: 'gpt-4',
        configuration: {
          baseURL: `http://localhost:${serverPort}`,
        },
        temperature: 0.7,
      });

      const stream = await chatOpenApiModel.stream([['system', 'Dummy']]);

      const receivedTextChunks: Array<string> = [];
      for await (const chunk of stream) receivedTextChunks.push(chunk.content.toString());

      expect(receivedTextChunks).toEqual(['Basic', ' functionality', '.', '']);
    });
  });

  describe('runMode', () => {
    const createLlmClient = () => {
      const client = new ChatOpenAI({
        apiKey: 'mykey',
        model: 'gpt-4',
        configuration: {
          baseURL: `http://localhost:${serverPort}`,
        },
      });
      return async (...prompts: Array<string>) => {
        const receivedTextChunks: Array<string> = [];
        for await (const chunk of await client.stream(prompts)) receivedTextChunks.push(chunk.content.toString());
        return receivedTextChunks;
      };
    };

    describe('echo', () => {
      beforeEach(async () => {
        closeServer = await spinUpOpenAICompatibleServer({
          serverPort,
          delayMs: 1,
          runMode: 'echo',
        });
      });
      it('echoes the last message of the prompt', async () => {
        const prompt = createLlmClient();

        expect(await prompt('what!')).toEqual(['what', '!', '']);
        expect(await prompt('what', 'is this?')).toEqual(['is', ' this', '?', '']);
      });
    });

    describe('length', () => {
      beforeEach(async () => {
        closeServer = await spinUpOpenAICompatibleServer({
          serverPort,
          delayMs: 1,
          runMode: 'length',
        });
      });

      it('returns the number of messages in the prompt', async () => {
        const prompt = createLlmClient();

        expect(await prompt('1', '2', '3')).toEqual(['3', '.', '']);
        expect(await prompt('1', '2', '3', '4', '5')).toEqual(['5', '.', '']);
      });
    });

    describe('fixed response', () => {
      beforeEach(async () => {
        closeServer = await spinUpOpenAICompatibleServer({
          serverPort,
          delayMs: 1,
          runMode: { fixedResponse: 'Fixed response.' },
        });
      });

      it('returns the configured response all the time', async () => {
        const prompt = createLlmClient();

        expect(await prompt('foo')).toEqual(['Fixed', ' response', '.', '']);
        expect(await prompt('bar')).toEqual(['Fixed', ' response', '.', '']);
      });
    });

    describe('dynamic', () => {
      beforeEach(async () => {
        closeServer = await spinUpOpenAICompatibleServer({
          serverPort,
          delayMs: 1,
          runMode: { dynamic: (req) => `${`${req.body.messages[0].content}`.toUpperCase()}!` },
        });
      });

      it('chunkifies and returns the string returned by the callback', async () => {
        const prompt = createLlmClient();

        expect(await prompt('foo')).toEqual(['FOO', '!', '']);
        expect(await prompt('bar')).toEqual(['BAR', '!', '']);
      });
    });
  });
});
