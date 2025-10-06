import {
  ChatInputCommandInteraction,
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

  const dayTotals = new Map<number, number>();

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
      const chunk = Math.min(endMs, dayEnd) - cursor;
      const previous = dayTotals.get(dayStart) ?? 0;
      dayTotals.set(dayStart, previous + chunk / 1000);
      cursor = Math.min(endMs, dayEnd);
    }
  }

  if (!dayTotals.size) {
    await interaction.reply({
      content: "滞在時間の集計結果がありません。",
      ephemeral: true,
    });
    return;
  }

  const sortedDays = Array.from(dayTotals.entries()).sort((a, b) => b[0] - a[0]);
  const limitedDays = sortedDays.slice(0, MAX_ROWS);

  const rowsForTable = limitedDays.map(([dayStart, totalSeconds]) => [
    formatDayRange(dayStart),
    fmtDuration(Math.round(totalSeconds)),
  ]);

  const table = buildAsciiTable([["時間", "滞在時間"], ...rowsForTable]);

  await interaction.reply({
    content: `\`\`\`\n${table}\n\`\`\``,
    ephemeral: true,
  });
}

function formatDayRange(dayStartMs: number): string {
  const startUtc = new Date(dayStartMs - JST_OFFSET_MS);
  const endUtc = new Date(startUtc.getTime() + DAY_MS - 60 * 1000);
  return `${rangeFormatter.format(startUtc)} - ${rangeFormatter.format(endUtc)}`;
}

function buildAsciiTable(rows: string[][]): string {
  if (!rows.length) return "";

  const columnWidths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map((row) => row[columnIndex].length))
  );

  return rows
    .map((row) =>
      row
        .map((cell, columnIndex) => cell.padEnd(columnWidths[columnIndex], " "))
        .join(" | ")
    )
    .join("\n");
}
