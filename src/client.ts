import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { config } from "./config.js";

/**
 * Discordクライアントインスタンス
 */
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates, // 参加/退室/移動
  ],
});

/**
 * 指定されたチャンネルに通知メッセージを送信する
 * @param {string} message - 送信するメッセージ
 */
export async function notify(message: string): Promise<void> {
  const channelId = config.discord.notifyChannelId;
  if (!channelId) return;

  try {
    const ch = await client.channels.fetch(channelId);
    if (ch instanceof TextChannel) {
      await ch.send(message);
    }
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
}
