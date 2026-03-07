const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { encodeVideo } = require("../services/videoEncoder");
const { safeStat, safeReaddir, safeExistsDir, safeExists, wait } = require("../utils/fsSafe");

const router = express.Router();

const basePath = process.pkg
  ? (global.runtimeBasePath || path.dirname(process.execPath))
  : path.join(__dirname, "..");

const uploadsBase = path.join(basePath, "uploads");
const ALLOWED_EXTENSIONS = new Set([
  ".mp4",
  ".mkv",
  ".webm",
  ".jpg",
  ".jpeg",
  ".png",
  ".txt",
  ".pdf",
]);
const ALLOWED_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/x-matroska",
  "image/jpeg",
  "image/png",
  "text/plain",
  "application/pdf",
  "application/x-pdf",
]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mkv", ".webm"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
const MAX_FILES_PER_UPLOAD = 120;
const DISABLE_UPLOAD_TRANSCODE = String(process.env.DISABLE_UPLOAD_TRANSCODE || "") === "1";
const DIRECT_PLAY_VIDEO_EXTENSIONS = new Set([".mp4"]);

function emitSectionUploadStatus(deviceId, section, status, message = "") {
  if (!global.io) return;
  const payload = {
    section: Number(section || 0),
    status: String(status || "processing"),
    message: String(message || ""),
  };

  if (String(deviceId) === "all") {
    global.io.emit("section-upload-status", payload);
    return;
  }

  const socketId = global.connectedDevices?.[deviceId];
  if (socketId) {
    global.io.to(socketId).emit("section-upload-status", payload);
  }
}

function toErrorText(err, fallback = "Upload failed") {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (typeof err.message === "string" && err.message.trim()) return err.message.trim();
  return fallback;
}

function humanizeUploadError(err, fallback = "Upload failed") {
  const message = toErrorText(err, fallback);
  const lower = message.toLowerCase();
  const code = String(err?.code || "").toUpperCase();

  if (lower.includes("unsupported file type")) {
    return message;
  }

  if (code === "EPERM" || code === "EBUSY" || code === "ENOTEMPTY" || code === "EEXIST") {
    return "Upload folder/file is temporarily locked by the OS. Please retry in a few seconds.";
  }

  if (code === "EXDEV") {
    return "Server file move failed across storage volumes. Check server upload path configuration.";
  }

  if (lower.includes("enospc")) {
    return "Server storage is full. Free disk space and retry upload.";
  }

  if (lower.includes("eacces") || lower.includes("eperm")) {
    return "Server does not have permission to write upload files.";
  }

  if (lower.includes("enoent")) {
    return "Upload folder not found. Restart CMS server and try again.";
  }

  if (/[a-z]:\\[^:\n]+/i.test(message)) {
    return "Upload failed due to a server file-system error.";
  }

  return message;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function cleanDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath);
  for (const entry of entries) {
    fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true });
  }
}

function extFromMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime === "video/mp4") return ".mp4";
  if (mime === "video/webm") return ".webm";
  if (mime === "video/x-matroska") return ".mkv";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "text/plain") return ".txt";
  if (mime === "application/pdf" || mime === "application/x-pdf") return ".pdf";
  return "";
}

function sanitizeFileName(file, req) {
  const parsed = path.parse(file?.originalname || "media");
  const safeBase = (parsed.name || "media")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  const rawExt = (parsed.ext || "").toLowerCase().replace(/[^a-zA-Z0-9.]/g, "");
  const safeExt = rawExt || extFromMime(file?.mimetype);

  req._nameCounter = req._nameCounter || {};
  const key = `${safeBase}${safeExt}`.toLowerCase();
  req._nameCounter[key] = (req._nameCounter[key] || 0) + 1;

  const count = req._nameCounter[key];
  return count === 1 ? `${safeBase}${safeExt}` : `${safeBase}-${count}${safeExt}`;
}

function sectionPathFor(deviceId, sectionNumber) {
  return path.join(uploadsBase, deviceId, `section${sectionNumber}`);
}

