import { client, notify } from "../client.js";
import { config } from "../config.js";
import { pg } from "../db.js";
import { fmtDuration, fmtJst } from "../utils.js";

interface WeeklyStatsRow {
  user_id: string;
  username: string;
  total_seconds: string;
}

interface PeriodRow {
  start_utc: string;
  end_utc: string;
}

const TOP_LIMIT = 10;

async function fetchPeriod(): Promise<PeriodRow> {
  const { rows } = await pg.query<PeriodRow>(
    `SELECT
        (date_trunc('week', now() AT TIME ZONE 'Asia/Tokyo') - interval '1 week') AT TIME ZONE 'Asia/Tokyo' AS start_utc,
        (date_trunc('week', now() AT TIME ZONE 'Asia/Tokyo')) AT TIME ZONE 'Asia/Tokyo' AS end_utc`
  );

  if (!rows.length) {
    throw new Error("Failed to calculate weekly period");
  }
  return rows[0];
}

async function fetchWeeklyStats(guildId: string, period: PeriodRow) {
  const { rows } = await pg.query<WeeklyStatsRow>(
    `SELECT vs.user_id, u.username, SUM(vs.duration_seconds)::bigint AS total_seconds
       FROM voice_sessions vs
       JOIN users u ON u.user_id = vs.user_id
      WHERE vs.guild_id = $1
        AND vs.duration_seconds IS NOT NULL
        AND vs.ended_at >= $2
        AND vs.ended_at < $3
      GROUP BY vs.user_id, u.username
      ORDER BY total_seconds DESC`,
    [guildId, period.start_utc, period.end_utc]
  );

  return rows;
}

function buildReportMessage(
  stats: WeeklyStatsRow[],
  period: PeriodRow
): string {
  const start = new Date(period.start_utc);
  const end = new Date(period.end_utc);
  const header = `先週のボイスチャット滞在ランキング (${fmtJst(start)} 〜 ${fmtJst(end)})`;

  if (stats.length === 0) {
    return `${header}\n対象期間の通話記録はありませんでした。`;
  }

  const lines = stats.slice(0, TOP_LIMIT).map((row, index) => {
    const duration = fmtDuration(parseInt(row.total_seconds, 10));
    return `${index + 1}. ${row.username}: ${duration}`;
  });

  if (stats.length > TOP_LIMIT) {
    lines.push(`…他 ${stats.length - TOP_LIMIT} 名`);
  }

  const totalSeconds = stats.reduce(
    (sum, row) => sum + parseInt(row.total_seconds, 10),
    0
  );
  lines.push(`合計通話時間: ${fmtDuration(totalSeconds)}`);

  return `${header}\n${lines.join("\n")}`;
}

async function ensureDiscordReady(token: string): Promise<void> {
  await client.login(token);
  if (client.isReady()) return;

  await new Promise<void>((resolve, reject) => {
    const readyHandler = () => {
      cleanup();
      resolve();
    };
    const errorHandler = (err: unknown) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      client.off("ready", readyHandler);
      client.off("error", errorHandler);
    };
    client.once("ready", readyHandler);
    client.once("error", errorHandler);
  });
}

async function main() {
  const token = config.discord.token;
  const guildId = config.discord.guildId;
  if (!token) {
    throw new Error("DISCORD_TOKEN is not set");
  }
  if (!guildId) {
    throw new Error("GUILD_ID is not set");
  }
  if (!config.discord.notifyChannelId) {
    throw new Error("NOTIFY_CHANNEL_ID is not set");
  }

  await pg.connect();

  try {
    const period = await fetchPeriod();
    const stats = await fetchWeeklyStats(guildId, period);

    await ensureDiscordReady(token);

    const message = buildReportMessage(stats, period);
    await notify(message);
  } finally {
    await pg.end().catch(() => undefined);
    client.destroy();
  }
}

main().catch((err) => {
  console.error("weeklyReport failed:", err);
  process.exitCode = 1;
});
