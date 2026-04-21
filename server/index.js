const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const os = require("os");
const { exec } = require("child_process");
const {
  ensureProfile,
  renameDevice,
  createGroup,
  updateGroup,
  deleteGroup,
  listGroups,
  listDevicesWithProfiles,
  getGroupsForDevice,
  sanitizeDeviceId,
} = require("./services/deviceRegistry");
const { ensureYtDlpBinary, findYtDlpBinary } = require("./utils/ytDlp");

// Runtime writable base path (user-local in pkg mode to avoid permission issues)
const runtimeBasePath = process.pkg
  ? path.join(
      process.env.LOCALAPPDATA ||
        process.env.APPDATA ||
        path.dirname(process.execPath),
      "NVAPlayerPC"
    )
  : __dirname;

// Asset base path (__dirname points to snapshot when packed by pkg)
const assetBasePath = __dirname;

global.runtimeBasePath = runtimeBasePath;
global.assetBasePath = assetBasePath;

if (!fs.existsSync(runtimeBasePath)) {
  fs.mkdirSync(runtimeBasePath, { recursive: true });
}

ensureYtDlpBinary()
  .then((binaryPath) => {
    if (binaryPath) {
      console.log(`yt-dlp ready: ${binaryPath}`);
    }
  })
  .catch((error) => {
    const existing = findYtDlpBinary();
    if (existing) {
      console.log(`yt-dlp ready: ${existing}`);
      return;
    }
    console.log(
      "yt-dlp bootstrap skipped:",
      String(error?.message || error || "unknown")
    );
  });

const configRoutes = require("./routes/config");
const uploadRoutes = require("./routes/upload");
const mediaRoutes = require("./routes/media");

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: false, limit: "25mb" }));

const CMS_PASSWORD = String(process.env.CMS_PASSWORD || "0408");
const CMS_API_KEY = String(process.env.CMS_API_KEY || "");
const CMS_AUTH_COOKIE = "cms_auth";

function parseCookies(req) {
  const header = String(req.headers?.cookie || "");
  if (!header) return {};
  return header.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("=") || "");
    return acc;
  }, {});
}

function isCmsAuthed(req) {
  const cookies = parseCookies(req);
  return cookies[CMS_AUTH_COOKIE] === "1";
}

function wantsHtml(req) {
  const accept = String(req.headers?.accept || "");
  return accept.includes("text/html");
}

function isApiAuthed(req) {
  if (isCmsAuthed(req)) return true;
  const headerPwd = String(req.headers?.["x-cms-password"] || "").trim();
  if (headerPwd && headerPwd === CMS_PASSWORD) return true;
  if (CMS_API_KEY) {
    const headerKey = String(req.headers?.["x-api-key"] || "").trim();
    const queryKey = String(req.query?.apiKey || "").trim();
    if (headerKey && headerKey === CMS_API_KEY) return true;
    if (queryKey && queryKey === CMS_API_KEY) return true;
  }
  return false;
}

function requireCmsAuth(req, res, next) {
  if (isApiAuthed(req)) return next();
  if (wantsHtml(req)) return res.redirect("/lock");
  return res.status(401).json({ ok: false, error: "unauthorized" });
}

