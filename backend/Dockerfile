# Use Node.js LTS
FROM node:20-slim

# Install system dependencies (needed for some node modules)
RUN apt-get update && apt-get install -y openssl ca-certificates

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Expose port (optional, but good practice)
EXPOSE 3001

# Start the worker
CMD ["npm", "run", "start"]
