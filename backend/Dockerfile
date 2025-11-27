# Use Node.js LTS
FROM node:20-slim

# Install system dependencies (needed for some node modules)
# Install system dependencies (needed for some node modules and audio processing)
RUN apt-get update -y && apt-get install -y openssl ca-certificates ffmpeg

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Expose port (optional, but good practice)
EXPOSE 3001

# Start the worker
CMD ["npm", "run", "start"]
