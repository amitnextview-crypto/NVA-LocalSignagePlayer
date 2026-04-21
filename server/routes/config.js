const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const {
  getPlaybackTimeline,
  clearDeviceTimeline,
  clearAllTimelines,
  updateSectionTimeline,
} = require("../services/playbackTimeline");
const {
  parseTargetValue,
  resolveTargetDeviceIds,
  sanitizeDeviceId,
} = require("../services/deviceRegistry");

const router = express.Router();

const basePath = process.pkg
  ? (global.runtimeBasePath || path.dirname(process.execPath))
  : path.join(__dirname, "..");
const assetBasePath = process.pkg
  ? (global.assetBasePath || path.join(__dirname, ".."))
  : path.join(__dirname, "..");

const CONFIG_DIR = path.join(basePath, "data", "configs");
const UPLOADS_DIR = path.join(basePath, "uploads");
const FALLBACK_DIR = path.join(basePath, "uploads", "fallbacks");
const UPDATE_DIR = path.join(basePath, "uploads", "updates");
const DEFAULT_CONFIG_PATH = path.join(CONFIG_DIR, "default.json");
const ASSET_DEFAULT_CONFIG_PATH = path.join(assetBasePath, "data", "configs", "default.json");
function getTargetDevices(targetValue) {
  return resolveTargetDeviceIds(
    targetValue,
    global.deviceStatus || {},
    global.connectedDevices || {}
  );
}

function cloneDefaultConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG_TEMPLATE));
}

function normalizeSection(section) {
  const sourceType = ["multimedia", "web", "youtube", "template"].includes(
    String(section?.sourceType || "")
  )
    ? String(section?.sourceType || "")
    : "multimedia";
  const inputSourceType = ["multimedia", "web", "youtube", "template"].includes(
    String(section?.inputSourceType || "")
  )
    ? String(section?.inputSourceType || "")
    : sourceType;
  const templatePlaylist = Array.isArray(section?.templatePlaylist)
    ? section.templatePlaylist.filter((item) => item && typeof item === "object")
    : [];
  const templateConfig =
    section?.templateConfig && typeof section.templateConfig === "object"
      ? section.templateConfig
      : templatePlaylist[0] || null;

  return {
    slideDirection: String(section?.slideDirection || "left"),
    slideDuration: Math.max(1, Number(section?.slideDuration || 5)),
    sourceType,
    sourceUrl: String(section?.sourceUrl || ""),
    inputSourceType,
    inputSourceUrl: String(section?.inputSourceUrl || section?.sourceUrl || ""),
    templateConfig,
    templatePlaylist,
  };
}

function normalizeConfig(config) {
  const incoming = config && typeof config === "object" ? config : {};
  const sections = Array.isArray(incoming.sections) ? incoming.sections : [];
  return {
    ...cloneDefaultConfig(),
    ...incoming,
    sections: [0, 1, 2].map((index) =>
      normalizeSection(sections[index] || DEFAULT_CONFIG_TEMPLATE.sections[index] || {})
    ),
  };
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function activeSectionCountForLayout(layout) {
  if (String(layout || "") === "grid3") return 3;
  if (String(layout || "") === "grid2") return 2;
  return 1;
}

function listKnownServerDeviceIds() {
  const ids = new Set();

  try {
    const configFiles = fs.existsSync(CONFIG_DIR) ? fs.readdirSync(CONFIG_DIR) : [];
    configFiles.forEach((file) => {
      if (!file.endsWith(".json") || file === "default.json") return;
      const deviceId = sanitizeDeviceId(path.basename(file, ".json"));
      if (deviceId) ids.add(deviceId);
    });
  } catch {
  }

  try {
    const uploadDirs = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [];
    uploadDirs.forEach((name) => {
      if (["all", "fallbacks", "updates"].includes(String(name || "").toLowerCase())) return;
      const deviceId = sanitizeDeviceId(name);
      if (deviceId) ids.add(deviceId);
    });
  } catch {
  }

  return Array.from(ids);
}

function clearSectionServerData(deviceId, section) {
  const rawDeviceId = String(deviceId || "").trim();
  const safeDeviceId = rawDeviceId === "all" ? "all" : sanitizeDeviceId(rawDeviceId);
  const safeSection = Number(section || 0);
  if (!safeDeviceId || !Number.isInteger(safeSection) || safeSection < 1 || safeSection > 3) {
    return;
  }

  const sectionBase = path.join(UPLOADS_DIR, safeDeviceId, `section${safeSection}`);
  const versionsDir = `${sectionBase}__versions`;
  const activeFile = `${sectionBase}__active.txt`;
  const clearedFile = `${sectionBase}__cleared.txt`;

  [sectionBase, versionsDir].forEach((targetPath) => {
    try {
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      }
    } catch {
    }
  });

  [activeFile, clearedFile].forEach((targetPath) => {
    try {
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { force: true });
      }
    } catch {
    }
  });
}

