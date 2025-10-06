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

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  weekday: "short",
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

  const { rows } = await pg.query<{
    started_at: string;
    ended_at: string;
    channel_id: string | null;
  }>(
    `SELECT started_at, ended_at, channel_id
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
    {
      totalSeconds: number;
      startMs: number;
      endMs: number;
      channels: Set<string>;
    }
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

      let existing = dayData.get(dayStart);
      if (!existing) {
        existing = {
          totalSeconds: 0,
          startMs: Number.POSITIVE_INFINITY,
          endMs: 0,
          channels: new Set<string>(),
        };
        dayData.set(dayStart, existing);
      }

      existing.totalSeconds += chunkSeconds;
      existing.startMs = Math.min(existing.startMs, cursor);
      existing.endMs = Math.max(existing.endMs, chunkEnd);
      if (row.channel_id) {
        existing.channels.add(row.channel_id);
      }

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

  const timeLines: string[] = [];
  const durationLines: string[] = [];
  const channelLines: string[] = [];

  for (const [dayStart, info] of limitedDays) {
    timeLines.push(formatDayRange(dayStart, info.startMs, info.endMs));
    durationLines.push(fmtDuration(Math.round(info.totalSeconds)) || "0分");
    channelLines.push(formatChannels(info.channels));
  }

  const embed = new EmbedBuilder()
    .setTitle("ボイスチャット滞在履歴")
    .addFields(
      {
        name: "時間",
        value: timeLines.join("\n") || "-",
        inline: true,
      },
      {
        name: "滞在時間",
        value: durationLines.join("\n") || "-",
        inline: true,
      },
      {
        name: "チャンネル",
        value: channelLines.join("\n") || "-",
        inline: true,
      }
    );

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

function formatDayRange(
  dayStartJst: number,
  startMsJst: number,
  endMsJst: number
): string {
  const clampedStart = Math.max(startMsJst, dayStartJst);
  const dayEndJst = dayStartJst + DAY_MS;
  let clampedEnd = Math.min(endMsJst, dayEndJst);

  if (clampedEnd === dayEndJst && clampedEnd - clampedStart >= 60 * 1000) {
    clampedEnd -= 60 * 1000;
  }

  return `${formatWithWeekday(clampedStart)} - ${formatWithWeekday(clampedEnd)}`;
}

function formatWithWeekday(msJst: number): string {
  const date = new Date(msJst - JST_OFFSET_MS);
  const datePart = dateTimeFormatter.format(date);
  const weekday = weekdayFormatter.format(date);
  return `${datePart} (${weekday})`;
}

function formatChannels(channels: Set<string>): string {
  if (!channels.size) return "-";
  return Array.from(channels)
    .map((id) => `<#${id}>`)
    .join(", ");
}
