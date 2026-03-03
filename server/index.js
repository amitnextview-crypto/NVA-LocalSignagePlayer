const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const os = require("os");
const { exec } = require("child_process");

const configRoutes = require("./routes/config");
const uploadRoutes = require("./routes/upload");
const mediaRoutes = require("./routes/media");

const app = express();

app.use(cors());
app.use(express.json());

// ⭐ Writable base path
const basePath = process.pkg
  ? path.dirname(process.execPath)
  : __dirname;

app.use("/media-list", mediaRoutes);
app.use("/upload", uploadRoutes);
app.use("/config", configRoutes);
app.use("/", express.static(path.join(basePath, "public")));
app.use("/media", express.static(path.join(basePath, "uploads"), {
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
  }
}));

/* ⭐ SOCKET SERVER */
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

global.io = io;

/* ⭐ STORE CONNECTED DEVICES */
const connectedDevices = {};
global.connectedDevices = connectedDevices;

io.on("connection", (socket) => {

  socket.on("register-device", (deviceId) => {
    connectedDevices[deviceId] = socket.id;
    console.log("Device connected:", deviceId);
  });

  socket.on("disconnect", () => {
    for (let id in connectedDevices) {
      if (connectedDevices[id] === socket.id) {
        delete connectedDevices[id];
        console.log("Device disconnected:", id);
      }
    }
  });

});

/* ⭐ GET CONNECTED DEVICES */
app.get("/devices", (req, res) => {
  res.json(Object.keys(connectedDevices));
});

/* ⭐ Get Active Internet IP (Accurate Method) */
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

/* ⭐ START SERVER */
const PORT = 8080;

server.listen(PORT, "0.0.0.0", () => {

  const ip = getLocalIP();
  const url = `http://${ip}:${PORT}`;

  console.log(`CMS running on ${url}`);

  exec(`start ${url}`);
});
