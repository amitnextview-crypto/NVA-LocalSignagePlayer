const fs = require("fs");
const path = require("path");
const express = require("express");

const router = express.Router();

// ⭐ Writable base path
const basePath = process.pkg
  ? path.dirname(process.execPath)
  : path.join(__dirname, "..");

const CONFIG_DIR = path.join(basePath, "data", "configs");

// Ensure folder exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/* ✅ GET CONFIG */
router.get("/", (req, res) => {

  const deviceId = req.query.deviceId;
  let filePath;

  if (deviceId) {
    const devicePath = path.join(CONFIG_DIR, `${deviceId}.json`);
    filePath = fs.existsSync(devicePath)
      ? devicePath
      : path.join(CONFIG_DIR, "default.json");
  } else {
    filePath = path.join(CONFIG_DIR, "default.json");
  }

  const data = fs.readFileSync(filePath, "utf-8");
  res.json(JSON.parse(data));
});

/* ✅ SAVE CONFIG */
router.post("/", (req, res) => {

  const { targetDevice, config } = req.body;

  if (targetDevice === "all") {

    // 🔥 1. Update default config
    const defaultPath = path.join(CONFIG_DIR, "default.json");
    fs.writeFileSync(defaultPath, JSON.stringify(config, null, 2));

    // 🔥 2. Update ALL device-specific config files
    const files = fs.readdirSync(CONFIG_DIR);

    files.forEach(file => {
      if (file !== "default.json" && file.endsWith(".json")) {
        const devicePath = path.join(CONFIG_DIR, file);
        fs.writeFileSync(devicePath, JSON.stringify(config, null, 2));
      }
    });

    // 🔥 3. Notify ALL connected devices
    if (global.io) {
      global.io.emit("media-updated");
    }

  } else {

    // 🔥 Update only selected device
    const devicePath = path.join(CONFIG_DIR, `${targetDevice}.json`);
    fs.writeFileSync(devicePath, JSON.stringify(config, null, 2));

    // 🔥 Notify only that device
    if (global.io && global.connectedDevices?.[targetDevice]) {
      const socketId = global.connectedDevices[targetDevice];
      global.io.to(socketId).emit("media-updated");
    }
  }

  res.json({ success: true });
});

module.exports = router;