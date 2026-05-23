# Sports Streamer - Setup Instructions

The API has CORS restrictions, so we need to run a local proxy server.

## Quick Start

### Step 1: Set up the Proxy Server

```bash
# Install dependencies
npm install

# Start the proxy server
npm start
```

The proxy will run on `http://localhost:3001`

### Step 2: Run the React App

Open `sports-streamer.jsx` in your React project or use Create React App:

```bash
# If you don't have a React project yet:
npx create-react-app sports-app
cd sports-app

# Copy sports-streamer.jsx to src/App.jsx
# Then run:
npm start
```

The React app will run on `http://localhost:3000` and connect to the proxy at `http://localhost:3001`

## How It Works

1. **Browser → Proxy Server** - Your React app sends requests to localhost:3001
2. **Proxy → API** - The proxy forwards requests to streamed.pk with proper headers
3. **API → Proxy → Browser** - Data flows back through the proxy to your app

This bypasses CORS restrictions because:
- The proxy runs on your machine (no browser CORS policy)
- The proxy adds the correct Origin/Referer headers
- Your React app only talks to localhost (allowed by CORS)

## Troubleshooting

**"Failed to fetch" error:**
- Make sure the proxy server is running (`npm start`)
- Check that it's on port 3001
- Verify the React app is pointing to `http://localhost:3001/api`

**"No matches available":**
- The API might be temporarily down
- Try the "Live" or "All" tabs instead of "Today"
- Some sports may have no current matches

**Streams not loading:**
- Some streams may be geo-blocked
- Try different stream numbers (#1, #2, etc.)
- The embed URLs may require specific browser settings

## Alternative: Public CORS Proxy

If you don't want to run a local server, you can use a public CORS proxy (less reliable):

Change line 4 in `sports-streamer.jsx` to:
```javascript
const API_BASE = 'https://corsproxy.io/?https://streamed.pk/api';
```

⚠️ **Warning:** Public proxies are slower and may have rate limits.

## Tech Stack

- **Proxy:** Node.js + Express
- **Frontend:** React + Tailwind CSS
- **API:** streamed.pk (unofficial streams aggregator)

## Legal Notice

This app uses an unofficial streaming aggregator API. The streams are not hosted by this app or the API - they're embedded from third-party sources. Ensure you have the legal right to access sports content in your region.
