# Multi-stage build for production
# 1. Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for both frontend and backend
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN npm install
RUN cd backend && npm install
RUN cd frontend && npm install

# Copy source code
COPY . .

# Build backend and frontend
RUN npm run build

# 2. Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built assets and necessary files
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/frontend/dist ./frontend/dist

# Install production dependencies only
RUN cd backend && npm install --production

# Expose backend port
EXPOSE 3001

# Start the application
WORKDIR /app/backend
CMD ["npm", "start"]
