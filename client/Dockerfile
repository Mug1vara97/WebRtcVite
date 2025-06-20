# Build stage
FROM node:18-alpine as build

# Install build dependencies and clean up cache in the same layer
RUN apk add --no-cache python3 make g++ && \
    npm cache clean --force

WORKDIR /app

# Copy only package files first
COPY package*.json ./

# Install dependencies with clean npm cache and force flag
RUN npm install --legacy-peer-deps --force && \
    npm cache clean --force

# Copy only necessary source files
COPY src ./src
COPY public ./public
COPY index.html ./
COPY vite.config.js ./

# Build the app
RUN npm run build && \
    npm cache clean --force && \
    rm -rf node_modules

# Install serve globally in a separate stage
FROM node:18-alpine

WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy only the built files from build stage
COPY --from=build /app/dist ./dist

EXPOSE 3001

# Serve the Vite build output
CMD ["serve", "-s", "dist", "-l", "3001"] 