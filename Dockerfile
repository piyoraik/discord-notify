FROM node:20-slim
WORKDIR /app

# 依存だけ先にインストールしてレイヤをキャッシュ
COPY package*.json ./
RUN npm ci --omit=dev

# アプリ本体
COPY . .

CMD ["node", "index.js"]