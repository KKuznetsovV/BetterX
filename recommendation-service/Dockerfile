FROM node:24-alpine

WORKDIR /app

COPY scripts/ai-lint/ai-lint.ts ./ai-lint.ts
COPY scripts/ai-lint/rules.json ./rules.json

WORKDIR /app/recommendation-service

COPY recommendation-service/package*.json ./

RUN npm install --omit=dev

COPY recommendation-service/ ./

RUN npm run build

CMD ["npm", "run", "compose"]
