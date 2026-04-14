# Build from the server directory (Railway: set Root Directory to `server`), or from repo root:
#   docker build -f server/Dockerfile .
FROM node:20-alpine
WORKDIR /app

COPY package*.json tsconfig.json ./
COPY prisma ./prisma

# Full install: need prisma CLI + typescript for `npm run build` (prisma generate && tsc)
RUN npm ci

COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
