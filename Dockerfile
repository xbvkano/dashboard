# Build from repository root:
#   docker build -t dashboard-api .
FROM node:20-alpine
WORKDIR /app

COPY server/package*.json server/tsconfig.json ./
COPY server/prisma ./prisma

RUN npm ci

COPY server/src ./src

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
