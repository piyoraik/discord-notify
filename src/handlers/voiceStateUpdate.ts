import { VoiceState } from "discord.js";
import { pg } from "../db.js";
import { displayNameOf, fmtDuration, fmtJst, nowUtc } from "../utils.js";
import { notify } from "../client.js";

/**
 * ユーザーのボイスチャンネル参加を処理する
 * @param guildId サーバーID
 * @param userId ユーザーID
 * @param newCh 参加したチャンネルID
 * @param username ユーザー名
 */
async function handleJoin(
  guildId: string,
  userId: string,
  newCh: string,
  username: string
) {
  const now = nowUtc();
  await pg.query(
    `INSERT INTO voice_sessions (guild_id, user_id, channel_id, started_at)
     VALUES ($1,$2,$3,$4)`,
    [guildId, userId, newCh, now]
  );
  await notify(`${username} が <#${newCh}> に参加しました (${fmtJst(now)})`);
}

/**
 * ユーザーのボイスチャンネル退室を処理する
 * @param guildId サーバーID
 * @param userId ユーザーID
 * @param oldCh 退室したチャンネルID
 * @param username ユーザー名
 */
async function handleLeave(
  guildId: string,
  userId: string,
  oldCh: string,
  username: string
) {
  const now = nowUtc();
  // 未終了セッションを終了
  const { rows } = await pg.query<{ id: number; started_at: string }>(
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
      `${username} が <#${oldCh}> から退室しました (${fmtJst(
        now
      )})\n合計滞在: ${fmtDuration(durationSec)}`
    );
  } else {
    // セッションが見つからない（Bot再起動中にjoinしてた等）
    await notify(
      `${username} が <#${oldCh}> から退室（セッション記録なし） (${fmtJst(
        now
      )})`
    );
  }
}

/**
 * ユーザーのボイスチャンネル移動を処理する
 * @param guildId サーバーID
 * @param userId ユーザーID
 * @param oldCh 移動元のチャンネルID
 * @param newCh 移動先のチャンネルID
 * @param username ユーザー名
 */
async function handleMove(
  guildId: string,
  userId: string,
  oldCh: string,
  newCh: string,
  username: string
) {
  // 連続セッションとして扱う：終了せず channel_id だけ更新する
  await pg.query(
    `UPDATE voice_sessions
       SET channel_id=$1
     WHERE guild_id=$2 AND user_id=$3 AND ended_at IS NULL`,
    [newCh, guildId, userId]
  );
  await notify(`${username} が <#${oldCh}> → <#${newCh}> に移動`);
}

/**
 * voiceStateUpdateイベントのメインハンドラ
 * ユーザーのVC参加/退室/移動を検知してそれぞれの処理を呼び出す
 * @param oldState 変更前のVoiceState
 * @param newState 変更後のVoiceState
 */
export async function onVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState
) {
  try {
    const member = newState.member || oldState.member;
    if (!member) return;

    // 対象ギルド/チャンネル/ユーザー
    const guildId = (newState.guild || oldState.guild).id;
    const userId = member.id;
    const username = displayNameOf(member);

    // users upsert（名前の最新化）
    await pg.query(
      `INSERT INTO users (user_id, username) VALUES ($1,$2)
       ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, updated_at = now()`,
      [userId, username]
    );

    const oldCh = oldState.channelId; // nullなら未参加
    const newCh = newState.channelId; // nullなら退室

    // JOIN: old null → new 有り
    if (!oldCh && newCh) {
      await handleJoin(guildId, userId, newCh, username);
      return;
    }

    // LEAVE: old 有り → new null
    if (oldCh && !newCh) {
      await handleLeave(guildId, userId, oldCh, username);
      return;
    }

    // MOVE: old 有り → new 有り（チャンネル移動）
    if (oldCh && newCh && oldCh !== newCh) {
      await handleMove(guildId, userId, oldCh, newCh, username);
      return;
    }

    // それ以外（ミュート変更等）は無視
  } catch (err) {
    console.error("voiceStateUpdate error:", err);
  }
}