function cleanupInactiveSectionsForDevice(deviceId, config) {
  const safeDeviceId = sanitizeDeviceId(deviceId);
  if (!safeDeviceId) return;

  const activeCount = activeSectionCountForLayout(config?.layout);
  for (let section = activeCount + 1; section <= 3; section += 1) {
    clearSectionServerData(safeDeviceId, section);
    updateSectionTimeline(safeDeviceId, section, {
      targetDevice: safeDeviceId,
      syncAt: Date.now(),
      updatedAt: Date.now(),
      cycleId: `${section}-cleared-${Date.now()}`,
      fileCount: 0,
      mediaSignature: "",
    });
  }
}

function cleanupInactiveSectionsForTarget(target, config) {
  if (target.type === "all") {
    const activeCount = activeSectionCountForLayout(config?.layout);
    for (let section = activeCount + 1; section <= 3; section += 1) {
      clearSectionServerData("all", section);
      updateSectionTimeline("all", section, {
        targetDevice: "all",
        syncAt: Date.now(),
        updatedAt: Date.now(),
        cycleId: `${section}-cleared-${Date.now()}`,
        fileCount: 0,
        mediaSignature: "",
      });
    }
    listKnownServerDeviceIds().forEach((deviceId) => cleanupInactiveSectionsForDevice(deviceId, config));
    return;
  }

  const deviceIds = target.type === "group" ? getTargetDevices(`group:${target.value}`) : [target.value];
  deviceIds.forEach((deviceId) => cleanupInactiveSectionsForDevice(deviceId, config));
}

function clearDeviceServerData(deviceId) {
  const safeDeviceId = sanitizeDeviceId(deviceId);
  if (!safeDeviceId) return;
  const deviceUploadDir = path.join(UPLOADS_DIR, safeDeviceId);
  try {
    if (fs.existsSync(deviceUploadDir)) {
      fs.rmSync(deviceUploadDir, { recursive: true, force: true });
    }
  } catch {
  }
  ensureDir(deviceUploadDir);
  for (let section = 1; section <= 3; section += 1) {
    try {
      fs.writeFileSync(
        path.join(deviceUploadDir, `section${section}__cleared.txt`),
        String(Date.now()),
        "utf8"
      );
    } catch {
    }
  }

  try {
    fs.writeFileSync(
      path.join(CONFIG_DIR, `${safeDeviceId}.json`),
      JSON.stringify(cloneDefaultConfig(), null, 2)
    );
  } catch {
  }

  clearDeviceTimeline(safeDeviceId);
}

function clearAllServerData() {
  try {
    if (fs.existsSync(UPLOADS_DIR)) {
      fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
    }
  } catch {
  }
  ensureDir(UPLOADS_DIR);
  ensureDir(FALLBACK_DIR);
  ensureDir(UPDATE_DIR);

  try {
    const files = fs.existsSync(CONFIG_DIR) ? fs.readdirSync(CONFIG_DIR) : [];
    files.forEach((file) => {
      if (!file.endsWith(".json")) return;
      const targetPath = path.join(CONFIG_DIR, file);
      if (file === "default.json") {
        fs.writeFileSync(targetPath, JSON.stringify(cloneDefaultConfig(), null, 2));
        return;
      }
      fs.rmSync(targetPath, { force: true });
    });
  } catch {
  }

  clearAllTimelines();
}

function emitToTarget(targetValue, eventName, payload) {
  const target = parseTargetValue(targetValue);
  if (target.type === "invalid") return false;
  if (target.type === "all") {
    if (global.io) {
      global.io.emit(eventName, payload);
      return true;
    }
    return false;
  }

  const deviceIds =
    target.type === "group" ? getTargetDevices(targetValue) : [target.value];
  let sent = false;
  deviceIds.forEach((deviceId) => {
    const socketId = global.connectedDevices?.[deviceId];
    if (global.io && socketId) {
      global.io.to(socketId).emit(eventName, payload);
      sent = true;
    }
  });
  return sent;
}

