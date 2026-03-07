const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const os = require("os");
const { exec } = require("child_process");

// Runtime writable base path (user-local in pkg mode to avoid permission issues)
const runtimeBasePath = process.pkg
  ? path.join(
      process.env.LOCALAPPDATA ||
        process.env.APPDATA ||
        path.dirname(process.execPath),
      "NVA SignagePlayerTV"
    )
  : __dirname;

// Asset base path (__dirname points to snapshot when packed by pkg)
const assetBasePath = __dirname;

global.runtimeBasePath = runtimeBasePath;
global.assetBasePath = assetBasePath;

if (!fs.existsSync(runtimeBasePath)) {
  fs.mkdirSync(runtimeBasePath, { recursive: true });
}

const configRoutes = require("./routes/config");
const uploadRoutes = require("./routes/upload");
const mediaRoutes = require("./routes/media");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/media-list", mediaRoutes);
app.use("/upload", uploadRoutes);
app.use("/config", configRoutes);
app.use("/", express.static(path.join(assetBasePath, "public")));
app.use(
  "/media",
  express.static(path.join(runtimeBasePath, "uploads"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".mp4")) {
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Accept-Ranges", "bytes");
        // Avoid long-lived device cache growth for large media.
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Surrogate-Control", "no-store");
      }

      if (filePath.match(/\.(jpg|jpeg|png|pdf|txt)$/i)) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Surrogate-Control", "no-store");
      }
    },
  })
);

// Socket server
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

global.io = io;

// Connected devices + health state
const connectedDevices = {};
const deviceStatus = {};
const socketToDevice = {};
global.connectedDevices = connectedDevices;
global.deviceStatus = deviceStatus;

function nowIso() {
  return new Date().toISOString();
}

function upsertDeviceStatus(deviceId, patch = {}) {
  if (!deviceId) return;
  const prev = deviceStatus[deviceId] || {
    deviceId,
    online: false,
    lastSeen: null,
    lastError: null,
    lastErrorAt: null,
    lastDisconnectReason: null,
    lastDisconnectAt: null,
    appState: null,
    meta: null,
  };

  deviceStatus[deviceId] = {
    ...prev,
    ...patch,
    deviceId,
    lastSeen: nowIso(),
  };
}

io.on("connection", (socket) => {
  socket.on("register-device", (deviceId) => {
    connectedDevices[deviceId] = socket.id;
    socketToDevice[socket.id] = deviceId;
    upsertDeviceStatus(deviceId, {
      online: true,
      lastDisconnectReason: null,
      lastDisconnectAt: null,
      lastError: null,
      lastErrorAt: null,
      errorType: null,
    });
    console.log("Device connected:", deviceId);
  });

  socket.on("device-health", (payload) => {
    const deviceId = String(payload?.deviceId || socketToDevice[socket.id] || "").trim();
    if (!deviceId) return;
    upsertDeviceStatus(deviceId, {
      online: true,
      appState: payload?.appState || null,
      meta: payload?.meta || null,
      lastError: null,
      lastErrorAt: null,
      errorType: null,
    });
  });

  socket.on("device-error", (payload) => {
    const deviceId = String(payload?.deviceId || socketToDevice[socket.id] || "").trim();
    if (!deviceId) return;
    upsertDeviceStatus(deviceId, {
      online: true,
      lastError: payload?.message || payload?.error || "Unknown device error",
      lastErrorAt: nowIso(),
      errorType: payload?.type || "runtime",
    });
  });

  socket.on("disconnect", (reason) => {
    for (const id of Object.keys(connectedDevices)) {
      if (connectedDevices[id] === socket.id) {
        delete connectedDevices[id];
        upsertDeviceStatus(id, {
          online: false,
          lastDisconnectReason: String(reason || "disconnect"),
          lastDisconnectAt: nowIso(),
        });
        console.log("Device disconnected:", id);
      }
    }

    if (socketToDevice[socket.id]) {
      delete socketToDevice[socket.id];
    }
  });
});

// Connected device IDs
app.get("/devices", (req, res) => {
  res.json(Object.keys(connectedDevices));
});

// Live health/error status for CMS
app.get("/device-status", (req, res) => {
  const list = Object.values(deviceStatus)
    .map((item) => ({
      ...item,
      online: !!connectedDevices[item.deviceId],
    }))
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? 1 : -1;
      const aTs = Date.parse(a.lastErrorAt || a.lastSeen || 0);
      const bTs = Date.parse(b.lastErrorAt || b.lastSeen || 0);
      return bTs - aTs;
    });

  res.json(list);
});

// Get active local IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family !== "IPv4") continue;
      if (iface.internal) continue;
      if (iface.address.startsWith("169.")) continue;

      return iface.address;
    }
  }

  return "localhost";
}

// Start server
const PORT = 8080;

server.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    console.log(`Port ${PORT} already in use. Opening existing CMS session.`);
    exec(`start http://localhost:${PORT}`);
    process.exit(0);
    return;
  }

  console.error("Server startup failed:", err);
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  const ip = getLocalIP();
  const url = `http://${ip}:${PORT}`;

  console.log(`CMS running on ${url}`);

  exec(`start ${url}`);
});