app.get("/lock", (req, res) => {
  if (isCmsAuthed(req)) {
    return res.redirect("/");
  }
  const message = String(req.query?.error || "");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.status(200).send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CMS Locked</title>
    <style>
      :root {
        --bg: #0c0f14;
        --panel: #141a23;
        --panel-2: #0f141c;
        --border: #253041;
        --text: #e8edf5;
        --muted: #9aa6b2;
        --accent: #5ad2a4;
        --accent-2: #2ea0ff;
        --danger: #ff7b7b;
      }
      * { box-sizing: border-box; }
      body {
        margin:0;
        font-family: "Space Grotesk", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        background:
          radial-gradient(1200px 800px at 10% 10%, rgba(90,210,164,.18), transparent 60%),
          radial-gradient(900px 600px at 90% 20%, rgba(46,160,255,.18), transparent 55%),
          var(--bg);
        color: var(--text);
      }
      .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:28px; }
      .card {
        width:100%; max-width:520px;
        background: linear-gradient(180deg, rgba(20,26,35,.95), rgba(14,19,27,.96));
        border:1px solid var(--border);
        border-radius:16px;
        padding:28px;
        box-shadow: 0 24px 80px rgba(0,0,0,.45);
        position: relative;
        overflow: hidden;
      }
      .card::after {
        content:"";
        position:absolute;
        inset:-40% -20% auto auto;
        width:260px; height:260px;
        background: radial-gradient(circle, rgba(90,210,164,.25), transparent 70%);
        pointer-events:none;
      }
      .brand {
        display:flex; align-items:center; gap:12px; margin-bottom:14px;
      }
      .dot {
        width:10px; height:10px; border-radius:50%;
        background: var(--accent);
        box-shadow: 0 0 12px rgba(90,210,164,.8);
      }
      h1 { margin:0; font-size:24px; letter-spacing:.2px; }
      p { margin:6px 0 20px 0; color:var(--muted); font-size:14px; }
      .field {
        display:flex; align-items:center; gap:10px;
        background: var(--panel-2);
        border:1px solid var(--border);
        padding:10px 12px;
        border-radius:12px;
      }
      input {
        width:100%;
        background: transparent;
        border:none;
        color:var(--text);
        font-size:16px;
        outline:none;
      }
      button {
        margin-top:16px; width:100%;
        padding:12px 14px;
        border-radius:12px; border:none;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        color:#091017; font-weight:700; font-size:16px;
        cursor:pointer;
      }
      .error { margin-top:12px; color:var(--danger); font-size:14px; }
      .footer { margin-top:18px; color:#6e7a88; font-size:12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="brand"><span class="dot"></span><strong>NVAPlayerPC</strong></div>
        <h1>Access Locked</h1>
        <p>Enter the NVAPlayerPC password to continue.</p>
        <form method="POST" action="/lock">
          <div class="field">
            <input type="password" name="password" placeholder="Password" autofocus />
          </div>
          <button type="submit">Unlock</button>
        </form>
        ${message ? `<div class="error">${message}</div>` : ""}
        <div class="footer">Unauthorized access is not permitted.</div>
      </div>
    </div>
  </body>
</html>`);
});

app.post("/lock", (req, res) => {
  const value = String(req.body?.password || "").trim();
  if (value && value === CMS_PASSWORD) {
    res.setHeader(
      "Set-Cookie",
      `${CMS_AUTH_COOKIE}=1; Path=/; HttpOnly; SameSite=Strict`
    );
    try {
      const indexPath = path.join(assetBasePath, "public", "index.html");
      const html = fs.readFileSync(indexPath, "utf8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.status(200).send(html);
    } catch {
      return res.redirect("/");
    }
  }
  return res.redirect("/lock?error=Wrong%20password");
});

app.use((req, res, next) => {
  if (req.path.startsWith("/lock")) return next();
  if (req.method === "GET" && wantsHtml(req)) {
    return res.redirect("/lock");
  }
  return next();
});

app.use("/media-list", mediaRoutes);
app.use("/upload", requireCmsAuth, uploadRoutes);
app.use("/config", (req, res, next) => {
  if (req.method === "GET") return next();
  return requireCmsAuth(req, res, next);
}, configRoutes);
app.get("/ping", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.json({ ok: true, time: Date.now(), ips: getLocalIPs(), port: PORT });
});
app.use(
  "/",
  express.static(path.join(assetBasePath, "public"), {
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");
    },
  })
);
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

      if (filePath.endsWith(".mov")) {
        res.setHeader("Content-Type", "video/mov");
        res.setHeader("Accept-Ranges", "bytes");
        // Avoid long-lived device cache growth for large media.
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Surrogate-Control", "no-store");
      }

      if (filePath.endsWith(".webm")) {
        res.setHeader("Content-Type", "video/webm");
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
const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["polling", "websocket"],
  pingInterval: 10000,
  pingTimeout: 30000,
});

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

function getLiveDeviceIds() {
  const ids = new Set(Object.keys(connectedDevices || {}).filter(Boolean));
  Object.values(deviceStatus || {}).forEach((item) => {
    const deviceId = String(item?.deviceId || "").trim();
    if (deviceId && item?.online) {
      ids.add(deviceId);
    }
  });
  return ids;
}

function upsertDeviceStatus(deviceId, patch = {}) {
  if (!deviceId) return;
  const groups = getGroupsForDevice(deviceId);
  const prev = deviceStatus[deviceId] || {
    deviceId,
    customName: "",
    displayName: deviceId,
    groups: [],
    online: false,
    lastSeen: null,
    lastError: null,
    lastErrorAt: null,
    lastDisconnectReason: null,
    lastDisconnectAt: null,
    appState: null,
    meta: null,
    recentEvents: [],
  };

  deviceStatus[deviceId] = {
    ...prev,
    ...patch,
    deviceId,
    customName: String(patch?.customName ?? prev.customName ?? "").trim(),
    displayName: String(
      patch?.displayName || patch?.customName || prev.customName || deviceId
    ).trim(),
    groups,
    lastSeen: nowIso(),
  };
}

function appendDeviceEvent(deviceId, type, message) {
  if (!deviceId) return;
  const prev = deviceStatus[deviceId] || { recentEvents: [] };
  const nextEvents = [
    ...(Array.isArray(prev.recentEvents) ? prev.recentEvents : []),
    {
      time: nowIso(),
      type: String(type || "runtime"),
      message: String(message || "").slice(0, 240),
    },
  ].slice(-20);
  upsertDeviceStatus(deviceId, { recentEvents: nextEvents });
}

io.on("connection", (socket) => {
  socket.on("register-device", (deviceId) => {
    const safeDeviceId = sanitizeDeviceId(deviceId);
    if (!safeDeviceId) return;
    const profile = ensureProfile(safeDeviceId) || { customName: "" };
    connectedDevices[safeDeviceId] = socket.id;
    socketToDevice[socket.id] = safeDeviceId;
    upsertDeviceStatus(safeDeviceId, {
      online: true,
      customName: profile.customName || "",
      displayName: profile.customName || safeDeviceId,
      lastDisconnectReason: null,
      lastDisconnectAt: null,
      lastError: null,
      lastErrorAt: null,
      errorType: null,
    });
    appendDeviceEvent(safeDeviceId, "socket", "Device connected");
    console.log("Device connected:", safeDeviceId);
  });

  socket.on("device-health", (payload) => {
    const deviceId = String(payload?.deviceId || socketToDevice[socket.id] || "").trim();
    if (!deviceId) return;
    const profile = ensureProfile(deviceId) || { customName: "" };
    connectedDevices[deviceId] = socket.id;
    socketToDevice[socket.id] = deviceId;
    upsertDeviceStatus(deviceId, {
      online: true,
      customName: profile.customName || "",
      displayName: profile.customName || deviceId,
      appState: payload?.appState || null,
      meta: payload?.meta || null,
      lastError: null,
      lastErrorAt: null,
      errorType: null,
    });
    if (payload?.appState) {
      appendDeviceEvent(deviceId, "health", `State: ${String(payload.appState)}`);
    }
  });

  socket.on("device-error", (payload) => {
    const deviceId = String(payload?.deviceId || socketToDevice[socket.id] || "").trim();
    if (!deviceId) return;
    const profile = ensureProfile(deviceId) || { customName: "" };
    connectedDevices[deviceId] = socket.id;
    socketToDevice[socket.id] = deviceId;
    upsertDeviceStatus(deviceId, {
      online: true,
      customName: profile.customName || "",
      displayName: profile.customName || deviceId,
      lastError: payload?.message || payload?.error || "Unknown device error",
      lastErrorAt: nowIso(),
      errorType: payload?.type || "runtime",
    });
    appendDeviceEvent(
      deviceId,
      payload?.type || "runtime",
      payload?.message || payload?.error || "Unknown device error"
    );
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
        appendDeviceEvent(id, "socket", `Disconnected: ${String(reason || "disconnect")}`);
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
  if (!isApiAuthed(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const liveDeviceIds = getLiveDeviceIds();
  const devices = listDevicesWithProfiles(deviceStatus, connectedDevices).filter(
    (item) => liveDeviceIds.has(item.deviceId)
  );
  const groups = listGroups()
    .map((group) => ({
      ...group,
      deviceIds: (Array.isArray(group.deviceIds) ? group.deviceIds : []).filter((deviceId) =>
        liveDeviceIds.has(deviceId)
      ),
    }));
  res.json({
    devices,
    groups,
  });
});

// Live health/error status for CMS
app.get("/device-status", (req, res) => {
  if (!isApiAuthed(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const liveDeviceIds = getLiveDeviceIds();
  const devices = listDevicesWithProfiles(deviceStatus, connectedDevices).filter(
    (item) => liveDeviceIds.has(item.deviceId)
  );
  const statusMap = new Map(Object.values(deviceStatus).map((item) => [item.deviceId, item]));
  const list = devices
    .map((profile) => {
      const item = statusMap.get(profile.deviceId) || {
        deviceId: profile.deviceId,
        lastSeen: null,
        lastError: null,
        lastErrorAt: null,
        lastDisconnectReason: null,
        lastDisconnectAt: null,
        appState: null,
        meta: null,
        recentEvents: [],
      };
      return {
        ...item,
        customName: profile.customName || "",
        displayName: profile.displayName || item.deviceId,
        groups: profile.groupNames || [],
        groupIds: profile.groupIds || [],
        online: !!connectedDevices[profile.deviceId],
      };
    })
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      const aTs = Date.parse(a.lastErrorAt || a.lastSeen || 0);
      const bTs = Date.parse(b.lastErrorAt || b.lastSeen || 0);
      return bTs - aTs;
    });

  res.json(list);
});

app.post("/devices/:deviceId/rename", requireCmsAuth, (req, res) => {
  const deviceId = sanitizeDeviceId(req.params?.deviceId);
  if (!deviceId) {
    return res.status(400).json({ ok: false, error: "invalid-device-id" });
  }
  const updated = renameDevice(deviceId, req.body?.customName || "");
  if (!updated) {
    return res.status(400).json({ ok: false, error: "rename-failed" });
  }
  upsertDeviceStatus(deviceId, {
    customName: updated.customName || "",
    displayName: updated.customName || deviceId,
  });
  return res.json({ ok: true, profile: updated });
});

app.post("/device-groups", requireCmsAuth, (req, res) => {
  const group = createGroup(req.body?.name || "");
  return res.json({ ok: true, group });
});

app.put("/device-groups/:groupId", requireCmsAuth, (req, res) => {
  const group = updateGroup(req.params?.groupId, {
    name: req.body?.name || "",
    deviceIds: Array.isArray(req.body?.deviceIds) ? req.body.deviceIds : [],
  });
  if (!group) {
    return res.status(404).json({ ok: false, error: "group-not-found" });
  }
  for (const deviceId of Object.keys(deviceStatus)) {
    const status = deviceStatus[deviceId];
    upsertDeviceStatus(deviceId, {
      customName: status?.customName || "",
      displayName: status?.displayName || deviceId,
    });
  }
  return res.json({ ok: true, group });
});

app.delete("/device-groups/:groupId", requireCmsAuth, (req, res) => {
  const ok = deleteGroup(req.params?.groupId);
  if (!ok) {
    return res.status(404).json({ ok: false, error: "group-not-found" });
  }
  Object.keys(deviceStatus).forEach((deviceId) => {
    const status = deviceStatus[deviceId];
    upsertDeviceStatus(deviceId, {
      customName: status?.customName || "",
      displayName: status?.displayName || deviceId,
    });
  });
  return res.json({ ok: true });
});

// Get active local IP
function getLocalIP() {
  const ips = getLocalIPs();
  return ips[0] || "localhost";
}

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family !== "IPv4") continue;
      if (iface.internal) continue;
      if (iface.address.startsWith("169.")) continue;
      addresses.push(iface.address);
    }
  }

  return addresses;
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
  const ips = getLocalIPs();
  const ip = getLocalIP();
  const url = `http://${ip}:${PORT}`;

  console.log(`CMS running on ${url}`);
  if (ips.length > 1) {
    console.log(`Additional LAN IPs: ${ips.map((item) => `http://${item}:${PORT}`).join(", ")}`);
  }

  exec(`start ${url}`);
});
