import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { collectWeeklyReport } from "../services/weeklyReport.js";

export const data = new SlashCommandBuilder()
  .setName("weeklyreport")
  .setDescription("先週のボイスチャット滞在ランキングを表示します (テスト用)");

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "ギルド内でのみ利用できます。",
      ephemeral: true,
    });
    return;
  }

  try {
    const { embed } = await collectWeeklyReport(interaction.guildId);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error("Failed to fetch weekly report:", error);
    const message =
      interaction.deferred || interaction.replied
        ? interaction.followUp
        : interaction.reply;

    await message.call(interaction, {
      content: "週次レポートの取得中にエラーが発生しました。",
      ephemeral: true,
    });
  }
}
