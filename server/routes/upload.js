const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// ⭐ IMPORTANT: Use writable base path
const basePath = process.pkg
  ? path.dirname(process.execPath)
  : path.join(__dirname, "..");

router.post("/:deviceId/section/:section", (req, res) => {

  const deviceId = req.params.deviceId;
  const section = req.params.section;
 

  const uploadPath = path.join(
    basePath,
    "uploads",
    deviceId,
    `section${section}`
  );

   // 🔥 OPTIONAL: clear section before new upload
fs.rmSync(uploadPath, { recursive: true, force: true });
fs.mkdirSync(uploadPath, { recursive: true });

  // ✅ Create folder safely
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: uploadPath,
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
    }
  });

  const upload = multer({ storage }).array("files");

  upload(req, res, function (err) {

    if (err) {
      console.error(err);
      return res.status(500).json({ error: err });
    }

    console.log("Uploaded to:", uploadPath);

    // 🔥 Notify devices
    if (global.io) {

      if (deviceId === "all") {
        global.io.emit("media-updated");
      } 
      else if (global.connectedDevices?.[deviceId]) {
        const socketId = global.connectedDevices[deviceId];
        global.io.to(socketId).emit("media-updated");
      }
    }

    res.json({ success: true });
  });

});

module.exports = router;