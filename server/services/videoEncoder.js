const { exec } = require('child_process');
const path = require('path');

/* ✅ ABSOLUTE PATH TO FFMPEG */
const FFMPEG = `"C:\\ffmpeg\\bin\\ffmpeg.exe"`;

module.exports.encodeVideo = (inputPath) => {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath + '.mp4';

    const cmd =
      `${FFMPEG} -y -i "${inputPath}" ` +
      `-vf "scale=1920:1080:force_original_aspect_ratio=decrease,` +
      `pad=1920:1080:(ow-iw)/2:(oh-ih)/2" ` +
      `-c:v libx264 ` +
      `-profile:v high ` +
      `-level 4.1 ` +
      `-pix_fmt yuv420p ` +
      `-preset veryfast ` +
      `-r 30 ` +
      `-g 30 ` +
      `-keyint_min 30 ` +
      `-sc_threshold 0 ` +
      `-b:v 4M ` +
      `-maxrate 5M ` +
      `-bufsize 8M ` +
      `-movflags +faststart ` +
      `-an ` +
      `"${outputPath}"`;

    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error('FFMPEG ERROR:', stderr || err.message);
        return reject(err);
      }
      resolve(outputPath);
    });
  });
};
