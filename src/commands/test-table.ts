import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("test-table")
  .setDescription("Show table formatting examples.");

export async function execute(interaction: ChatInputCommandInteraction) {
  const rows = [
    ["Name", "Score", "Rank"],
    ["Alice", "120", "1"],
    ["Bob", "98", "2"],
  ];

  const columnWidths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map((row) => row[columnIndex].length))
  );

  const asciiTable = rows
    .map((row) =>
      row
        .map((cell, columnIndex) =>
          cell.padEnd(columnWidths[columnIndex], " ")
        )
        .join(" | ")
    )
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("Leaderboard")
    .addFields(
      { name: "Name", value: "Alice\nBob", inline: true },
      { name: "Score", value: "120\n98", inline: true },
      { name: "Rank", value: "1\n2", inline: true }
    );

  await interaction.reply({
    content: `\`\`\`\n${asciiTable}\n\`\`\``,
    embeds: [embed],
    ephemeral: true,
  });
}
