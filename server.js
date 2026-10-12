require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve all static assets from the root directory
app.use(express.static(__dirname));

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Search Router and AI Synthesis Endpoint
app.post('/api/chat', async (req, res) => {
  const { message } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: "A non-empty message is required." });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: "Message must be 2,000 characters or fewer." });
  }
  if (!GEMINI_API_KEY && !(GOOGLE_API_KEY && GOOGLE_CSE_ID)) {
    return res.status(503).json({
      error: "Google Search is not configured. Set GEMINI_API_KEY, or set both GOOGLE_API_KEY and GOOGLE_CSE_ID on the server."
    });
  }

  try {
    const { reply, sources } = await getGoogleGroundedAnswer(message.trim());
    const photos = selectRelevantPhotos(message);

    res.json({
      reply,
      sources: sources.slice(0, 4),
      photos
    });

  } catch (error) {
    const providerStatus = error.response?.status;
    console.error("Google Search request failed:", providerStatus || "network error");
    const clientError = providerStatus === 401 || providerStatus === 403;
    const quotaExceeded = providerStatus === 429;
    res.status(quotaExceeded ? 429 : clientError ? 503 : providerStatus ? 502 : 500).json({
      error: quotaExceeded
        ? "The Gemini API quota or rate limit has been reached. Check your Google AI Studio usage and billing, then try again."
        : clientError
          ? "Google rejected this API key or its access settings. Check the key in Google AI Studio and its API restrictions."
          : "Google Search could not be completed. Check the server logs and Google API configuration."
    });
  }
});

async function getGoogleGroundedAnswer(query) {
  if (GEMINI_API_KEY) {
    try {
      const response = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/interactions',
        {
          model: 'gemini-3.8-flash',
          input: `Answer this question accurately using Google Search. Distinguish official Kampala University information from general information, and say when the search results do not establish an answer.\n\nQuestion: ${query}`,
          tools: [{ type: 'google_search' }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY
          },
          timeout: 30000
        }
      );
      return parseGroundedResponse(response.data);
    } catch (error) {
      if (!(GOOGLE_API_KEY && GOOGLE_CSE_ID)) {
        throw error;
      }
      console.error("Google Search grounding failed; trying configured Programmable Search:", error.response?.status || "network error");
    }
  }

  const searchResults = await fetchGoogleSearchResults(query);
  return {
    reply: createSearchSummary(searchResults),
    sources: searchResults
  };
}

function parseGroundedResponse(data) {
  const textBlocks = (data.steps || [])
    .filter(step => step.type === 'model_output')
    .flatMap(step => step.content || [])
    .filter(block => block.type === 'text' && block.text);
  const reply = textBlocks.map(block => block.text).join('\n').trim();

  if (!reply) {
    throw new Error("Google Search grounding returned no answer text.");
  }

  const sources = textBlocks
    .flatMap(block => block.annotations || [])
    .filter(annotation => annotation.type === 'url_citation' && annotation.url)
    .map(chunk => ({
      title: chunk.title || chunk.url,
      link: chunk.url
    }))
    .filter((source, index, all) => all.findIndex(item => item.link === source.link) === index);

  return { reply, sources };
}

async function fetchGoogleSearchResults(query) {
  const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
    params: {
      key: GOOGLE_API_KEY,
      cx: GOOGLE_CSE_ID,
      q: query,
      num: 5
    },
    timeout: 10000
  });
  return (response.data.items || []).map(item => ({
    title: item.title,
    snippet: item.snippet || '',
    link: item.link
  }));
}

function createSearchSummary(searchResults) {
  if (searchResults.length === 0) {
    return "Google Search returned no results for that question. Try rephrasing it or adding more detail.";
  }
  return searchResults
    .map((item, index) => `${index + 1}. ${item.title}\n${item.snippet}`)
    .join('\n\n');
}

function selectRelevantPhotos(query) {
  return [
    { url: "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=600&q=80", caption: "Kampala University Environment" },
    { url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=600&q=80", caption: "Students in Computer Science Laboratory" }
  ];
}

// Explicit Root Route for index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Kampala University AI News Server running at http://localhost:${PORT}`);
});