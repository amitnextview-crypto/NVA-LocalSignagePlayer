const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const basePath = process.pkg
  ? path.dirname(process.execPath)
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
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
const MAX_FILES_PER_UPLOAD = 120;

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

router.post("/:deviceId/section/:section", (req, res) => {
  const deviceId = req.params.deviceId;
  const section = req.params.section;

  const finalSectionPath = path.join(uploadsBase, deviceId, `section${section}`);
  const tempSectionPath = path.join(uploadsBase, deviceId, `section${section}__incoming`);

  try {
    if (deviceId === "all" && fs.existsSync(uploadsBase)) {
      const folders = fs.readdirSync(uploadsBase);
      for (const folder of folders) {
        if (folder === "all") continue;
        fs.rmSync(path.join(uploadsBase, folder), { recursive: true, force: true });
        console.log("Deleted device folder:", folder);
      }
    }

    if (fs.existsSync(tempSectionPath)) {
      fs.rmSync(tempSectionPath, { recursive: true, force: true });
    }
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

    upload(req, res, (err) => {
      if (err) {
        if (fs.existsSync(tempSectionPath)) {
          fs.rmSync(tempSectionPath, { recursive: true, force: true });
        }

        const message =
          err instanceof multer.MulterError
            ? err.code === "LIMIT_FILE_SIZE"
              ? `File too large. Max allowed is ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024 * 1024))} GB per file.`
              : err.code === "LIMIT_FILE_COUNT"
              ? `Too many files. Max allowed is ${MAX_FILES_PER_UPLOAD} files.`
              : err.message
            : err.message || "Upload failed";

        console.error("Upload error:", message);
        return res.status(400).json({ error: message });
      }

      ensureDir(finalSectionPath);
      cleanDir(finalSectionPath);

      const uploadedFiles = fs.readdirSync(tempSectionPath);
      for (const fileName of uploadedFiles) {
        fs.renameSync(
          path.join(tempSectionPath, fileName),
          path.join(finalSectionPath, fileName)
        );
      }

      fs.rmSync(tempSectionPath, { recursive: true, force: true });
      console.log("New files saved in:", finalSectionPath);

      if (global.io) {
        if (deviceId === "all") {
          global.io.emit("media-updated");
        } else if (global.connectedDevices?.[deviceId]) {
          const socketId = global.connectedDevices[deviceId];
          global.io.to(socketId).emit("media-updated");
        }
      }

      return res.json({ success: true });
    });
  } catch (error) {
    if (fs.existsSync(tempSectionPath)) {
      fs.rmSync(tempSectionPath, { recursive: true, force: true });
    }
    console.log("Upload error:", error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
