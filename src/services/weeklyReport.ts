import { EmbedBuilder } from "discord.js";
import { pg } from "../db.js";
import { fmtDuration, fmtJst } from "../utils.js";

export interface WeeklyStatsRow {
  user_id: string;
  username: string;
  total_seconds: string;
  main_channel_id: string | null;
  main_channel_seconds: string;
}

export interface PeriodRow {
  start_utc: string;
  end_utc: string;
}

export const WEEKLY_TOP_LIMIT = 10;

async function fetchPeriod(): Promise<PeriodRow> {
  const { rows } = await pg.query<PeriodRow>(
    `SELECT
        (date_trunc('week', now() AT TIME ZONE 'Asia/Tokyo') - interval '1 week') AT TIME ZONE 'UTC' AS start_utc,
        (date_trunc('week', now() AT TIME ZONE 'Asia/Tokyo')) AT TIME ZONE 'UTC' AS end_utc`
  );

  if (!rows.length) {
    throw new Error("Failed to calculate weekly period");
  }
  return rows[0];
}

async function fetchWeeklyStats(guildId: string, period: PeriodRow) {
  const { rows } = await pg.query<WeeklyStatsRow>(
    `WITH per_channel AS (
         SELECT vs.user_id,
                u.username,
                vs.channel_id,
                SUM(vs.duration_seconds)::bigint AS channel_seconds
           FROM voice_sessions vs
           JOIN users u ON u.user_id = vs.user_id
          WHERE vs.guild_id = $1
            AND vs.duration_seconds IS NOT NULL
            AND vs.ended_at >= $2
            AND vs.ended_at < $3
          GROUP BY vs.user_id, u.username, vs.channel_id
       ), ranked AS (
         SELECT *,
                SUM(channel_seconds) OVER (PARTITION BY user_id) AS total_seconds,
                ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY channel_seconds DESC) AS channel_rank
           FROM per_channel
       )
     SELECT user_id,
            username,
            total_seconds::text,
            channel_id AS main_channel_id,
            channel_seconds::text AS main_channel_seconds
       FROM ranked
      WHERE channel_rank = 1
      ORDER BY total_seconds DESC, username ASC`,
    [guildId, period.start_utc, period.end_utc]
  );

  return rows;
}

export function buildWeeklyReportEmbed(
  stats: WeeklyStatsRow[],
  period: PeriodRow
): EmbedBuilder {
  const start = new Date(period.start_utc);
  const end = new Date(period.end_utc);
  const embed = new EmbedBuilder().setTitle(
    `先週のボイスチャット滞在時間 (${fmtJst(start)} 〜 ${fmtJst(end)})`
  );

  if (!stats.length) {
    embed.setDescription("対象期間の通話記録はありませんでした。");
    return embed;
  }

  const limited = stats.slice(0, WEEKLY_TOP_LIMIT);
  const nameLines: string[] = [];
  const channelLines: string[] = [];
  const durationLines: string[] = [];

  for (let i = 0; i < limited.length; i++) {
    const row = limited[i];
    const rank = i + 1;
    nameLines.push(`${rank}. ${row.username}`);
    channelLines.push(row.main_channel_id ? `<#${row.main_channel_id}>` : "-");
    durationLines.push(fmtDuration(parseInt(row.total_seconds, 10)) || "0秒");
  }

  if (stats.length > WEEKLY_TOP_LIMIT) {
    nameLines.push(`他 ${stats.length - WEEKLY_TOP_LIMIT} 名`);
    channelLines.push("-");
    durationLines.push("-");
  }

  embed.addFields(
    { name: "名前", value: nameLines.join("\n") || "-", inline: true },
    { name: "チャンネル", value: channelLines.join("\n") || "-", inline: true },
    { name: "滞在時間", value: durationLines.join("\n") || "-", inline: true }
  );

  const totalSeconds = stats.reduce(
    (sum, row) => sum + parseInt(row.total_seconds, 10),
    0
  );

  embed.setFooter({ text: `合計滞在時間: ${fmtDuration(totalSeconds)}` });

  return embed;
}

export async function collectWeeklyReport(guildId: string) {
  const period = await fetchPeriod();
  const stats = await fetchWeeklyStats(guildId, period);
  const embed = buildWeeklyReportEmbed(stats, period);
  return { period, stats, embed };
}
