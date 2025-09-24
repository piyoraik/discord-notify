import "dotenv/config";

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    notifyChannelId: process.env.NOTIFY_CHANNEL_ID,
  },
  db: {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || "discordbot",
  },
};
