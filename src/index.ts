import { client } from "./client.js";
import { config } from "./config.js";
import { pg } from "./db.js";
import { onVoiceStateUpdate } from "./handlers/voiceStateUpdate.js";

client.once("ready", async (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  try {
    await pg.connect();
    console.log("Connected to PostgreSQL");
  } catch (err) {
    console.error("Failed to connect to PostgreSQL:", err);
    process.exit(1);
  }
});

client.on("voiceStateUpdate", onVoiceStateUpdate);

async function main() {
  try {
    await client.login(config.discord.token);
  } catch (err) {
    console.error("Failed to login to Discord:", err);
    process.exit(1);
  }
}

main();
