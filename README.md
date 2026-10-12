# Kampala University AI Chatbot

The chatbot uses Gemini 3.8 Flash with Google Search grounding to search the live web and generate cited answers. Credentials stay on the Node.js server and are never sent to the browser.

## Configure grounded Google Search

1. Create a Gemini API key in Google AI Studio.
2. Copy `.env.example` to `.env` and replace the placeholder with the new key:

   ```text
   GEMINI_API_KEY=your-new-gemini-api-key
   ```

   The `.env` file is ignored by Git, so the key stays local. You can also set `GEMINI_API_KEY` as a server environment variable instead.
3. Start or restart the server from this project folder:

   ```powershell
   node server.js
   ```

Then open `index.html` in a browser and ask a question. The answer includes citations from Google Search when the grounding API returns them. Restart the Node server after changing `.env`; environment values are read at startup.

If the chatbot reports that the Gemini quota or rate limit was reached, check the key's usage and billing in Google AI Studio before retrying.

For existing Google Custom Search JSON API customers, the server also supports the legacy API by setting both `GOOGLE_API_KEY` and `GOOGLE_CSE_ID`; without a Gemini key, it returns Google's result snippets directly. Google states that this API is unavailable to new customers and is scheduled to discontinue on January 1, 2027, so Gemini grounding is the recommended setup.

If a key was shared publicly or in chat, revoke it and use a replacement. Keep API keys private, restrict them in Google Cloud Console, and do not put them in `index.html` or commit them to source control.
