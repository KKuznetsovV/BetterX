# BetterX

BetterX is a social platform (posts, comments, likes, follows, notifications) built as a
set of independent TypeScript microservices, with AI-assisted features for content
creation, moderation, and social discovery.

## Tech Stack

- **Services**: Node.js, Express 5, TypeScript, Joi validation, Sequelize (sequelize-typescript)
- **Frontend**: React 19, Vite, TypeScript, Redux Toolkit, React Hook Form, Axios
- **Realtime**: Socket.IO (standalone `io` service)
- **Data stores**: MySQL (one logical database per service), MinIO (S3-compatible object storage), Postgres+pgvector (embeddings/vector search)
- **Messaging**: RabbitMQ (topic exchange `betterx.events`) for durable, retryable cross-service domain events (notifications, post-embedding sync), written via a transactional outbox on the producer side; synchronous REST/API composition remains the pattern for request/response reads
- **AI**: OpenAI (text improve, moderation, embeddings, follow-suggestion ranking), Google Gemini (image/avatar generation)
- **Gateway**: nginx, path-based routing to each service

See [system_architecture.md](system_architecture.md) for the full architecture, established
decisions, and in-progress work.

## Architecture at a Glance

| Service | Port | Responsibility |
|---|---|---|
| `frontend` | 80 | React SPA, served by nginx, which also proxies API requests to every service below |
| `identity-service` | 3010 | Users, follows, profile, and auth (`/auth/signup`, `/auth/login`) |
| `content-service` | 3009 | Posts, comments, feed |
| `engagement-service` | 3008 | Likes |
| `notification-service` | 3007 | Notifications |
| `media-service` | 3006 | Presigned uploads + image persistence to S3/MinIO |
| `ai-service` | 3005 | Text improve, image/avatar generation, profanity checks (`/drafts/*`) |
| `recommendation-service` | 3011 | AI-powered "suggested users to follow" (pgvector similarity + LLM ranking) |
| `io` | 3004 | Standalone Socket.IO server for realtime updates |
| `mcp-server` | — | Standalone stdio MCP server exposing BetterX tools/resources to MCP clients |
| `database` | 3306 | MySQL, one schema per service |
| `minio` | 9100/9101 | S3-compatible object storage |
| `pgvector` | 5432 | Postgres + pgvector extension, used only by `recommendation-service` |
| `rabbitmq` | 5672/15672 | Topic exchange broker for domain events (notifications, embedding sync); management UI on 15672 in dev only |

Each service owns its own database schema and verifies JWTs itself via a shared secret
(no synchronous call to an auth service per request). `backend/` (the original monolith)
has been fully retired; its last responsibility (signup/login/JWT-issuing) now lives in
`identity-service`.

## Messaging & Events

`content-service` and `identity-service` publish domain events (`post.created`,
`post.updated`, `post.deleted`, `comment.created`, `follow.created`) to a durable RabbitMQ
topic exchange, `betterx.events`, instead of calling other services synchronously for
write-side side effects. `notification-service` and `recommendation-service` each bind
their own durable queue to the routing keys they care about (both bind `post.created`,
fanning out from the same single publish).

Producers use a **transactional outbox**: each domain write (post/comment/follow
create/update/delete) and its corresponding event row are written in one Sequelize
transaction, so the DB write and the intent-to-publish either both commit or both roll
back. A lightweight in-process poller then publishes unpublished rows to RabbitMQ and
marks them as sent. This means a RabbitMQ outage only delays delivery — the row stays
queued and drains automatically once the broker is back — instead of silently losing an
event. Consumers connect with a bounded retry loop at startup so they tolerate the broker
not being ready yet.

See [system_architecture.md](system_architecture.md) for the full breakdown of routing
keys, queues, and the outbox schema.

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (only needed for running a service outside Docker)

### Setup

1. Copy the environment template and fill in secrets:
   ```
   cp .env.example .env
   ```
   At minimum, set `OPENAI_API_KEY` (used by `ai-service` and `recommendation-service`) and
   `GEMINI_API_KEY` (used by `ai-service`).
2. Start the full stack:
   ```
   docker compose up -d --build
   ```
3. Open the app at [http://localhost](http://localhost).

Every service, plus MySQL, MinIO, and pgvector, starts automatically with seed data from
[db/seed.sql](db/seed.sql).

### Running the frontend against the stack without Docker

The frontend has three env files: `.env.development` (talks directly to service ports,
no gateway), `.env.docker` (talks to the nginx gateway on port 80), and `.env.production`
(same, pointed at the deployed host). Pick the matching npm script (`npm run dev`,
`npm run build:docker`, `npm run build:production`) inside [frontend/](frontend/).

## Production

[docker-compose.prod.yaml](docker-compose.prod.yaml) runs the same services from published
Docker Hub images (`kuzmass/betterx-*`) instead of building locally, with self-hosted MySQL
and pgvector containers (no managed cloud DB is provisioned). See
[system_architecture.md](system_architecture.md) for details and outstanding rollout TODOs.

## Repository Layout

```
ai-service/            Draft AI endpoints: text improve, image/avatar generation, profanity checks
content-service/       Posts, comments, feed
db/                    MySQL Dockerfile + seed data (db/seed.sql), shared by every service's seed-loader
engagement-service/    Likes
frontend/              React SPA + nginx gateway config
identity-service/      Users, follows, profile, auth
io/                    Standalone Socket.IO server
lib/                   Shared TypeScript types/DTOs and socket event enums
mcp-server/            Standalone MCP server exposing BetterX tools/resources
media-service/         Presigned uploads + S3/MinIO image persistence
notification-service/  Notifications
pgvector/              Postgres + pgvector Dockerfile/init script
recommendation-service/ AI-powered "suggested users to follow"
scripts/                Shared tooling (ai-lint)
```
