import { client, notify } from "../client.js";
import { config } from "../config.js";
import { pg } from "../db.js";
import { collectWeeklyReport } from "../services/weeklyReport.js";

async function ensureDiscordReady(token: string): Promise<void> {
  await client.login(token);
  if (client.isReady()) return;

  await new Promise<void>((resolve, reject) => {
    const readyHandler = () => {
      cleanup();
      resolve();
    };
    const errorHandler = (err: unknown) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      client.off("ready", readyHandler);
      client.off("error", errorHandler);
    };
    client.once("ready", readyHandler);
    client.once("error", errorHandler);
  });
}

async function main() {
  const token = config.discord.token;
  const guildId = config.discord.guildId;
  if (!token) {
    throw new Error("DISCORD_TOKEN is not set");
  }
  if (!guildId) {
    throw new Error("GUILD_ID is not set");
  }
  if (!config.discord.notifyChannelId) {
    throw new Error("NOTIFY_CHANNEL_ID is not set");
  }

  await pg.connect();

  try {
    const { embed } = await collectWeeklyReport(guildId);

    await ensureDiscordReady(token);

    const mode = process.env.WEEKLY_REPORT_NOTIFY_MODE || "channel";
    const testUserId = process.env.WEEKLY_REPORT_TEST_USER_ID;

    if (mode === "ephemeral") {
      if (!testUserId) {
        console.warn(
          "WEEKLY_REPORT_NOTIFY_MODE=ephemeral ですが WEEKLY_REPORT_TEST_USER_ID が未設定のためチャンネル送信にフォールバックします"
        );
      } else {
        const user = await client.users.fetch(testUserId);
        await user.send({ embeds: [embed] });
        return;
      }
    }

    await notify({ embeds: [embed] });
  } finally {
    await pg.end().catch(() => undefined);
    client.destroy();
  }
}

main().catch((err) => {
  console.error("weeklyReport failed:", err);
  process.exitCode = 1;
});
