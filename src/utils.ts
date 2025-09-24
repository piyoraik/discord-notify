import { GuildMember } from "discord.js";

/**
 * 現在時刻のUTC Dateオブジェクトを返す
 * @returns {Date}
 */
export function nowUtc(): Date {
  return new Date(); // JSのDateはUTC基準。DBはtimestamptzに入れる
}

/**
 * Dateオブジェクトを日本のタイムゾーンの文字列にフォーマットする
 * @param {Date} date - フォーマットするDateオブジェクト
 * @returns {string} フォーマットされた文字列 (例: "2023/10/27 10:00:00")
 */
export function fmtJst(date: Date): string {
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

/**
 * 秒数を「X時間Y分Z秒」の形式にフォーマットする
 * @param {number} sec - 秒数
 * @returns {string} フォーマットされた期間文字列
 */
export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (h) parts.push(`${h}時間`);
  if (m) parts.push(`${m}分`);
  if (!h && !m) parts.push(`${s}秒`);
  return parts.join("");
}

/**
 * DiscordのGuildMemberオブジェクトから表示名を取得する
 * 優先順: サーバーニックネーム → グローバル名 → ユーザー名 → 旧式タグ
 * @param {GuildMember | null | undefined} member - GuildMemberオブジェクト
 * @returns {string} ユーザーの表示名
 */
export function displayNameOf(member: GuildMember | null | undefined): string {
  // 優先順: サーバーニックネーム(displayName) → グローバル名(globalName) → ユーザー名(username) → 旧式タグ(tag)
  if (!member) return "不明なユーザー";
  return (
    member.displayName ||
    member.user.globalName ||
    member.user.username ||
    member.user.tag ||
    member.id
  );
}
