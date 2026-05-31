import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "./config.js";

if (!config.discordToken) {
  throw new Error("DISCORD_TOKEN is required.");
}

if (!config.discordClientId) {
  throw new Error("DISCORD_CLIENT_ID is required.");
}

const commands = [
  new SlashCommandBuilder()
    .setName("drop")
    .setDescription("Affiche un meme ou un texte sur les overlays Memedrop connectes.")
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("Texte a afficher.")
        .setMaxLength(500)
        .setRequired(false)
    )
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("Image PNG, JPG, WEBP ou GIF a afficher.")
        .setRequired(false)
    )
    .addAttachmentOption((option) =>
      option
        .setName("video")
        .setDescription("Video MP4 a afficher. Limite MVP: 10 MB.")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("duration")
        .setDescription("Duree en secondes. Texte/image: max 15. Video: 30 a 60.")
        .setMinValue(2)
        .setMaxValue(60)
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("room")
        .setDescription("Room cible. Garde default si tu n'es pas sur.")
        .setMaxLength(64)
        .setRequired(false)
    )
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(config.discordToken);

const route = config.discordGuildId
  ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
  : Routes.applicationCommands(config.discordClientId);

console.log(
  config.discordGuildId
    ? `[memedrop] Registering guild commands for ${config.discordGuildId}...`
    : "[memedrop] Registering global commands..."
);

await rest.put(route, { body: commands });

console.log("[memedrop] Commands registered.");
