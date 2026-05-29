import "dotenv/config";

function numberFromEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number.`);
  }

  return parsed;
}

function listFromEnv(name) {
  return (process.env[name] || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const port = numberFromEnv("PORT", 8787);
const defaultRelayUrl = process.env.RENDER
  ? `http://127.0.0.1:${port}`
  : "http://localhost:8787";

export const config = {
  port,
  host: process.env.HOST || "0.0.0.0",
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "http://localhost:8787",
  botApiToken: process.env.BOT_API_TOKEN || "dev-bot-token",
  clientToken: process.env.CLIENT_TOKEN || "dev-client-token",
  defaultRoom: process.env.DEFAULT_ROOM || "default",
  discordToken: process.env.DISCORD_TOKEN || "",
  discordClientId: process.env.DISCORD_CLIENT_ID || "",
  discordGuildId: process.env.DISCORD_GUILD_ID || "",
  allowedGuildId: process.env.ALLOWED_GUILD_ID || "",
  allowedChannelIds: listFromEnv("ALLOWED_CHANNEL_IDS"),
  relayUrl: process.env.RELAY_URL || defaultRelayUrl
};

export function warnAboutDevSecrets() {
  if (config.botApiToken === "dev-bot-token" || config.clientToken === "dev-client-token") {
    console.warn("[memedrop] Using dev tokens. Change BOT_API_TOKEN and CLIENT_TOKEN before sharing this with friends.");
  }
}
