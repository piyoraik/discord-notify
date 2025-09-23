import { Client, GatewayIntentBits } from "discord.js";

const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  console.log(`[${message.author.username}] ${message.content}`);
});

client.login(TOKEN);