import {
  Client,
  GatewayIntentBits,
  MessageCreateOptions,
  TextChannel,
} from "discord.js";
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
 * 指定されたチャンネルに通知メッセージを送信する。
 * 文字列でも `MessageCreateOptions` でも送信可能。
 */
export async function notify(message: string | MessageCreateOptions): Promise<void> {
  const channelId = config.discord.notifyChannelId;
  if (!channelId) return;

  try {
    const ch = await client.channels.fetch(channelId);
    if (ch instanceof TextChannel) {
      const payload = typeof message === "string" ? { content: message } : message;
      await ch.send(payload);
    }
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
}
