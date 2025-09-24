export function nowUtc() {
  return new Date(); // JSのDateはUTC基準。DBはtimestamptzに入れる
}

export function fmtJst(date) {
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

export function fmtDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (h) parts.push(`${h}時間`);
  if (m) parts.push(`${m}分`);
  if (!h && !m) parts.push(`${s}秒`);
  return parts.join("");
}

export function displayNameOf(member) {
  // 優先順: サーバーニックネーム(displayName) → グローバル名(globalName) → ユーザー名(username) → 旧式タグ(tag)
  return (
    member?.displayName ||
    member?.user?.globalName ||
    member?.user?.username ||
    member?.user?.tag ||
    member?.id
  );
}
