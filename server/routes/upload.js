
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.post('/:section', (req, res) => {
  try {
    const section = req.params.section; // section1 / section2 / section3

    const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads', section);

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const upload = multer({
      dest: UPLOAD_DIR,
      limits: { fileSize: 1024 * 1024 * 1024 }
    }).array('files', 50);

    upload(req, res, err => {
      if (err) return res.status(500).json({ error: err.message });

      for (const file of req.files) {
        const finalPath = path.join(UPLOAD_DIR, file.originalname);
        fs.renameSync(file.path, finalPath);
      }

      if (global.io) global.io.emit('media-updated');

      res.json({ success: true });
    });

  } catch (e) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
