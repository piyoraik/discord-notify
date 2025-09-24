# Discord Notify Bot

Discord サーバーのボイスチャンネル出入りを検知し、指定したテキストチャンネルへ通知する Discord Bot です。
参加/退室の記録は PostgreSQL に保存し、滞在時間をスラッシュコマンドで確認できます。

## 主な機能
- ボイスチャンネルの参加・退室・移動をリアルタイムで検知
- 通知チャンネルへのメッセージ送信
- PostgreSQL へのセッション履歴保存
- `/pttime` コマンドによる通話時間の確認

## 必要要件
- Node.js 20 以上（推奨: Node 22）
- Yarn (Corepack)
- PostgreSQL 14 以上
- Discord Bot アプリケーションおよびトークン

## 環境変数
`.env` などに以下を設定します。

| 変数名 | 説明 |
| --- | --- |
| `DISCORD_TOKEN` | Bot のトークン |
| `CLIENT_ID` | Discord アプリケーションのクライアント ID |
| `GUILD_ID` | コマンドを配備するサーバー ID |
| `NOTIFY_CHANNEL_ID` | 通知を送るテキストチャンネル ID |
| `PGHOST` | PostgreSQL ホスト |
| `PGPORT` | PostgreSQL ポート (デフォルト: 5432) |
| `PGUSER` | PostgreSQL ユーザー |
| `PGPASSWORD` | PostgreSQL パスワード |
| `PGDATABASE` | PostgreSQL データベース名 (未指定時は `discordbot`) |

## セットアップ
1. 依存関係をインストール
   ```bash
   yarn install --frozen-lockfile
   ```
2. データベースを用意し、以下を参考にテーブルを作成します。
   ```sql
   CREATE TABLE users (
     user_id TEXT PRIMARY KEY,
     username TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   );
   
   CREATE TABLE voice_sessions (
     id SERIAL PRIMARY KEY,
     guild_id TEXT NOT NULL,
     user_id TEXT NOT NULL,
     channel_id TEXT NOT NULL,
     started_at TIMESTAMPTZ NOT NULL,
     ended_at TIMESTAMPTZ,
     duration_seconds INTEGER,
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ```
3. Bot を招待し、`Guilds` と `Guild Voice States` インテントを有効化します。
4. スラッシュコマンドを配備
   ```bash
   yarn deploy
   ```

## 実行方法
- 開発モード
  ```bash
  yarn dev
  ```
- ビルド & 実行
  ```bash
  yarn build
  yarn start
  ```

## Docker で動かす
```bash
docker build -t discord-notify-bot .
docker run --rm \
  --env-file .env \
  discord-notify-bot
```

## 利用可能なスラッシュコマンド
| コマンド | 説明 |
| --- | --- |
| `/pttime` | サーバー内の累計通話時間を返します (本人のみが閲覧可能) |
| `/test` | 動作確認用メッセージを返します |

## ディレクトリ構成
```
src/
  client.ts            // Discord クライアントと通知処理
  commands/            // スラッシュコマンド定義
  handlers/            // イベントハンドラ
  utils.ts             // 日付フォーマット等のヘルパー
  deploy-commands.ts   // コマンド配備スクリプト
```

## 開発メモ
- Husky により `pre-push` フックが有効です。
- `standard-version` で CHANGELOG の更新とバージョニングを行います。
