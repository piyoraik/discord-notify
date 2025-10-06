import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { pg } from "../db.js";
import { fmtDuration } from "../utils.js";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 14;

const rangeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const data = new SlashCommandBuilder()
  .setName("history")
  .setDescription("ボイスチャット滞在履歴を表示します");

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "ギルド内でのみ利用可能なコマンドです。",
      ephemeral: true,
    });
    return;
  }

  const { rows } = await pg.query<{ started_at: string; ended_at: string }>(
    `SELECT started_at, ended_at
       FROM voice_sessions
      WHERE guild_id = $1
        AND user_id = $2
        AND ended_at IS NOT NULL
      ORDER BY started_at DESC
      LIMIT 1000`,
    [interaction.guildId, interaction.user.id]
  );

  if (!rows.length) {
    await interaction.reply({
      content: "記録された滞在履歴がまだありません。",
      ephemeral: true,
    });
    return;
  }

  const dayData = new Map<
    number,
    { totalSeconds: number; startMs: number; endMs: number }
  >();

  for (const row of rows) {
    const startedUtc = new Date(row.started_at);
    const endedUtc = new Date(row.ended_at);
    if (Number.isNaN(startedUtc.getTime()) || Number.isNaN(endedUtc.getTime())) {
      continue;
    }

    let cursor = startedUtc.getTime() + JST_OFFSET_MS;
    const endMs = endedUtc.getTime() + JST_OFFSET_MS;

    if (endMs <= cursor) {
      continue;
    }

    while (cursor < endMs) {
      const dayStart = Math.floor(cursor / DAY_MS) * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      const chunkEnd = Math.min(endMs, dayEnd);
      const chunkSeconds = (chunkEnd - cursor) / 1000;
      const existing = dayData.get(dayStart) ?? {
        totalSeconds: 0,
        startMs: Number.POSITIVE_INFINITY,
        endMs: 0,
      };

      existing.totalSeconds += chunkSeconds;
      existing.startMs = Math.min(existing.startMs, cursor);
      existing.endMs = Math.max(existing.endMs, chunkEnd);
      dayData.set(dayStart, existing);

      cursor = chunkEnd;
    }
  }

  if (!dayData.size) {
    await interaction.reply({
      content: "滞在時間の集計結果がありません。",
      ephemeral: true,
    });
    return;
  }

  const sortedDays = Array.from(dayData.entries()).sort((a, b) => b[0] - a[0]);
  const limitedDays = sortedDays.slice(0, MAX_ROWS);

  const timeLines = limitedDays
    .map(([dayStart, info]) => formatDayRange(info.startMs, info.endMs))
    .join("\n");

  const durationLines = limitedDays
    .map(([, info]) => fmtDuration(Math.round(info.totalSeconds)))
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("ボイスチャット滞在履歴")
    .addFields(
      {
        name: "時間",
        value: timeLines || "-",
        inline: true,
      },
      {
        name: "滞在時間",
        value: durationLines || "-",
        inline: true,
      }
    );

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

function formatDayRange(startMsJst: number, endMsJst: number): string {
  const startDate = new Date(startMsJst - JST_OFFSET_MS);
  const endDate = new Date(endMsJst - JST_OFFSET_MS);
  return `${rangeFormatter.format(startDate)} - ${rangeFormatter.format(endDate)}`;
}
