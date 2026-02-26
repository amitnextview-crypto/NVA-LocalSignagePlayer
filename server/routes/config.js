const fs = require("fs");
const path = require("path");
const express = require("express");

const router = express.Router();

const CONFIG_DIR = path.join(__dirname, "../data/configs");

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

    if (fs.existsSync(devicePath)) {
      filePath = devicePath;
    } else {
      filePath = path.join(CONFIG_DIR, "default.json");
    }
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
    const defaultPath = path.join(CONFIG_DIR, "default.json");
    fs.writeFileSync(defaultPath, JSON.stringify(config, null, 2));

    if (global.io) {
      global.io.emit("media-updated");
    }
  } else {
    const devicePath = path.join(CONFIG_DIR, `${targetDevice}.json`);
    fs.writeFileSync(devicePath, JSON.stringify(config, null, 2));

    if (global.io && global.connectedDevices?.[targetDevice]) {
      const socketId = global.connectedDevices[targetDevice];
      global.io.to(socketId).emit("media-updated");
    }
  }

  res.json({ success: true });
});

module.exports = router;