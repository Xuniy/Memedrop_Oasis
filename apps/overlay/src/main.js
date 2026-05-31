const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } = require("electron");
const path = require("node:path");

let mainWindow;
let tray;

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

function makeTrayIcon() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "..", "build", "icon.png"));
  return icon.resize({ width: 16, height: 16 });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 720,
    minWidth: 360,
    minHeight: 420,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    icon: path.join(__dirname, "..", "build", "icon.ico"),
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.setAlwaysOnTop(true, "screen-saver");

  mainWindow.once("ready-to-show", () => {
    showSettingsWindow();
  });
}

function createTray() {
  tray = new Tray(makeTrayIcon());
  tray.setToolTip("Memedrop Oasis");
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "Open settings",
      click: () => showSettingsWindow()
    },
    {
      label: "Quit",
      click: () => app.quit()
    }
  ]));

  tray.on("click", () => showSettingsWindow());
}

function centerWindow(width, height) {
  const display = screen.getPrimaryDisplay();
  const { x, y, width: workWidth, height: workHeight } = display.workArea;
  const left = Math.round(x + (workWidth - width) / 2);
  const top = Math.round(y + (workHeight - height) / 2);
  mainWindow.setBounds({ x: left, y: top, width, height });
}

function positionPopup(width, height, placement) {
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;
  const margin = 28;
  let x = area.x + area.width - width - margin;
  let y = area.y + margin;

  const centeredX = Math.round(area.x + (area.width - width) / 2);
  const centeredY = Math.round(area.y + (area.height - height) / 2);

  switch (placement) {
    case "top-left":
      x = area.x + margin;
      y = area.y + margin;
      break;
    case "top-center":
      x = centeredX;
      y = area.y + margin;
      break;
    case "center":
      x = centeredX;
      y = centeredY;
      break;
    case "bottom-left":
      x = area.x + margin;
      y = area.y + area.height - height - margin;
      break;
    case "bottom-center":
      x = centeredX;
      y = area.y + area.height - height - margin;
      break;
    case "bottom-right":
      x = area.x + area.width - width - margin;
      y = area.y + area.height - height - margin;
      break;
    default:
      break;
  }

  mainWindow.setBounds({ x, y, width, height });
}

function showSettingsWindow() {
  if (!mainWindow) return;
  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.setFocusable(true);
  centerWindow(560, 720);
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("overlay:open-settings");
}

ipcMain.on("overlay:show-popup", (_event, payload = {}) => {
  if (!mainWindow) return;
  const width = Number(payload.width) || 480;
  const height = Number(payload.height) || 300;
  positionPopup(width, height, payload.position || "top-right");
  mainWindow.setFocusable(false);
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.showInactive();
});

ipcMain.on("overlay:show-settings", () => {
  showSettingsWindow();
});

ipcMain.on("overlay:hide", () => {
  if (!mainWindow) return;
  mainWindow.hide();
});

app.whenReady().then(() => {
  app.setAppUserModelId("app.memedrop.oasis");
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showSettingsWindow();
    }
  });
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});
