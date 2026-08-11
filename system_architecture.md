# Project Architecture & Context

## Core Tech Stack
- Services: Node.js, Express 5, TypeScript, Joi validation, Sequelize (sequelize-typescript) — one microservice per domain (see Microservices Architecture below), each with its own DB schema.
- Frontend: React 19, Vite, TypeScript, Redux Toolkit, React Hook Form, Axios
- Realtime: Socket.IO server in separate io service
- Database: MySQL (Docker compose), MinIO for object storage (S3-compatible), Postgres+pgvector (dedicated instance for AI post embeddings/user-similarity search)
- Messaging: RabbitMQ (topic exchange `betterx.events`) for durable, retryable cross-service domain events (notifications, post-embedding sync); synchronous REST/API composition remains the pattern for request/response reads.
- AI: OpenAI (text improve, moderation, post embeddings, follow-suggestion ranking), Google Gemini (post image generation, avatar generation)

## Microservices Architecture
The original Express monolith (`backend/`) has been fully decomposed into standalone TypeScript
microservices, each with its own MySQL schema (database-per-service) and each verifying
JWTs itself via a shared `app.encryptionKey` secret (no synchronous auth-service call per
request). `backend/` has been retired entirely — its last remaining responsibility
(signup/login/JWT-issuing) was merged into identity-service.