function resolveActiveSectionDir(deviceId, sectionNumber) {
  const { sectionBase, versionsDir, activeFile } = sectionPaths(deviceId, sectionNumber);
  const activeState = readActiveSectionState(activeFile);
  if (activeState?.activeVersion) {
    const activeVersionDir = path.join(versionsDir, activeState.activeVersion);
    if (safeExistsDir(activeVersionDir)) return activeVersionDir;
  }
  if (safeExistsDir(sectionBase)) return sectionBase;
  return "";
}

function cleanupStaleIncomingDirs(deviceId, section, maxAgeMs = 6 * 60 * 60 * 1000) {
  const deviceDir = path.join(uploadsBase, deviceId);
  if (!safeExistsDir(deviceDir)) return;
  const prefix = `section${section}__incoming`;
  const now = Date.now();
  const entries = safeReaddir(deviceDir);

  for (const entry of entries) {
    if (!String(entry).startsWith(prefix)) continue;
    const full = path.join(deviceDir, entry);
    const stat = safeStat(full);
    if (!stat || !stat.isDirectory()) continue;
    const ageMs = now - Number(stat.mtimeMs || 0);
    if (ageMs < maxAgeMs) continue;
    try {
      fs.rmSync(full, { recursive: true, force: true });
    } catch {
    }
  }
}

function directoryHasVideo(dirPath) {
  if (!safeExistsDir(dirPath)) return false;
  const files = safeReaddir(dirPath);
  return files.some((name) =>
    VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase())
  );
}

function otherSectionHasVideo(deviceId, currentSection) {
  for (let s = 1; s <= 3; s++) {
    if (String(s) === String(currentSection)) continue;
    if (directoryHasVideo(resolveActiveSectionDir(deviceId, s))) return true;
  }
  return false;
}

function uniqueFilePath(dirPath, fileName) {
  const parsed = path.parse(fileName);
  let candidate = path.join(dirPath, fileName);
  let count = 2;
  while (safeExists(candidate)) {
    candidate = path.join(dirPath, `${parsed.name}-${count}${parsed.ext}`);
    count += 1;
  }
  return candidate;
}

function isTransientFsError(err) {
  const code = String(err?.code || "").toUpperCase();
  return code === "EPERM" || code === "EBUSY" || code === "ENOTEMPTY" || code === "EEXIST";
}

async function removePathWithRetry(targetPath, options = {}, retries = 6, delayMs = 120) {
  let lastErr = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      if (!safeExists(targetPath)) return;
      fs.rmSync(targetPath, options);
      if (!safeExists(targetPath)) return;
    } catch (err) {
      lastErr = err;
      if (!isTransientFsError(err) || i === retries - 1) {
        throw err;
      }
    }
    await wait(delayMs * (i + 1));
  }
  if (safeExists(targetPath)) {
    throw lastErr || new Error("remove-failed");
  }
}

async function renameWithRetry(fromPath, toPath, retries = 5, delayMs = 140) {
  let lastErr = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      fs.renameSync(fromPath, toPath);
      return;
    } catch (err) {
      lastErr = err;
      if (!isTransientFsError(err) || i === retries - 1) {
        throw err;
      }
      await wait(delayMs * (i + 1));
    }
  }
  throw lastErr || new Error("rename-failed");
}

function sectionPaths(deviceId, section) {
  const sectionBase = path.join(uploadsBase, deviceId, `section${section}`);
  return {
    sectionBase,
    versionsDir: `${sectionBase}__versions`,
    activeFile: `${sectionBase}__active.txt`,
  };
}

function buildVersionName() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readActiveSectionState(activeFile) {
  if (!safeExists(activeFile)) return null;
  try {
    const raw = String(fs.readFileSync(activeFile, "utf8") || "").trim();
    if (!raw) return null;
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      return {
        activeVersion: String(parsed?.activeVersion || "").trim(),
        files: Array.isArray(parsed?.files)
          ? parsed.files.map((name) => String(name || "").trim()).filter(Boolean)
          : [],
      };
    }
    return {
      activeVersion: raw,
      files: [],
    };
  } catch {
    return null;
  }
}