const DEFAULT_CONFIG_TEMPLATE = {
  orientation: "horizontal",
  layout: "fullscreen",
  grid3Layout: "stack-v",
  gridRatio: "1:1:1",
  slideDuration: 5,
  animation: "slide",
  bgColor: "#000000",
  sections: [
    { slideDirection: "left", slideDuration: 5, sourceType: "multimedia", sourceUrl: "" },
    { slideDirection: "left", slideDuration: 5, sourceType: "multimedia", sourceUrl: "" },
    { slideDirection: "left", slideDuration: 5, sourceType: "multimedia", sourceUrl: "" },
  ],
  ticker: {
    text: "",
    color: "#ffffff",
    bgColor: "#000000",
    speed: 6,
    fontSize: 24,
    fontFamily: "sans-serif",
    position: "bottom",
  },
  schedule: {
    enabled: false,
    start: "09:00",
    end: "18:00",
    days: [0, 1, 2, 3, 4, 5, 6],
    fallbackMode: "black",
    fallbackMessage: "Playback is currently scheduled off.",
    fallbackImageUrl: "",
    fallbackTextColor: "#ffffff",
    fallbackBgColor: "#000000",
  },
};

if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}
if (!fs.existsSync(FALLBACK_DIR)) {
  fs.mkdirSync(FALLBACK_DIR, { recursive: true });
}
if (!fs.existsSync(UPDATE_DIR)) {
  fs.mkdirSync(UPDATE_DIR, { recursive: true });
}

function ensureDefaultConfig() {
  try {
    if (fs.existsSync(DEFAULT_CONFIG_PATH)) return;

    const fallbackRaw = fs.existsSync(ASSET_DEFAULT_CONFIG_PATH)
      ? fs.readFileSync(ASSET_DEFAULT_CONFIG_PATH, "utf-8")
      : JSON.stringify(DEFAULT_CONFIG_TEMPLATE, null, 2);
    const parsed = JSON.parse(fallbackRaw);
    const normalized = {
      ...DEFAULT_CONFIG_TEMPLATE,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
      layout: "fullscreen",
    };
    fs.writeFileSync(DEFAULT_CONFIG_PATH, JSON.stringify(normalized, null, 2));
  } catch (_e) {
    // best effort
  }
}

ensureDefaultConfig();

const fallbackUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, FALLBACK_DIR),
    filename: (req, file, cb) => {
      const target = String(req.body?.targetDevice || "all")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 80);
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = [".jpg", ".jpeg", ".png", ".mp4", ".mov", ".mkv", ".webm"].includes(ext)
        ? ext
        : ".jpg";
      cb(null, `schedule-fallback-${target}${safeExt}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".mp4", ".mov", ".mkv", ".webm"].includes(ext)) {
      return cb(new Error("Only JPG/PNG/MP4/MOV/MKV/WEBM files are allowed"));
    }
    cb(null, true);
  },
});

const appUpdateUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPDATE_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = ext === ".apk" ? ".apk" : ".bin";
      cb(null, `NVAPlayerPC-update${safeExt}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ext !== ".apk") {
      return cb(new Error("Only APK files are allowed"));
    }
    cb(null, true);
  },
});

router.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  const target = parseTargetValue(req.query.deviceId || "all");
  let filePath;

  if (target.type === "device") {
    const devicePath = path.join(CONFIG_DIR, `${target.value}.json`);
    filePath = fs.existsSync(devicePath)
      ? devicePath
      : DEFAULT_CONFIG_PATH;
  } else if (target.type === "group") {
    const groupMembers = getTargetDevices(`group:${target.value}`);
    const firstDeviceId = groupMembers[0] || "";
    const devicePath = firstDeviceId
      ? path.join(CONFIG_DIR, `${firstDeviceId}.json`)
      : "";
    filePath = devicePath && fs.existsSync(devicePath) ? devicePath : DEFAULT_CONFIG_PATH;
  } else {
    filePath = DEFAULT_CONFIG_PATH;
  }

  const data = fs.readFileSync(filePath, "utf-8");
  res.json({
    ...normalizeConfig(JSON.parse(data)),
    playbackTimeline: getPlaybackTimeline(
      target.type === "device" ? target.value : "all"
    ),
  });
});