- **identity-service** (port 3010) — owns `User`/`Follow`/`OutboxEvent` (schema `betterx_identity`). Routes: `/auth/signup`, `/auth/login` (public, mounted before the auth-enforce middleware), `/users`, `/follows/*`, `/profile/account`. Follow creation writes a `follow.created` outbox row in the same DB transaction as the `Follow` insert (see **rabbitmq**'s outbox note below) instead of publishing to RabbitMQ directly in-request.
- **content-service** (port 3009) — owns `Post`/`Comment`/`OutboxEvent` (schema `betterx_content`). Routes: `/feed`, `/posts/*`, `/comments/*`. Composes user snapshots via identity-service's REST API. Post/comment create/update/delete writes an outbox row (`post.created`/`post.updated`/`post.deleted`/`comment.created`) in the same DB transaction as the domain write instead of calling notification-service or recommendation-service synchronously, or publishing to RabbitMQ directly in-request (see **rabbitmq** below); `post.created`'s payload carries `userId`/`title`/`body` in addition to the actor snapshot so a single outbox row serves both notification-service's fan-out and recommendation-service's embedding sync.
- **engagement-service** (port 3008) — owns `Like` (schema `betterx_likes`). Routes: `/likes/*`, including a batch endpoint used by content-service to attach `likes` arrays to posts/comments (API composition instead of a cross-DB join).
- **notification-service** (port 3007) — owns `Notification` (schema `betterx_notifications`), denormalizing actor snapshots at write time. Emits the realtime `NEW_NOTIFICATION` socket event. Routes: `/notifications/*` (`GET /`, `PATCH /read`, `PATCH /:notificationId/read` — the old `POST /notifications` route was removed as dead code once notification creation moved fully to the RabbitMQ consumer path). Consumes `post.created`/`comment.created`/`follow.created` from its own durable queue (`notification-service.events`) bound to the `betterx.events` exchange - for `post.created` it resolves the author's followers itself (one event fans out to N notifications) instead of the producer looping N HTTP calls.
- **media-service** (port 3006) — presigned browser uploads (`/uploads/presign`) and server-to-server image persistence to S3/MinIO (`/media/persist-image`), reused by content/identity services.
- **ai-service** (port 3005) — all `/drafts/*` endpoints (text improve, image/avatar generation, profanity checks).
- **recommendation-service** (port 3011) — AI-powered "suggested users to follow". Owns `PostEmbedding` rows in a dedicated Postgres+pgvector instance (schema `betterx_recommendations`, root `pgvector/` Dockerfile enables `CREATE EXTENSION vector`). Consumes `post.created`/`post.updated`/`post.deleted` from its own durable queue (`recommendation-service.events`) bound to the `betterx.events` exchange to keep embeddings (OpenAI `text-embedding-3-small`) in sync, instead of content-service calling it synchronously. The old internal `PUT/DELETE /internal/post-embeddings` REST endpoints were removed as dead code (content-service stopped calling them once the RabbitMQ consumer took over, and the startup backfill always called the embedding functions in-process directly, never via HTTP). Public `GET /recommendations/suggested-users` finds users whose average post embedding is closest by cosine distance (pgvector `<=>`) to the authenticated user's own posts, excludes self and already-followed users (via identity-service), then asks an LLM (`gpt-4.1-mini`) to rank candidates and write a personalized `reasonToFollow`, falling back to similarity-only ordering if the LLM call fails. Runs a startup backfill that embeds any pre-existing posts fetched page-by-page from content-service.
- **io** (port 3004) — standalone Socket.IO server; other services connect to it as a `socket.io-client`.
- **mcp-server** — standalone stdio MCP server; calls ai-service/content-service/identity-service over REST with a self-signed JWT, and connects to `io` directly for realtime broadcast. Has its own `config/` (no longer shares `backend/config`).
- **frontend** (nginx on port 80) — single-page app; nginx does path-based routing to each service (`/auth` → identity-service, `/feed|posts|comments` → content-service, `/likes` → engagement-service, `/notifications` → notification-service, `/uploads|drafts` → media/ai-service, `/profile|follows|users` → identity-service, `/recommendations` → recommendation-service). Uses `resolver 127.0.0.11` + `set $var http://host:port; proxy_pass $var;` to avoid nginx startup-order crashes; bare `proxy_pass $var;` only (no path suffix) so the original URI passes through unchanged.
- **db/** — MySQL Dockerfile/seed only; each service creates and seeds its own schema at startup (`ensureDatabaseExists` + idempotent seed-loader replaying `db/seed.sql`).
- **rabbitmq** — off-the-shelf `rabbitmq:3.13-management-alpine` broker (no custom Dockerfile, same convention as `minio`). Durable topic exchange `betterx.events`; producers (content-service: `post.created`/`post.updated`/`post.deleted`/`comment.created`, identity-service: `follow.created`) publish domain events and notification-service/recommendation-service each bind their own durable queue to the routing keys they care about (`post.created` is bound by both, off the same single publish). Producers use a **transactional outbox**: each domain write (Post/Comment/Follow create/update/destroy) and its corresponding `OutboxEvent` row are written in one Sequelize transaction, so they either both commit or both roll back; a `setInterval` poller (`mq/outbox.ts`, ~1s) then publishes unpublished rows and marks `publishedAt`. This closes the dual-write gap the earlier direct in-request `channel.publish()` calls had (DB commit succeeds but the process crashes, or the broker is briefly unreachable, right before the publish) - a RabbitMQ outage now only delays delivery (rows stay unpublished and drain automatically once the broker is back) instead of silently losing the event. Consumers (notification-service, recommendation-service) connect with a bounded retry loop at startup. Management UI on port 15672 (dev only; not exposed to the host in prod).
- **pgvector/** — Postgres+pgvector Dockerfile/init.sql only, analogous to `db/` but for recommendation-service's vector store; not shared with any other service.

## Established Decisions
- Each service uses node-config with env mapping via its own `<service>/config/custom-environment-variables.json` (no shared/central config directory).
- Authentication is enforced by Bearer JWT middleware before protected routers in every service; identity-service's `/auth/signup` and `/auth/login` are mounted before that middleware since they must stay public.
- JWTs only ever encode non-sensitive fields (`id`, `name`, `username`, `avatarUrl`) — never the password hash — since a JWT is base64, not encrypted, and is returned directly to the browser.
- Draft AI endpoints live under /drafts (ai-service) and are reused by post/comment flows.
- Draft AI endpoints cover text improve, post image generation, avatar generation, and profanity checks.
- Text improve supports style selection: professional, funny, sad, casual, inspirational.
- Image generation prompt derives from both post title and post body.
- Avatar generation accepts a user-written prompt, runs the same two-tier moderation gate, and stores the generated image in the avatars bucket before profile update.
- Moderation is tiered (hard_block, soft_filter, allow) and enforced server-side (content-service) for post/comment create+update with frontend precheck before submit.
- Moderation checks are language-agnostic and avoid static profanity dictionaries; classifier prompt is multilingual and includes evasion detection.
- Moderation path includes OpenAI moderation precheck before classifier tiering; severe categories are blocked early.
- For edit flows, moderation precheck runs only when title/body actually changed.
- Moderation UX feedback uses inline toast notifications (not alert popups) in new/edit post/comment/reply flows.
- Content Guidelines are shown in an in-page modal (no separate guidelines page/window).
- Two-tier local AI linting exists for TS/TSX changes: Tier 1 local AST/keyword filter (0-token path) and Tier 2 low-token LLM evaluator when triggered.
- Services and frontend each expose ai-lint scripts; container images copy scripts/ai-lint/ai-lint.ts and scripts/ai-lint/rules.json so the scripts resolve inside images.
- Frontend TypeScript must avoid any and uses typed Axios error extraction patterns.
- Database Docker assets live in root db/ and compose builds the database service from that folder.
- Service startup skips bucket-level CORS setup for MinIO endpoints because MinIO does not implement the same bucket CORS API behavior.
- AI-generated recommendations (follow suggestions) never encode a hard failure mode: if the LLM ranking call fails (missing/rate-limited key), the feature degrades to similarity-only ordering with a generic reason instead of erroring out.

## Current Progress & Next Steps
- Finished:
  - Full microservices decomposition of the former backend monolith into identity-service, content-service, engagement-service, notification-service, media-service, ai-service, plus the pre-existing io service (see Microservices Architecture above)
  - backend/ retired entirely; signup/login/JWT-issuing merged into identity-service's `/auth` router
  - AI-powered "suggested users to follow" feature (recommendation-service + pgvector): post embeddings kept in sync from content-service, cosine-similarity candidate search excluding self/already-followed, LLM-written personalized reasons, shown on the Follows page (own profile) and the Users page in the frontend
  - AI improve + image generation in new post flow
  - AI improve in new comment flow
  - AI improve + image generation in post edit flow
  - AI improve in comment edit flow
  - Gemini avatar generation in signup and profile edit flows with moderation precheck
  - Tiered moderation middleware + /drafts/check-profanity endpoint
  - Frontend moderation precheck integration in create/edit submit paths
  - Multilingual moderation hardening and fail-safe behavior for invalid classifier output
  - In-page Content Guidelines modal in new post and post edit
  - Inline moderation toasts in post/comment create/edit/reply flows
  - Two-tier ai-lint framework and rulebook (local AST filter + low-token LLM escalation)
  - Package scripts wired for ai-lint execution across services and frontend
  - Root db/ folder relocation for MySQL Dockerfile and seed data
  - MinIO-safe bucket startup path for avatar/app buckets
  - Header wobble fix by removing header auto-hide on scroll/mouse movement
- In Progress:
  - Moderate UX polish for moderation toast messaging hierarchy (reduce stacked toasts)
- Residual Risk:
  - OpenAI/Gemini key availability and model access can cause runtime failures if env keys are missing or revoked
  - Model-based moderation can still have false positives/negatives on nuanced multilingual slang; monitor and tune prompt/policies

