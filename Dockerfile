# ---- Builder Stage ----
FROM node:22-slim AS builder

WORKDIR /app
RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY src src
COPY tsconfig.json .
RUN yarn build

# ---- Production Stage ----
FROM node:22-slim AS production

WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true

COPY --from=builder /app/dist ./dist

CMD ["yarn", "start"]
