FROM node:24-alpine

WORKDIR /app

COPY scripts/ai-lint/ai-lint.ts ./ai-lint.ts
COPY scripts/ai-lint/rules.json ./rules.json

WORKDIR /app/notification-service

COPY notification-service/package*.json ./

RUN npm install --omit=dev

COPY notification-service/ ./

RUN npm run build

CMD ["npm", "run", "compose"]
