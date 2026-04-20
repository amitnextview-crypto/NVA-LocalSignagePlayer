const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { spawnSync } = require("child_process");

const YOUTUBE_URL_RE =
  /(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{6,})/i;
const YT_DLP_AUTO_DOWNLOAD_URL =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";

let inFlightYtDlpBootstrap = null;

function getServerBasePath() {
  return process.pkg
    ? global.runtimeBasePath || path.dirname(process.execPath)
    : path.join(__dirname, "..");
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeExists(targetPath) {
  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function isYoutubeUrl(value) {
  return YOUTUBE_URL_RE.test(String(value || "").trim());
}

function getWritableYtDlpPath() {
  return path.join(getServerBasePath(), "bin", "yt-dlp.exe");
}

function isCommandCandidate(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return false;
  return !candidate.includes("\\") && !candidate.includes("/") && path.basename(candidate) === candidate;
}

function canExecuteYtDlp(candidate) {
  const value = String(candidate || "").trim();
  if (!value) return false;
  try {
    const result = spawnSync(value, ["--version"], {
      timeout: 15000,
      windowsHide: true,
      stdio: "pipe",
      shell: false,
    });
    return !result.error && Number(result.status) === 0;
  } catch {
    return false;
  }
}

function getBundledAssetYtDlpPath() {
  const assetBasePath =
    global.assetBasePath ||
    (process.pkg ? __dirname : path.join(__dirname, ".."));
  return path.join(assetBasePath, "bin", "yt-dlp.exe");
}

function copyBundledYtDlpToWritableLocation() {
  const bundledPath = getBundledAssetYtDlpPath();
  const writablePath = getWritableYtDlpPath();
  if (!safeExists(bundledPath)) return "";

  try {
    ensureDir(path.dirname(writablePath));
    fs.copyFileSync(bundledPath, writablePath);
    return safeExists(writablePath) ? writablePath : "";
  } catch {
    return "";
  }
}

function findYtDlpBinary() {
  const envPath = String(process.env.YT_DLP_PATH || process.env.YTDLP_PATH || "").trim();
  if (envPath && (safeExists(envPath) || isCommandCandidate(envPath)) && canExecuteYtDlp(envPath)) {
    return envPath;
  }

  const runtimeBasePath = getServerBasePath();
  const processDir = process.pkg ? path.dirname(process.execPath) : runtimeBasePath;
  const candidates = [
    path.join(runtimeBasePath, "bin", "yt-dlp.exe"),
    getBundledAssetYtDlpPath(),
    path.join(processDir, "bin", "yt-dlp.exe"),
    path.join(processDir, "bin", "yt-dlp"),
    "C:\\Program Files\\yt-dlp\\yt-dlp.exe",
    "C:\\yt-dlp\\yt-dlp.exe",
    "yt-dlp",
  ];

  for (const candidate of candidates) {
    if ((safeExists(candidate) || isCommandCandidate(candidate)) && canExecuteYtDlp(candidate)) {
      return candidate;
    }
  }
  return "";
}

function downloadFileWithRedirects(url, destPath, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const client = String(url || "").startsWith("https:") ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          "User-Agent": "NVAPlayerPC/1.0",
        },
      },
      (res) => {
        const status = Number(res.statusCode || 0);
        const location = String(res.headers?.location || "").trim();

        if ([301, 302, 303, 307, 308].includes(status) && location && redirectsLeft > 0) {
          res.resume();
          downloadFileWithRedirects(location, destPath, redirectsLeft - 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`download-http-${status || "unknown"}`));
          return;
        }

        ensureDir(path.dirname(destPath));
        const tempPath = `${destPath}.tmp`;
        const file = fs.createWriteStream(tempPath);
        res.pipe(file);

        file.on("finish", () => {
          file.close(() => {
            try {
              if (safeExists(destPath)) {
                fs.rmSync(destPath, { force: true });
              }
              fs.renameSync(tempPath, destPath);
              resolve(destPath);
            } catch (error) {
              reject(error);
            }
          });
        });

        file.on("error", (error) => {
          try {
            file.close(() => {});
          } catch {
          }
          try {
            if (safeExists(tempPath)) {
              fs.rmSync(tempPath, { force: true });
            }
          } catch {
          }
          reject(error);
        });
      }
    );

    req.on("error", reject);
  });
}

async function ensureYtDlpBinary() {
  const existing = findYtDlpBinary();
  if (existing) return existing;

  const copiedBundled = copyBundledYtDlpToWritableLocation();
  if (copiedBundled && canExecuteYtDlp(copiedBundled)) {
    return copiedBundled;
  }

  if (inFlightYtDlpBootstrap) {
    return await inFlightYtDlpBootstrap;
  }

  const writablePath = getWritableYtDlpPath();
  inFlightYtDlpBootstrap = (async () => {
    try {
      await downloadFileWithRedirects(YT_DLP_AUTO_DOWNLOAD_URL, writablePath);
      return writablePath;
    } finally {
      inFlightYtDlpBootstrap = null;
    }
  })();

  return await inFlightYtDlpBootstrap;
}

module.exports = {
  canExecuteYtDlp,
  ensureYtDlpBinary,
  findYtDlpBinary,
  getWritableYtDlpPath,
  isYoutubeUrl,
};