async function cleanupOldSectionVersions(versionsDir, keepVersion = "", keepCount = 2) {
  if (!safeExistsDir(versionsDir)) return;
  const entries = safeReaddir(versionsDir)
    .map((name) => ({ name, full: path.join(versionsDir, name), stat: safeStat(path.join(versionsDir, name)) }))
    .filter((entry) => entry.stat?.isDirectory?.());

  entries.sort((a, b) => Number(b.stat?.mtimeMs || 0) - Number(a.stat?.mtimeMs || 0));
  let kept = 0;
  for (const entry of entries) {
    if (entry.name === keepVersion) {
      kept += 1;
      continue;
    }
    if (kept < keepCount) {
      kept += 1;
      continue;
    }
    try {
      await removePathWithRetry(entry.full, { recursive: true, force: true }, 3, 80);
    } catch {
    }
  }
}

async function activateIncomingSection(deviceId, section, incomingDir) {
  const { sectionBase, versionsDir, activeFile } = sectionPaths(deviceId, section);
  const incomingFiles = safeExistsDir(incomingDir) ? safeReaddir(incomingDir) : [];
  const versionName = buildVersionName();
  const versionDir = path.join(versionsDir, versionName);
  const previousState = readActiveSectionState(activeFile);

  ensureDir(versionsDir);
  await renameWithRetry(incomingDir, versionDir);
  await wait(120);

  const activeFiles = safeExistsDir(versionDir) ? safeReaddir(versionDir) : incomingFiles;

  fs.writeFileSync(
    activeFile,
    JSON.stringify({
      activeVersion: versionName,
      files: activeFiles,
      updatedAt: Date.now(),
    }),
    "utf8"
  );

  if (safeExistsDir(sectionBase)) {
    try {
      await removePathWithRetry(sectionBase, { recursive: true, force: true }, 2, 60);
    } catch {
    }
  }

  cleanupOldSectionVersions(versionsDir, versionName, previousState?.activeVersion ? 2 : 1).catch(() => {
  });
}

async function optimizeVideosInDirectory(dirPath) {
  if (DISABLE_UPLOAD_TRANSCODE || String(process.env.DISABLE_VIDEO_TRANSCODE || "") === "1") {
    return;
  }

  const files = safeReaddir(dirPath);
  for (const fileName of files) {
    const ext = path.extname(fileName).toLowerCase();
    if (!VIDEO_EXTENSIONS.has(ext)) continue;

    const inputPath = path.join(dirPath, fileName);
    if (!safeExists(inputPath)) continue;

    const stat = safeStat(inputPath, { retries: 6 });
    if (!stat) continue;

    if (DIRECT_PLAY_VIDEO_EXTENSIONS.has(ext)) {
      console.log("Skipping transcode for direct-play MP4:", fileName);
      continue;
    }

    try {
      console.log("Transcoding video:", fileName);
      const encodedPath = await encodeVideo(inputPath);
      const targetFileName = `${path.parse(fileName).name}.mp4`;
      const finalPath = uniqueFilePath(dirPath, targetFileName);
      await removePathWithRetry(inputPath, { force: true }, 5, 100);
      await renameWithRetry(encodedPath, finalPath);
      console.log("Transcode done:", path.basename(finalPath));
    } catch (e) {
      console.log("Transcode failed, using original file:", fileName, String(e?.message || e));
    }
  }
}

