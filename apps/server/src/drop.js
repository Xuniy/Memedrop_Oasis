import { randomUUID } from "node:crypto";
import { config } from "./config.js";

const MAX_TEXT_LENGTH = 500;
const MIN_DURATION_MS = 1500;
const MAX_DURATION_MS = 15000;
const DEFAULT_DURATION_MS = 5000;
const VIDEO_MIN_DURATION_MS = 30000;
const VIDEO_MAX_DURATION_MS = 60000;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function cleanString(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isHttpUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeRoom(room) {
  const cleaned = cleanString(room, 64)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

  return cleaned || config.defaultRoom;
}

export function createDrop(payload) {
  const text = cleanString(payload.text, MAX_TEXT_LENGTH);
  const imageUrl = cleanString(payload.imageUrl, 2048);
  const videoUrl = cleanString(payload.videoUrl, 2048);
  const sender = cleanString(payload.sender, 80) || "Discord";
  const guildName = cleanString(payload.guildName, 120);
  const channelName = cleanString(payload.channelName, 120);
  const room = normalizeRoom(payload.room);
  const rawDuration = Number(payload.durationMs || (videoUrl ? VIDEO_MIN_DURATION_MS : DEFAULT_DURATION_MS));
  const requestedDuration = Number.isFinite(rawDuration)
    ? rawDuration
    : (videoUrl ? VIDEO_MIN_DURATION_MS : DEFAULT_DURATION_MS);
  const durationMs = videoUrl
    ? clamp(requestedDuration, VIDEO_MIN_DURATION_MS, VIDEO_MAX_DURATION_MS)
    : clamp(requestedDuration, MIN_DURATION_MS, MAX_DURATION_MS);

  if (!text && !imageUrl && !videoUrl) {
    throw new Error("Drop must include text, imageUrl, or videoUrl.");
  }

  if (imageUrl && !isHttpUrl(imageUrl)) {
    throw new Error("imageUrl must be an http(s) URL.");
  }

  if (videoUrl && !isHttpUrl(videoUrl)) {
    throw new Error("videoUrl must be an http(s) URL.");
  }

  return {
    id: randomUUID(),
    type: "drop",
    room,
    text,
    imageUrl,
    videoUrl,
    sender,
    guildName,
    channelName,
    durationMs,
    createdAt: new Date().toISOString()
  };
}
