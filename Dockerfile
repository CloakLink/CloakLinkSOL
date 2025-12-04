FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY frontend/package.json frontend/package.json
COPY indexer/package.json indexer/package.json
RUN npm ci

FROM base AS build
ARG DATABASE_URL=postgresql://cloaklink:cloaklink@postgres:5432/cloaklink?schema=public
ENV DATABASE_URL=$DATABASE_URL
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm --workspace api run generate \
  && npm --workspace api run build \
  && npm --workspace indexer run build \
  && npm --workspace frontend run build \
  && npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/api ./api
COPY --from=build /app/indexer ./indexer
COPY --from=build /app/frontend ./frontend
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/docs ./docs
COPY --from=build /app/data ./data
RUN chown -R node:node /app
USER node
EXPOSE 3000 4000
CMD ["npm", "run", "dev:all"]
