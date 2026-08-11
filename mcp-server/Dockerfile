FROM node:24-alpine

WORKDIR /app

# Copy all source files
COPY scripts/ ./scripts/
COPY db/ ./db/
COPY mcp-server/ ./mcp-server/

# Install mcp-server dependencies
WORKDIR /app/mcp-server
RUN npm install --omit=dev

# Set up runtime
WORKDIR /app/mcp-server
CMD ["npm", "start"]
