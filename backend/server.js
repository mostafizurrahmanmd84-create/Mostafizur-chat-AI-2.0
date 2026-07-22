import express from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the workspace .env file.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const developerIdentityResponse = 'My developer is Mostafizur Rahman.';
const developerIdentitySystemPrompt = `You are Mostafizur AI.

This application was developed by Mostafizur Rahman.

If anyone asks:
- Who is your developer?
- Who created you?
- Who made you?
- Who built this app?
- Who owns this AI?
- Who developed this application?

Always answer:

"My developer is Mostafizur Rahman."

If someone asks about the AI model or technology, answer:

"This application was developed by Mostafizur Rahman and is powered by an open-source AI model through the Groq API."

Do not claim that this application was developed by Meta, OpenAI, Google, Microsoft, Anthropic, or Groq.`;

const developerIdentityPatterns = [
  /\bwho is your developer\b/i,
  /\bwho created you\b/i,
  /\bwho made you\b/i,
  /\bwho built you\b/i,
  /\bdeveloper\??\b/i,
  /\bcreator\??\b/i,
  /\bwho owns this app\b/i,
  /\bwho developed this application\b/i,
  /\bwho built this app\b/i,
  /\bwho built this application\b/i
];

const isDeveloperIdentityQuestion = (message) => {
  const normalizedMessage = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return developerIdentityPatterns.some((pattern) => pattern.test(normalizedMessage));
};

const buildChatMessages = (messageOrMessages) => {
  const normalizedMessages = Array.isArray(messageOrMessages)
    ? messageOrMessages
        .filter((entry) => entry && typeof entry.content === 'string')
        .map((entry) => ({
          role: entry.role === 'assistant' ? 'assistant' : 'user',
          content: entry.content
        }))
    : [{ role: 'user', content: messageOrMessages }];

  return [{ role: 'system', content: developerIdentitySystemPrompt }, ...normalizedMessages];
};

const getProviderConfig = (useProvider) => {
  if (useProvider === 'openai') {
    return {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      name: 'OpenAI',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    };
  }

  if (useProvider === 'groq') {
    return {
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      name: 'Groq',
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
    };
  }

  return {
    endpoint: 'https://api.cohere.com/v2/chat',
    name: 'Cohere',
    model: process.env.COHERE_MODEL || 'command-r-plus'
  };
};

const app = express();
// Fall back to 5009 if the environment does not specify a port.
const requestedPort = Number(process.env.PORT || 5009);

// Enable cross-origin requests so the frontend can call the backend.
app.use(cors());
app.use(express.json());

const frontendDistPath = path.resolve(__dirname, '../frontend/dist');

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(express.static(frontendDistPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found.' });
  }

  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// Receive chat messages from the frontend and forward them to the configured provider.
app.post('/api/chat', async (req, res) => {
  try {
    const { message, messages, model } = req.body;

    const userInput = typeof message === 'string' && message.trim()
      ? message.trim()
      : Array.isArray(messages)
        ? [...messages].reverse().find((entry) => entry?.role === 'user' && typeof entry?.content === 'string')?.content?.trim() || ''
        : '';

    if (!userInput) {
      return res.status(400).json({ error: 'A non-empty message is required.' });
    }

    if (isDeveloperIdentityQuestion(userInput)) {
      return res.json({ reply: developerIdentityResponse });
    }

    const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.COHERE_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key is not configured. Please set GROQ_API_KEY, OPENAI_API_KEY, COHERE_API_KEY, or API_KEY in backend/.env.' });
    }

    const useProvider = process.env.API_PROVIDER
      ? process.env.API_PROVIDER.toLowerCase()
      : process.env.GROQ_API_KEY
        ? 'groq'
        : 'cohere';

    let response;
    let data;
    let reply;
    let rawMessage;

    if (useProvider === 'openai' || useProvider === 'groq') {
      const providerConfig = getProviderConfig(useProvider);
      response = await fetch(providerConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || providerConfig.model,
          messages: buildChatMessages(Array.isArray(messages) ? messages : userInput),
          temperature: 0.2
        })
      });

      data = await response.json();

      if (!response.ok) {
        rawMessage = data?.error?.message || `${providerConfig.name} API request failed.`;
        const lower = rawMessage.toLowerCase();
        let userMessage = rawMessage;
        let statusCode = response.status;

        if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('rate limit exceeded')) {
          userMessage = `${providerConfig.name} quota has been reached or is not available for this API key. Please check your ${providerConfig.name} plan or use a different key.`;
          statusCode = 429;
        } else if (lower.includes('model') && lower.includes('not found')) {
          userMessage = `The ${providerConfig.name} model '${providerConfig.model}' is unavailable. Update ${providerConfig.name === 'Groq' ? 'GROQ_MODEL' : 'OPENAI_MODEL'} in backend/.env to a supported model.`;
          statusCode = 400;
        } else if (lower.includes('permission') || lower.includes('access denied')) {
          userMessage = `Your ${providerConfig.name} API key does not have permission to access this model. Check your ${providerConfig.name} account settings.`;
          statusCode = 403;
        }

        console.error(`${providerConfig.name} API error:`, rawMessage, data);
        return res.status(statusCode).json({ error: userMessage, details: rawMessage });
      }

      reply = data?.choices?.[0]?.message?.content || 'No response generated.';
      return res.json({ reply });
    }

    const providerConfig = getProviderConfig(useProvider);
    response = await fetch(providerConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || providerConfig.model,
        messages: buildChatMessages(Array.isArray(messages) ? messages : userInput),
        temperature: 0.2
      })
    });

    data = await response.json();

    if (!response.ok) {
      rawMessage = data?.message || data?.error?.message || 'Cohere API request failed.';
      const lower = rawMessage.toLowerCase();
      let userMessage = rawMessage;
      let statusCode = response.status;

      if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('limit: 0')) {
        userMessage = 'Cohere quota has been reached or is not available for this API key. Please check your Cohere plan or use a different key.';
        statusCode = 429;
      } else if (lower.includes('model') && lower.includes('not found')) {
        userMessage = `The Cohere model '${providerConfig.model}' is unavailable. Update COHERE_MODEL in backend/.env to a supported model.`;
        statusCode = 400;
      } else if (lower.includes('permission') || lower.includes('access denied')) {
        userMessage = 'Your Cohere API key does not have permission to access the model. Check your Cohere account settings.';
        statusCode = 403;
      }

      console.error('Cohere API error:', rawMessage, data);
      return res.status(statusCode).json({ error: userMessage, details: rawMessage });
    }

    reply = data?.message?.content?.[0]?.text || 'No response generated.';
    return res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Server error while contacting the configured AI provider.' });
  }
});

const startServer = (portToUse) => {
  const server = app.listen(portToUse, '0.0.0.0', () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : portToUse;
    console.log(`Backend running on http://localhost:${actualPort}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`Port ${portToUse} is busy. Trying an available port instead...`);
      server.close(() => startServer(0));
    } else {
      console.error('Failed to start backend server:', error);
      process.exit(1);
    }
  });
};

startServer(requestedPort);