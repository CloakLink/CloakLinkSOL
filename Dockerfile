FROM node:20-alpine
WORKDIR /app

COPY package.json ./
COPY api/package.json ./api/package.json
COPY frontend/package.json ./frontend/package.json
COPY indexer/package.json ./indexer/package.json

RUN npm install

COPY . .

EXPOSE 3000 4000

CMD ["npm", "run", "dev:all"]
