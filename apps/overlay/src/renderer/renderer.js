const STORAGE_KEY = "memedrop-settings-v1";

const settingsEl = document.querySelector("#settings");
const popupEl = document.querySelector("#popup");
const form = document.querySelector("#settingsForm");
const serverUrlInput = document.querySelector("#serverUrl");
const clientTokenInput = document.querySelector("#clientToken");
const roomInput = document.querySelector("#room");
const positionInput = document.querySelector("#position");
const popupSizeInput = document.querySelector("#popupSize");
const mutedInput = document.querySelector("#muted");
const videoSoundInput = document.querySelector("#videoSound");
const videoVolumeInput = document.querySelector("#videoVolume");
const videoVolumeValue = document.querySelector("#videoVolumeValue");
const statusDot = document.querySelector("#statusDot");
const statusText = document.querySelector("#statusText");
const popupSender = document.querySelector("#popupSender");
const popupImage = document.querySelector("#popupImage");
const popupVideo = document.querySelector("#popupVideo");
const popupText = document.querySelector("#popupText");
const hideSettingsButton = document.querySelector("#hideSettings");
const testPopupButton = document.querySelector("#testPopup");

let ws;
let reconnectTimer;
let hideTimer;
let heartbeatTimer;

const POPUP_SIZES = {
  small: {
    text: { width: 380, height: 190 },
    media: { width: 400, height: 280 }
  },
  medium: {
    text: { width: 480, height: 210 },
    media: { width: 520, height: 350 }
  },
  large: {
    text: { width: 720, height: 260 },
    media: { width: 720, height: 520 }
  }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function loadSettings() {
  const envDefaults = window.memedrop.defaults || {};
  const defaults = {
    serverUrl: envDefaults.serverUrl || "http://localhost:8787",
    clientToken: envDefaults.clientToken || "dev-client-token",
    room: envDefaults.room || "default",
    position: envDefaults.position || "top-right",
    popupSize: "medium",
    videoSound: true,
    videoVolume: 50,
    muted: false
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const envOverrides = Object.fromEntries(
      Object.entries(envDefaults).filter(([, value]) => value)
    );

    return { ...defaults, ...saved, ...envOverrides };
  } catch {
    return defaults;
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function readSettingsFromForm() {
  return {
    serverUrl: serverUrlInput.value.trim() || "http://localhost:8787",
    clientToken: clientTokenInput.value.trim() || "dev-client-token",
    room: roomInput.value.trim() || "default",
    position: positionInput.value,
    popupSize: popupSizeInput.value,
    videoSound: videoSoundInput.checked,
    videoVolume: clamp(Number(videoVolumeInput.value) || 0, 0, 100),
    muted: mutedInput.checked
  };
}

function fillForm(settings) {
  serverUrlInput.value = settings.serverUrl;
  clientTokenInput.value = settings.clientToken;
  roomInput.value = settings.room;
  positionInput.value = settings.position;
  popupSizeInput.value = settings.popupSize;
  mutedInput.checked = settings.muted;
  videoSoundInput.checked = settings.videoSound;
  videoVolumeInput.value = settings.videoVolume;
  updateVolumeLabel();
}

function updateVolumeLabel() {
  videoVolumeValue.textContent = `${videoVolumeInput.value}%`;
}

function toWebSocketUrl(serverUrl, room, token) {
  const url = new URL(serverUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.searchParams.set("room", room);
  url.searchParams.set("token", token);
  return url.toString();
}

function setStatus(kind, text) {
  statusDot.classList.toggle("connected", kind === "connected");
  statusText.textContent = text;
}

function reconnectSoon() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 1800);
}

function startHeartbeat() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "client_ping",
        createdAt: new Date().toISOString()
      }));
    }
  }, 60000);
}

function connect() {
  const settings = loadSettings();
  clearTimeout(reconnectTimer);

  if (ws) {
    ws.onclose = null;
    ws.close();
  }

  clearInterval(heartbeatTimer);

  let url;
  try {
    url = toWebSocketUrl(settings.serverUrl, settings.room, settings.clientToken);
  } catch {
    setStatus("error", "URL serveur invalide");
    return;
  }

  setStatus("connecting", "Connexion...");
  ws = new WebSocket(url);

  ws.addEventListener("open", () => {
    setStatus("connected", `Connecte a ${settings.room}`);
    startHeartbeat();
  });

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "drop") {
      showDrop(message);
    }
  });

  ws.addEventListener("close", () => {
    clearInterval(heartbeatTimer);
    setStatus("closed", "Deconnecte, reconnexion...");
    reconnectSoon();
  });

  ws.addEventListener("error", () => {
    setStatus("error", "Erreur de connexion");
  });
}

function resetMedia() {
  popupImage.hidden = true;
  popupImage.removeAttribute("src");

  popupVideo.pause();
  popupVideo.muted = true;
  popupVideo.hidden = true;
  popupVideo.removeAttribute("src");
  popupVideo.load();
}

function getPopupBounds(settings, hasMedia) {
  const size = POPUP_SIZES[settings.popupSize] || POPUP_SIZES.medium;
  return hasMedia ? size.media : size.text;
}

function showDrop(drop) {
  const settings = loadSettings();
  if (settings.muted) return;

  clearTimeout(hideTimer);
  resetMedia();
  settingsEl.hidden = true;
  popupEl.hidden = false;
  popupEl.dataset.size = settings.popupSize;

  popupSender.textContent = drop.sender || "Discord";
  popupText.textContent = drop.text || "";
  popupText.hidden = !drop.text;

  if (drop.videoUrl) {
    popupVideo.hidden = false;
    popupVideo.muted = !settings.videoSound;
    popupVideo.volume = clamp(Number(settings.videoVolume) || 0, 0, 100) / 100;
    popupVideo.src = drop.videoUrl;
    popupVideo.currentTime = 0;
    popupVideo.play().catch(() => {});
  } else if (drop.imageUrl) {
    popupImage.hidden = false;
    popupImage.src = drop.imageUrl;
  }

  const bounds = getPopupBounds(settings, Boolean(drop.videoUrl || drop.imageUrl));
  window.memedrop.showPopup({
    width: bounds.width,
    height: bounds.height,
    position: settings.position
  });

  hideTimer = setTimeout(() => {
    resetMedia();
    popupEl.hidden = true;
    window.memedrop.hide();
  }, Number(drop.durationMs || 5000));
}

function showSettings() {
  clearTimeout(hideTimer);
  resetMedia();
  popupEl.hidden = true;
  settingsEl.hidden = false;
  fillForm(loadSettings());
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const settings = readSettingsFromForm();
  saveSettings(settings);
  connect();
});

videoVolumeInput.addEventListener("input", () => {
  updateVolumeLabel();
});

hideSettingsButton.addEventListener("click", () => {
  settingsEl.hidden = true;
  window.memedrop.hide();
});

testPopupButton.addEventListener("click", () => {
  showDrop({
    type: "drop",
    sender: "Memedrop",
    room: readSettingsFromForm().room,
    text: "Popup de test. Si tu vois ca, l'overlay marche.",
    durationMs: 4500
  });
});

window.memedrop.onOpenSettings(() => {
  showSettings();
});

fillForm(loadSettings());
connect();
