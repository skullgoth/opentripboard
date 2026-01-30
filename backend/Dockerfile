# Multi-stage build for production optimization

# Stage 1: Base
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init python3 make g++ curl

# Stage 2: Dependencies
FROM base AS dependencies
COPY package*.json ./
RUN npm install --only=production

# Stage 3: Development
FROM base AS development
COPY package*.json ./
RUN npm install
COPY . .
# Create uploads directory with proper ownership for development
RUN mkdir -p /app/uploads/covers /app/uploads/cover-images && \
    chown -R node:node /app/uploads
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Stage 4: Production
FROM base AS production
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# Create uploads directory with proper ownership before switching to node user
# This ensures Docker volumes inherit correct permissions
RUN mkdir -p /app/uploads/covers /app/uploads/cover-images && \
    chown -R node:node /app
USER node
EXPOSE 3000
CMD ["dumb-init", "node", "src/server.js"]
