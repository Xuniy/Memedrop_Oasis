const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("memedrop", {
  defaults: {
    serverUrl: process.env.MEMEDROP_SERVER_URL || "",
    clientToken: process.env.MEMEDROP_CLIENT_TOKEN || "",
    room: process.env.MEMEDROP_ROOM || "",
    position: process.env.MEMEDROP_POSITION || ""
  },
  showPopup: (payload) => ipcRenderer.send("overlay:show-popup", payload),
  showSettings: () => ipcRenderer.send("overlay:show-settings"),
  hide: () => ipcRenderer.send("overlay:hide"),
  onOpenSettings: (callback) => {
    ipcRenderer.on("overlay:open-settings", callback);
  }
});
