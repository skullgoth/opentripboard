# Multi-stage build for production optimization

# Stage 1: Base
FROM node:20-alpine AS base
WORKDIR /app

# Stage 2: Dependencies
FROM base AS dependencies
COPY package*.json ./
RUN npm install --only=production

# Stage 3: Development
FROM base AS development
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Stage 4: Build
FROM base AS build
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 5: Production
FROM base AS production
ENV NODE_ENV=production
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 5173
USER node
CMD ["serve", "-s", "dist", "-l", "5173"]
