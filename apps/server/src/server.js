import http from "node:http";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { config, warnAboutDevSecrets } from "./config.js";
import { createDrop, normalizeRoom } from "./drop.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const clientsByRoom = new Map();

app.use(express.json({ limit: "1mb" }));

function requireBotToken(req, res, next) {
  const expected = `Bearer ${config.botApiToken}`;
  if (req.get("authorization") !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

function getRoomClients(room) {
  const normalized = normalizeRoom(room);
  if (!clientsByRoom.has(normalized)) {
    clientsByRoom.set(normalized, new Set());
  }

  return clientsByRoom.get(normalized);
}

function broadcastDrop(drop) {
  const clients = getRoomClients(drop.room);
  const message = JSON.stringify(drop);
  let sent = 0;

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sent += 1;
    }
  }

  return sent;
}

app.get("/", (_req, res) => {
  res.type("text/plain").send("Memedrop relay is running.");
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    rooms: [...clientsByRoom.entries()].map(([room, clients]) => ({
      room,
      clients: clients.size
    }))
  });
});

app.post("/api/drop", requireBotToken, (req, res) => {
  try {
    const drop = createDrop(req.body || {});
    const recipients = broadcastDrop(drop);
    res.status(202).json({ ok: true, recipients, drop });
    console.log(`[drop] ${drop.room} -> ${recipients} client(s) from ${drop.sender}`);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname !== "/ws") {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  if (url.searchParams.get("token") !== config.clientToken) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    const room = normalizeRoom(url.searchParams.get("room"));
    wss.emit("connection", ws, req, room);
  });
});

wss.on("connection", (ws, _req, room) => {
  const clients = getRoomClients(room);
  clients.add(ws);
  ws.isAlive = true;

  ws.send(JSON.stringify({
    type: "ready",
    room,
    createdAt: new Date().toISOString()
  }));

  console.log(`[ws] client connected to room "${room}" (${clients.size} total)`);

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (rawMessage) => {
    ws.isAlive = true;

    try {
      const message = JSON.parse(rawMessage.toString());
      if (message.type === "client_ping") {
        ws.send(JSON.stringify({
          type: "server_pong",
          createdAt: new Date().toISOString()
        }));
      }
    } catch {
      // Ignore malformed client keepalive messages.
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`[ws] client disconnected from room "${room}" (${clients.size} left)`);
  });
});

setInterval(() => {
  for (const clients of clientsByRoom.values()) {
    for (const client of clients) {
      if (!client.isAlive) {
        client.terminate();
        clients.delete(client);
        continue;
      }

      client.isAlive = false;
      client.ping();
    }
  }
}, 30000).unref();

server.listen(config.port, config.host, () => {
  warnAboutDevSecrets();
  console.log(`[memedrop] relay listening on http://${config.host}:${config.port}`);
});