router.post("/:deviceId/section/:section", (req, res) => {
  const deviceId = req.params.deviceId;
  const section = req.params.section;

  const uploadToken = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tempSectionPath = path.join(
    uploadsBase,
    deviceId,
    `section${section}__incoming_${uploadToken}`
  );

  try {
    cleanupStaleIncomingDirs(deviceId, section);
    ensureDir(tempSectionPath);

    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, tempSectionPath),
      filename: (reqRef, file, cb) => cb(null, sanitizeFileName(file, reqRef)),
    });

    const upload = multer({
      storage,
      limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: MAX_FILES_PER_UPLOAD,
      },
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        const mime = String(file.mimetype || "").toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_MIME_TYPES.has(mime)) {
          return cb(new Error(`Unsupported file type: ${file.originalname}`));
        }
        cb(null, true);
      },
    }).array("files");

    emitSectionUploadStatus(
      deviceId,
      section,
      "processing",
      "Uploading media... Please wait."
    );

    upload(req, res, async (err) => {
      try {
        if (err) {
          if (safeExists(tempSectionPath)) {
            try {
              fs.rmSync(tempSectionPath, { recursive: true, force: true });
            } catch (_e) {}
          }

          const message =
            err instanceof multer.MulterError
              ? err.code === "LIMIT_FILE_SIZE"
                ? `File too large. Max allowed is ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024 * 1024))} GB per file.`
                : err.code === "LIMIT_FILE_COUNT"
                ? `Too many files. Max allowed is ${MAX_FILES_PER_UPLOAD} files.`
                : humanizeUploadError(err, "Upload failed")
              : humanizeUploadError(err, "Upload failed");

          console.error("Upload error:", message);
          emitSectionUploadStatus(deviceId, section, "error", message);
          return res.status(400).json({ error: message });
        }

        const incomingFiles = safeExistsDir(tempSectionPath)
          ? safeReaddir(tempSectionPath)
          : [];
        const incomingHasRawPdf = incomingFiles.some((name) =>
          /\.pdf$/i.test(String(name || ""))
        );
        if (incomingHasRawPdf) {
          fs.rmSync(tempSectionPath, { recursive: true, force: true });
          emitSectionUploadStatus(
            deviceId,
            section,
            "error",
            "PDF must be converted to image pages by CMS before upload."
          );
          return res.status(400).json({
            error:
              "Raw PDF upload is not allowed. Upload PDF from the latest CMS page so it converts to page images first.",
          });
        }
        const incomingHasVideo = incomingFiles.some((name) =>
          VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase())
        );
        if (incomingHasVideo && otherSectionHasVideo(deviceId, section)) {
          fs.rmSync(tempSectionPath, { recursive: true, force: true });
          emitSectionUploadStatus(
            deviceId,
            section,
            "error",
            "Video allowed in only one section. Remove video from another section first."
          );
          return res.status(400).json({
            error: "Video upload allowed in only one grid section. Remove video from other section first.",
          });
        }

        if (incomingHasVideo) {
          try {
            emitSectionUploadStatus(
              deviceId,
              section,
              "processing",
              "Processing video for TV compatibility... Please wait."
            );
            await optimizeVideosInDirectory(tempSectionPath);
          } catch (e) {
            console.log("Video optimization step skipped:", String(e?.message || e));
          }
        }

        await activateIncomingSection(deviceId, section, tempSectionPath);

        // Apply "all" upload to all devices only after successful activation.
        // Remove per-device section overrides so they follow "all" immediately.
        if (deviceId === "all" && safeExistsDir(uploadsBase)) {
          const folders = safeReaddir(uploadsBase);
          for (const folder of folders) {
            if (folder === "all") continue;
            const { sectionBase, versionsDir, activeFile } = sectionPaths(folder, section);
            try {
              if (safeExists(sectionBase)) {
                fs.rmSync(sectionBase, { recursive: true, force: true });
              }
              if (safeExists(versionsDir)) {
                fs.rmSync(versionsDir, { recursive: true, force: true });
              }
              if (safeExists(activeFile)) {
                fs.rmSync(activeFile, { force: true });
              }
            } catch {
            }
          }
        }

        console.log(
          "New files saved in:",
          path.join(uploadsBase, deviceId, `section${section}`)
        );

        if (global.io) {
          if (deviceId === "all") {
            global.io.emit("media-updated");
          } else if (global.connectedDevices?.[deviceId]) {
            const socketId = global.connectedDevices[deviceId];
            global.io.to(socketId).emit("media-updated");
          }
        }

        emitSectionUploadStatus(deviceId, section, "ready", "");
        return res.json({ success: true });
      } catch (innerError) {
        if (safeExists(tempSectionPath)) {
          try {
            fs.rmSync(tempSectionPath, { recursive: true, force: true });
          } catch (_e) {}
        }
        const message = humanizeUploadError(innerError, "Upload failed on server");
        console.log("Upload error:", innerError);
        emitSectionUploadStatus(deviceId, section, "error", message);
        return res.status(500).json({ error: message });
      }
    });
  } catch (error) {
    if (safeExists(tempSectionPath)) {
      try {
        fs.rmSync(tempSectionPath, { recursive: true, force: true });
      } catch (_e) {}
    }
    console.log("Upload error:", error);
    emitSectionUploadStatus(deviceId, section, "error", humanizeUploadError(error, "Upload failed on server"));
    return res.status(500).json({ error: humanizeUploadError(error, "Upload failed on server") });
  }
});

module.exports = router;
