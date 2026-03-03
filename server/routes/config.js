const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");

const router = express.Router();

const basePath = process.pkg
  ? path.dirname(process.execPath)
  : path.join(__dirname, "..");

const CONFIG_DIR = path.join(basePath, "data", "configs");
const FALLBACK_DIR = path.join(basePath, "uploads", "fallbacks");

if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}
if (!fs.existsSync(FALLBACK_DIR)) {
  fs.mkdirSync(FALLBACK_DIR, { recursive: true });
}

const fallbackUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, FALLBACK_DIR),
    filename: (req, file, cb) => {
      const target = String(req.body?.targetDevice || "all")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 80);
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = [".jpg", ".jpeg", ".png", ".mp4", ".mkv", ".webm"].includes(ext)
        ? ext
        : ".jpg";
      cb(null, `schedule-fallback-${target}${safeExt}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".mp4", ".mkv", ".webm"].includes(ext)) {
      return cb(new Error("Only JPG/PNG/MP4/MKV/WEBM files are allowed"));
    }
    cb(null, true);
  },
});

router.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

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

router.post("/", (req, res) => {
  const { targetDevice, config } = req.body;

  if (targetDevice === "all") {
    const defaultPath = path.join(CONFIG_DIR, "default.json");
    fs.writeFileSync(defaultPath, JSON.stringify(config, null, 2));

    const files = fs.readdirSync(CONFIG_DIR);
    files.forEach((file) => {
      if (file !== "default.json" && file.endsWith(".json")) {
        const devicePath = path.join(CONFIG_DIR, file);
        fs.writeFileSync(devicePath, JSON.stringify(config, null, 2));
      }
    });

    if (global.io) {
      global.io.emit("config-updated");
    }
  } else {
    const devicePath = path.join(CONFIG_DIR, `${targetDevice}.json`);
    fs.writeFileSync(devicePath, JSON.stringify(config, null, 2));

    if (global.io && global.connectedDevices?.[targetDevice]) {
      const socketId = global.connectedDevices[targetDevice];
      global.io.to(socketId).emit("config-updated");
    }
  }

  res.json({ success: true });
});

router.post("/clear-device", (req, res) => {
  const { targetDevice } = req.body;

  if (targetDevice === "all") {
    if (global.io) {
      global.io.emit("clear-data");
      console.log("Clear data command sent to: all devices");
      return res.json({ success: true });
    }
    return res.json({ success: false });
  }

  if (global.io && global.connectedDevices?.[targetDevice]) {
    const socketId = global.connectedDevices[targetDevice];
    global.io.to(socketId).emit("clear-data");
    console.log("Clear data command sent to:", targetDevice);
    return res.json({ success: true });
  }

  return res.json({ success: false });
});

router.post("/restart-device", (req, res) => {
  const { targetDevice } = req.body;

  if (targetDevice === "all") {
    if (global.io) {
      global.io.emit("restart-app");
      return res.json({ success: true });
    }
    return res.json({ success: false });
  }

  if (global.io && global.connectedDevices?.[targetDevice]) {
    const socketId = global.connectedDevices[targetDevice];
    global.io.to(socketId).emit("restart-app");
    console.log("Restart command sent to:", targetDevice);
    return res.json({ success: true });
  }

  return res.json({ success: false });
});

router.post("/upload-fallback-image", (req, res) => {
  fallbackUpload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed" });
    }
    if (!req.file?.filename) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    return res.json({
      success: true,
      url: `/media/fallbacks/${req.file.filename}`,
    });
  });
});

module.exports = router;
