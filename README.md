# Discord Notify Bot

Discord のボイスチャンネルへのユーザーの入退室を監視し、指定されたチャンネルに通知する Bot です。また、ユーザーごとの合計通話時間を記録・表示する機能も備えています。

## 主な機能

- ボイスチャンネルへの参加・退室・移動をテキストチャンネルに通知
- ユーザーごとの通話時間をデータベース（PostgreSQL）に記録
- スラッシュコマンドによる機能提供
  - `/pttime`: 自分の合計通話時間を表示します

## 技術スタック

- 言語: TypeScript
- ランタイム: Node.js
- フレームワーク: [discord.js](https://discord.js.org/)
- データベース: PostgreSQL
- CI/CD: GitHub Actions

---

## セットアップと実行方法

### 1. 前提条件

- Node.js v22 以上
- Yarn
- PostgreSQL サーバー
- Discord Bot アプリケーションの作成

### 2. 環境変数の設定

プロジェクトルートに`.env`ファイルを作成し、`.env.example`を参考に以下の値を設定します。

```env
# Discord Bot
DISCORD_TOKEN= # Botのトークン
NOTIFY_CHANNEL_ID= # 通知を送信するチャンネルのID
CLIENT_ID= # BotのクライアントID
GUILD_ID= # Botを導入するサーバーのID

# PostgreSQL
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=password
PGDATABASE=discordbot
```

### 3. データベースの準備

指定したデータベースに、以下のテーブルを作成してください。

```sql
CREATE TABLE users (
    user_id VARCHAR(255) PRIMARY KEY,
    username VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE voice_sessions (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    channel_id VARCHAR(255) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4. 依存関係のインストール

```bash
yarn install
```

### 5. スラッシュコマンドの登録

以下のコマンドを実行して、Discord サーバーにスラッシュコマンドを登録します。
このコマンドは、新しいコマンドを追加・変更した際に一度だけ実行すれば OK です。

```bash
yarn deploy
```

### 6. Bot の起動

- **開発モードでの起動（ホットリロード有効）**

  ```bash
  yarn dev
  ```

- **本番モードでの起動**
  ```bash
  yarn build
  yarn start
  ```

---

## 開発フローとリリース手順

当プロジェクトでは、コミットメッセージの規約化とリリース作業の自動化を行っています。

### コミット規約

コミットメッセージは[Conventional Commits](https://www.conventionalcommits.org/)の規約にしたがってください。`husky`と`commitlint`により、規約に違反するメッセージでのコミットは自動的に拒否されます。

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `style`: コードの動作に影響しない変更（空白、フォーマットなど）
- `refactor`: リファクタリング
- `test`: テストの追加・修正
- `chore`: ビルドプロセスや補助ツールの変更

### リリース手順

1.  `main`ブランチで開発作業を行い、規約にしたがってコミットします。
2.  変更をリモートリポジトリにプッシュします。
    ```bash
    git push
    ```
3.  `husky`の`pre-push`フックにより、プッシュ直前に`yarn release`が自動実行され、バージョンアップ、CHANGELOG 生成、タグ付けが行われた後、生成されたコミットとタグを含めてプッシュが実行されます。

**注意:** このプロジェクトでは`git push`を行うたびに自動でリリース処理が実行されます。意図しないバージョンアップを防ぐため、開発途中のコミットを頻繁にプッシュする運用は避けてください。

---

## CI/CD (GitHub Actions)

このリポジトリでは、Git タグのプッシュをトリガーとして、以下の CI/CD が自動的に実行されます。

### 1. スラッシュコマンドの自動デプロイ

- **ワークフロー**: `.github/workflows/deploy-commands.yml`
- **トリガー**: `v*`形式のタグがプッシュされた時
- **処理**: `yarn deploy`を実行し、Discord サーバーにスラッシュコマンドを登録・更新します。
- **必要な Secrets**: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`

### 2. Docker イメージのビルド＆プッシュ

- **ワークフロー**: `.github/workflows/build-and-push.yml`
- **トリガー**: `v*`形式のタグがプッシュされた時
- **処理**:
  1.  `Dockerfile`を元に Docker イメージをビルドします。
  2.  プッシュされた Git タグ（例: `v1.0.0`）と`latest`の 2 つのタグを付けて、GitHub Container Registry (GHCR) にプッシュします。
- **必要な Secrets**: なし (`GITHUB_TOKEN`が自動的に使用されます)
