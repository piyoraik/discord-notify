import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { pg } from "../db.js";
import { fmtDuration } from "../utils.js";

export const data = new SlashCommandBuilder()
  .setName("pttime")
  .setDescription("あなたのこのサーバーでの合計通話時間を表示します。");

export async function execute(interaction: CommandInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "このコマンドはサーバー内でのみ実行できます。",
      ephemeral: true,
    });
    return;
  }

  try {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    const { rows } = await pg.query<{ total_duration: string | null }>(
      `SELECT SUM(duration_seconds) AS total_duration
       FROM voice_sessions
       WHERE user_id = $1 AND guild_id = $2`,
      [userId, guildId]
    );

    const totalDurationSec = parseInt(rows[0]?.total_duration || "0", 10);

    if (totalDurationSec === 0) {
      await interaction.reply({
        content: "あなたの通話記録はまだありません。",
        ephemeral: true,
      });
      return;
    }

    const formattedDuration = fmtDuration(totalDurationSec);
    await interaction.reply({
      content: `あなたのこのサーバーでの合計通話時間は **${formattedDuration}** です。`,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Failed to fetch pttime:", error);
    await interaction.reply({
      content: "通話時間の取得中にエラーが発生しました。",
      ephemeral: true,
    });
  }
}
