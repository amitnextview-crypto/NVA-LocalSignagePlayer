const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function resolveFfmpegPath() {
  const configured = String(process.env.FFMPEG_PATH || "").trim();
  if (configured && fs.existsSync(configured)) return configured;

  if (process.pkg) {
    try {
      const ffmpegStatic = require("ffmpeg-static");
      if (ffmpegStatic) {
        const extractedPath = path.join(
          global.runtimeBasePath || path.dirname(process.execPath),
          "ffmpeg-bundled.exe"
        );
        if (!fs.existsSync(extractedPath)) {
          fs.copyFileSync(ffmpegStatic, extractedPath);
        }
        if (fs.existsSync(extractedPath)) return extractedPath;
      }
    } catch (_e) {
    }

    const localCandidates = [
      path.join(global.runtimeBasePath || path.dirname(process.execPath), "ffmpeg.exe"),
      path.join(path.dirname(process.execPath), "ffmpeg.exe"),
      "C:\\ffmpeg\\bin\\ffmpeg.exe",
    ];
    for (const candidate of localCandidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return "ffmpeg";
  }

  try {
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) return ffmpegStatic;
  } catch (_e) {
  }

  return "ffmpeg";
}

function createOutputPath(inputPath) {
  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}__tv.mp4`);
}

function encodeVideo(inputPath, options = {}) {
  return new Promise((resolve, reject) => {
    const ffmpeg = resolveFfmpegPath();
    const outputPath = createOutputPath(inputPath);
    const width = Math.max(320, Number(options.width || 1920));
    const height = Math.max(240, Number(options.height || 1080));
    const preset = String(options.preset || "veryfast");
    const videoBitrate = String(options.videoBitrate || "4M");
    const maxRate = String(options.maxRate || "5M");
    const bufferSize = String(options.bufferSize || "8M");
    const frameRate = Math.max(24, Number(options.frameRate || 30));

    const args = [
      "-y",
      "-i",
      inputPath,
      "-vf",
      `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-level",
      "4.1",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      preset,
      "-r",
      String(frameRate),
      "-g",
      String(frameRate),
      "-keyint_min",
      String(frameRate),
      "-sc_threshold",
      "0",
      "-b:v",
      videoBitrate,
      "-maxrate",
      maxRate,
      "-bufsize",
      bufferSize,
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      outputPath,
    ];

    const child = spawn(ffmpeg, args, { windowsHide: true });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });

    child.on("error", (err) => {
      reject(new Error(`ffmpeg-start-failed: ${err.message}`));
    });

    child.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
        return;
      }
      reject(new Error(`ffmpeg-exit-${code}: ${stderr.slice(-500)}`));
    });
  });
}

module.exports = {
  encodeVideo,
};
