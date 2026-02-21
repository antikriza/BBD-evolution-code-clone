FROM node:20-alpine

# Build tools for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --production 2>/dev/null || npm install --production

COPY src/ ./src/

CMD ["node", "src/index.js"]
