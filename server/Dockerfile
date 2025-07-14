# ./Dockerfile
FROM node:18-alpine

# 1. Cria a pasta da aplicação
WORKDIR /app

# 2. Copia manifestos e instala deps
COPY package*.json tsconfig*.json ./
RUN npm install --production

# 3. Copia o código e transpila
COPY . .
RUN npm run build

# 4. Define variáveis de ambiente
ENV NODE_ENV=production
# Conecte-se ao serviço "db", não ao localhost do container
ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/postgres

# 5. Exponha porta e inicie
EXPOSE 3000
CMD ["node", "dist/index.js"]
