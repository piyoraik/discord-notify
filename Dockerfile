FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true

COPY src src
COPY .env.example .env.example
CMD ["node", "src/index.js"]
