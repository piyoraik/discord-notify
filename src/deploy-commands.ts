import { REST, Routes } from "discord.js";
import { config } from "./config.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const commands = [];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(filePath);
  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
    );
  }
}

if (!config.discord.token) {
  throw new Error("DISCORD_TOKEN is not defined in the environment variables.");
}

const rest = new REST({ version: "10" }).setToken(config.discord.token);

(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    if (!config.discord.clientId || !config.discord.guildId) {
      throw new Error(
        "CLIENT_ID and GUILD_ID must be defined in the environment variables."
      );
    }

    const data = await rest.put(
      Routes.applicationGuildCommands(
        config.discord.clientId,
        config.discord.guildId
      ),
      { body: commands }
    );

    console.log(
      `Successfully reloaded ${
        (data as any[]).length
      } application (/) commands.`
    );
  } catch (error) {
    console.error(error);
  }
})();
