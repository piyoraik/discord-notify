FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

COPY src src
COPY tsconfig.json .
COPY .env.example .env.example
CMD ["yarn", "start"]
