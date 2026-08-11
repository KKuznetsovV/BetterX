FROM node:24-alpine as builder

WORKDIR /app

COPY scripts/ai-lint/ai-lint.ts ./ai-lint.ts
COPY scripts/ai-lint/rules.json ./rules.json

WORKDIR /app/frontend

COPY frontend/package*.json ./

RUN npm install

COPY frontend/ ./

ARG BUILD_SCRIPT=build:docker
RUN npm run ${BUILD_SCRIPT}

FROM nginx:alpine

WORKDIR /usr/share/nginx/html/

COPY --from=builder /app/frontend/dist/ ./

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]

