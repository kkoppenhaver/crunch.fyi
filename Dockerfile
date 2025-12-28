# Use Node.js LTS (full image, not slim - Claude Code needs git and other tools)
FROM node:20

# Install system dependencies that Claude Code may need
RUN apt-get update && apt-get install -y \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create home directory for claude config (running as root in container)
RUN mkdir -p /root/.claude

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
