import { Client, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates, // 参加/退室/移動
  ],
});

export async function notify(message) {
  const channelId = config.discord.notifyChannelId;
  if (!channelId) return;

  const ch = await client.channels.fetch(channelId).catch(() => null);
  if (ch && ch.isTextBased()) {
    await ch.send(message);
  }
}
