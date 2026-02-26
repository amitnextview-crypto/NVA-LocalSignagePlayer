const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const BASE_DIR = path.join(__dirname, "../uploads");

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

const files = fs.readdirSync(sectionDir)
  .filter(f => /\.(mp4|jpg|jpeg|png)$/i.test(f))
  .map(name => ({
    name,
    section: i,
    url: `/media/${actualDevice}/section${i}/${name}`
  }));
    result.push(...files);
  }

  res.json(result);
});

module.exports = router;