router.post("/", (req, res) => {
  const { targetDevice, config } = req.body;
  const target = parseTargetValue(targetDevice);
  const normalizedConfig = normalizeConfig(config);
  if (target.type === "invalid") {
    return res.status(400).json({ success: false, error: "invalid-device-id" });
  }
  const scopedDeviceIds =
    target.type === "group" ? getTargetDevices(targetDevice) : target.type === "device" ? [target.value] : [];
  if (target.type === "group" && !scopedDeviceIds.length) {
    return res.status(400).json({ success: false, error: "group-has-no-devices" });
  }

  if (target.type === "all") {
    const defaultPath = DEFAULT_CONFIG_PATH;
    fs.writeFileSync(defaultPath, JSON.stringify(normalizedConfig, null, 2));

    const files = fs.readdirSync(CONFIG_DIR);
    files.forEach((file) => {
      if (file !== "default.json" && file.endsWith(".json")) {
        const devicePath = path.join(CONFIG_DIR, file);
        fs.writeFileSync(devicePath, JSON.stringify(normalizedConfig, null, 2));
      }
    });
    cleanupInactiveSectionsForTarget(target, normalizedConfig);

    if (global.io) {
      global.io.emit("config-updated");
    }
  } else {
    scopedDeviceIds.forEach((deviceId) => {
      const devicePath = path.join(CONFIG_DIR, `${deviceId}.json`);
      fs.writeFileSync(devicePath, JSON.stringify(normalizedConfig, null, 2));
    });
    cleanupInactiveSectionsForTarget(target, normalizedConfig);
    emitToTarget(targetDevice, "config-updated");
  }

  res.json({ success: true });
});

router.post("/clear-device", (req, res) => {
  const target = parseTargetValue(req.body?.targetDevice);
  if (target.type === "invalid") {
    return res.json({ success: false, error: "invalid-device-id" });
  }

  if (target.type === "all") {
    clearAllServerData();
  } else {
    const deviceIds =
      target.type === "group" ? getTargetDevices(req.body?.targetDevice) : [target.value];
    deviceIds.forEach((deviceId) => clearDeviceServerData(deviceId));
  }

  const sent = emitToTarget(req.body?.targetDevice, "clear-data");
  if (sent) {
    console.log("Clear data command sent to:", req.body?.targetDevice || "all");
    return res.json({ success: true });
  }
  return res.json({ success: false });
});

router.post("/restart-device", (req, res) => {
  const target = parseTargetValue(req.body?.targetDevice);
  if (target.type === "invalid") {
    return res.json({ success: false, error: "invalid-device-id" });
  }

  const sent = emitToTarget(req.body?.targetDevice, "restart-app");
  if (sent) {
    console.log("Restart command sent to:", req.body?.targetDevice || "all");
    return res.json({ success: true });
  }
  return res.json({ success: false });
});

router.post("/clear-cache", (req, res) => {
  const target = parseTargetValue(req.body?.targetDevice);
  if (target.type === "invalid") {
    return res.json({ success: false, error: "invalid-device-id" });
  }

  const sent = emitToTarget(req.body?.targetDevice, "clear-cache");
  if (sent) {
    console.log("Clear cache command sent to:", req.body?.targetDevice || "all");
    return res.json({ success: true });
  }
  return res.json({ success: false });
});

router.post("/auto-reopen", (req, res) => {
  const { enabled } = req.body || {};
  const target = parseTargetValue(req.body?.targetDevice);
  if (target.type === "invalid") {
    return res.json({ success: false, error: "invalid-device-id" });
  }
  const flag = !!enabled;
  const sent = emitToTarget(req.body?.targetDevice, "set-auto-reopen", {
    enabled: flag,
  });
  if (sent) {
    return res.json({ success: true });
  }

  return res.json({ success: false });
});

router.post("/upload-app-update", (req, res) => {
  appUpdateUpload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "APK upload failed" });
    }
    if (!req.file?.filename) {
      return res.status(400).json({ error: "No APK uploaded" });
    }

    return res.json({
      success: true,
      apkUrl: `/media/updates/${req.file.filename}`,
      fileName: req.file.filename,
      size: Number(req.file.size || 0),
    });
  });
});

router.post("/install-app-update", (req, res) => {
  const { apkUrl } = req.body || {};
  const target = parseTargetValue(req.body?.targetDevice);
  if (target.type === "invalid") {
    return res.json({ success: false, error: "invalid-device-id" });
  }
  const safeApkUrl = String(apkUrl || "").trim();
  if (!safeApkUrl) {
    return res.status(400).json({ success: false, error: "APK URL missing" });
  }

  const sent = emitToTarget(req.body?.targetDevice, "install-app-update", {
    apkUrl: safeApkUrl,
  });
  if (sent) {
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
