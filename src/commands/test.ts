import { CommandInteraction, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("test")
  .setDescription("Replies with Hello World!");

export async function execute(interaction: CommandInteraction) {
  await interaction.reply({ content: "Hello World", ephemeral: true });
}
