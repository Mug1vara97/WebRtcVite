# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Add a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set npm cache directory and fix permissions
RUN mkdir -p /home/appuser/.npm && \
    chown -R appuser:appgroup /home/appuser/.npm

# Copy package files
COPY package*.json ./

# Set ownership of the workdir
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Install dependencies with legacy peer deps and clean npm cache
RUN npm cache clean --force && \
    npm install --legacy-peer-deps

# Copy source code
COPY --chown=appuser:appgroup . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3001

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 