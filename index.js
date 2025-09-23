import { Client, GatewayIntentBits, time } from "discord.js";
import { Client as PgClient } from "pg";

const TOKEN = process.env.DISCORD_TOKEN;
const NOTIFY_CHANNEL_ID = process.env.NOTIFY_CHANNEL_ID;

// PostgreSQL 接続情報（DBはUTCで保存）
const pg = new PgClient({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || "discordbot",
});

function nowUtc() {
  return new Date(); // JSのDateはUTC基準。DBはtimestamptzに入れる
}
function fmtJst(date) {
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}
function fmtDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (h) parts.push(`${h}時間`);
  if (m) parts.push(`${m}分`);
  if (!h && !m) parts.push(`${s}秒`);
  return parts.join("");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates, // 参加/退室/移動
  ],
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await pg.connect();
  console.log("Connected to PostgreSQL");
});

// VC参加・退室・移動のたびに発火
client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    const member = newState.member || oldState.member;
    if (!member) return;

    // 対象ギルド/チャンネル/ユーザー
    const guildId = (newState.guild || oldState.guild).id;
    const userId = member.id;
    const username = member.user.tag;

    // users upsert（名前の最新化）
    await pg.query(
      `INSERT INTO users (user_id, username) VALUES ($1,$2)
       ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, updated_at = now()`,
      [userId, username]
    );

    const oldCh = oldState.channelId; // nullなら未参加
    const newCh = newState.channelId; // nullなら退室
    const now = nowUtc();

    // JOIN: old null → new 有り
    if (!oldCh && newCh) {
      await pg.query(
        `INSERT INTO voice_sessions (guild_id, user_id, channel_id, started_at)
         VALUES ($1,$2,$3,$4)`,
        [guildId, userId, newCh, now]
      );
      await notify(`${username} が <#${newCh}> に参加しました (${fmtJst(now)})`);
      return;
    }

    // LEAVE: old 有り → new null
    if (oldCh && !newCh) {
      // 未終了セッションを終了
      const { rows } = await pg.query(
        `SELECT id, started_at FROM voice_sessions
         WHERE guild_id=$1 AND user_id=$2 AND ended_at IS NULL
         ORDER BY started_at DESC LIMIT 1`,
        [guildId, userId]
      );

      if (rows.length) {
        const sess = rows[0];
        const durationSec = Math.max(
          0,
          Math.floor((now.getTime() - new Date(sess.started_at).getTime()) / 1000)
        );
        await pg.query(
          `UPDATE voice_sessions
             SET ended_at=$1, duration_seconds=$2
           WHERE id=$3`,
          [now, durationSec, sess.id]
        );
        await notify(
          `${username} が <#${oldCh}> から退室しました (${fmtJst(now)})\n合計滞在: ${fmtDuration(
            durationSec
          )}`
        );
      } else {
        // セッションが見つからない（Bot再起動中にjoinしてた等）
        await notify(
          `${username} が <#${oldCh}> から退室（セッション記録なし） (${fmtJst(now)})`
        );
      }
      return;
    }

    // MOVE: old 有り → new 有り（チャンネル移動）
    if (oldCh && newCh && oldCh !== newCh) {
      // 連続セッションとして扱う：終了せず channel_id だけ更新する or
      // 一旦終了→新規開始。ここでは「継続（channel_id更新）」で実装。
      await pg.query(
        `UPDATE voice_sessions
           SET channel_id=$1
         WHERE guild_id=$2 AND user_id=$3 AND ended_at IS NULL`,
        [newCh, guildId, userId]
      );
      await notify(`${username} が <#${oldCh}> → <#${newCh}> に移動`);
      return;
    }

    // それ以外（ミュート変更等）は無視
  } catch (err) {
    console.error("voiceStateUpdate error:", err);
  }
});

async function notify(message) {
  if (!NOTIFY_CHANNEL_ID) return;
  const ch = await client.channels.fetch(NOTIFY_CHANNEL_ID).catch(() => null);
  if (ch && ch.isTextBased()) {
    await ch.send(message);
  }
}

client.login(TOKEN);