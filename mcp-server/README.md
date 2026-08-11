# BetterX MCP Server

Standalone stdio-based MCP server that talks to the BetterX microservices over REST/JWT instead of importing service source directly:

- Posts/feed via content-service's REST API
- Text tone adjustment via ai-service's REST API
- Image generation via ai-service's REST API (persisted through media-service)
- User resolution via identity-service's REST API
- Socket.io bridge via its own `src/io/io.ts` client, connecting to the `io` service

## Implemented MCP tools

- `get_latest_posts` — Fetch posts with `{ limit?: integer, offset?: integer }`
- `adjust_text_tone` — Rewrite text tone with `{ text: string, tone: 'funny' | 'formal' | 'sarcastic' | 'professional' }`
- `generate_ai_image` — Generate image with `{ prompt: string }`
- `publish_mcp_post` — Create post with `{ text: string, imageUrl?: string }`

## Implemented MCP resources

- `posts://latest` — Markdown snapshot of 10 newest posts
- `system://ai-status` — JSON status for OpenAI/Gemini connectivity and rate limits

## Install & build

```bash
cd mcp-server
npm install
npm run build
```

## Run locally

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm start
```

## Docker

The MCP server runs as a containerized service via `docker-compose up`.

## Environment variables

- `OPENAI_API_KEY` — Required for `generate_ai_image`
- `GEMINI_API_KEY` — Required for `adjust_text_tone`
- `BETTERX_MCP_USER_ID` (optional) — User ID for `publish_mcp_post`
  - If unset, uses the oldest existing user in the database

## IDE Integration

### Claude Desktop

Edit `%APPDATA%/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "betterx": {
      "command": "node",
      "args": [
        "c:/Users/nofrg/git/my-jb-45800-5/2026-06-16/01-betterx-docker-compose/mcp-server/dist/src/server.js"
      ],
      "env": {
        "NODE_ENV": "compose",
        "OPENAI_API_KEY": "<your-openai-key>",
        "GEMINI_API_KEY": "<your-gemini-key>",
        "BETTERX_MCP_USER_ID": "<optional-user-id>"
      }
    }
  }
}
```

### Cursor IDE

Add stdio server in MCP settings:

- Command: `npm`
- Args: `run dev`
- Working directory: `mcp-server`
- Environment:
  - `NODE_ENV=compose`
  - `OPENAI_API_KEY=<your-openai-key>`
  - `GEMINI_API_KEY=<your-gemini-key>`
  - `BETTERX_MCP_USER_ID=<optional-user-id>`
