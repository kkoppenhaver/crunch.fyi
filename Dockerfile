# Use Node.js LTS
FROM node:20-slim

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY api/package*.json ./api/

# Install dependencies
RUN npm install
RUN cd api && npm install

# Copy source code
COPY . .

# Build frontend and API
RUN npm run build
RUN npm run build:api

# Expose port (Railway sets PORT env var)
EXPOSE 8080

# Set production environment
ENV NODE_ENV=production

# Start the server
CMD ["npm", "run", "start"]
