const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const BASE_DIR = path.join(__dirname, "../uploads");
const ALLOWED_MEDIA_EXT = /\.(mp4|mkv|webm|jpg|jpeg|png|txt|pdf)$/i;

function estimatePdfPageCount(filePath) {
  try {
    const content = fs.readFileSync(filePath, "latin1");
    const matches = content.match(/\/Type\s*\/Page\b/g);
    return Math.max(1, matches ? matches.length : 1);
  } catch (_e) {
    return 1;
  }
}

router.get("/", (req, res) => {
  const deviceId = req.query.deviceId;

  if (!deviceId) return res.json([]);

  const result = [];

  for (let i = 1; i <= 3; i++) {

   let actualDevice = deviceId;
let sectionDir = path.join(BASE_DIR, deviceId, `section${i}`);

if (!fs.existsSync(sectionDir)) {
  actualDevice = "all";
  sectionDir = path.join(BASE_DIR, "all", `section${i}`);
}

if (!fs.existsSync(sectionDir)) continue;

    const files = fs.readdirSync(sectionDir);
    for (const name of files) {
      if (!ALLOWED_MEDIA_EXT.test(name)) continue;
      const ext = path.extname(name).toLowerCase();
      const baseUrl = `/media/${actualDevice}/section${i}/${name}`;

      if (ext === ".pdf") {
        const pdfPath = path.join(sectionDir, name);
        const pageCount = estimatePdfPageCount(pdfPath);
        for (let page = 1; page <= pageCount; page++) {
          result.push({
            name: `${name}#page-${page}`,
            originalName: name,
            section: i,
            url: baseUrl,
            type: "pdf",
            page,
            pageCount,
          });
        }
        continue;
      }

      result.push({
        name,
        section: i,
        url: baseUrl,
        type: ext === ".txt" ? "text" : "media",
      });
    }
  }

  res.json(result);
});

module.exports = router;
