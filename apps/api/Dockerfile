FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/arbre/package*.json ./packages/arbre/
COPY packages/config-eslint/package*.json ./packages/config-eslint/
COPY packages/config-typescript/package*.json ./packages/config-typescript/
COPY packages/jest-presets/package*.json ./packages/jest-presets/
COPY packages/types/package*.json ./packages/types/
COPY packages/ui/package*.json ./packages/ui/
RUN npm ci --omit=dev --workspace=apps/api

FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build --workspace=apps/api

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.cjs"]
