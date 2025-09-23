FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

# Yarnを有効化（Node 20以降は corepack 同梱）
RUN corepack enable

# 依存だけ先にインストール（キャッシュ効くように）
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true

# アプリ本体
COPY . .

CMD ["node", "index.js"]