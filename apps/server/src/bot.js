import { Client, Events, GatewayIntentBits } from "discord.js";
import { config, warnAboutDevSecrets } from "./config.js";

const IMAGE_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif"
]);

const MAX_VIDEO_BYTES = 10 * 1024 * 1024;

function assertBotConfig() {
  if (!config.discordToken) {
    throw new Error("DISCORD_TOKEN is required.");
  }
}

function isAllowedInteraction(interaction) {
  if (config.allowedGuildId && interaction.guildId !== config.allowedGuildId) {
    return false;
  }

  if (config.allowedChannelIds.length > 0 && !config.allowedChannelIds.includes(interaction.channelId)) {
    return false;
  }

  return true;
}

function getSenderName(interaction) {
  return interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
}

function attachmentLooksLikeMp4(attachment) {
  const name = attachment.name?.toLowerCase() || "";
  const contentType = attachment.contentType?.toLowerCase() || "";

  return name.endsWith(".mp4") || contentType === "video/mp4" || contentType.startsWith("video/mp4;");
}

async function sendDropToRelay(drop) {
  const response = await fetch(`${config.relayUrl}/api/drop`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${config.botApiToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(drop)
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || `Relay returned ${response.status}`);
  }

  return body;
}

assertBotConfig();
warnAboutDevSecrets();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`[memedrop] bot logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "drop") {
    return;
  }

  if (!isAllowedInteraction(interaction)) {
    await interaction.reply({
      content: "Ce salon ou ce serveur n'est pas autorise pour Memedrop.",
      ephemeral: true
    });
    return;
  }

  const text = interaction.options.getString("text")?.trim() || "";
  let image = interaction.options.getAttachment("image");
  let video = interaction.options.getAttachment("video");
  const room = interaction.options.getString("room")?.trim() || config.defaultRoom;
  const durationSeconds = interaction.options.getInteger("duration") || 5;

  if (image && !video && attachmentLooksLikeMp4(image)) {
    video = image;
    image = null;
  }

  if (!text && !image && !video) {
    await interaction.reply({
      content: "Ajoute au moins un texte, une image ou une video MP4.",
      ephemeral: true
    });
    return;
  }

  if (image && video) {
    await interaction.reply({
      content: "Choisis soit une image, soit une video MP4, pas les deux dans le meme drop.",
      ephemeral: true
    });
    return;
  }

  if (image && image.contentType && !IMAGE_CONTENT_TYPES.has(image.contentType)) {
    await interaction.reply({
      content: "Image non supportee. Utilise PNG, JPG, WEBP ou GIF.",
      ephemeral: true
    });
    return;
  }

  if (video) {
    console.log(
      `[drop] video attachment name="${video.name}" type="${video.contentType || "unknown"}" size=${video.size}`
    );

    if (!attachmentLooksLikeMp4(video)) {
      await interaction.reply({
        content: "Video non supportee. Utilise un fichier MP4.",
        ephemeral: true
      });
      return;
    }

    if (video.size > MAX_VIDEO_BYTES) {
      await interaction.reply({
        content: "Video trop lourde pour le MVP. Limite actuelle: 10 MB.",
        ephemeral: true
      });
      return;
    }
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await sendDropToRelay({
      text,
      imageUrl: image?.url || "",
      videoUrl: video?.url || "",
      room,
      durationMs: durationSeconds * 1000,
      sender: getSenderName(interaction),
      guildName: interaction.guild?.name || "",
      channelName: interaction.channel?.name || ""
    });

    await interaction.editReply(`Envoye a ${result.recipients} app(s) connectee(s).`);
  } catch (error) {
    console.error("[drop] failed", error);
    await interaction.editReply(`Impossible d'envoyer le drop: ${error.message}`);
  }
});

client.login(config.discordToken).catch((error) => {
  console.error("[memedrop] Discord login failed. Check DISCORD_TOKEN in your environment variables.");
  console.error(error);
  process.exit(1);
});
