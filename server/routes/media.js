
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const BASE_DIR = path.join(__dirname, '../uploads');

router.get('/:section', (req, res) => {
  const section = req.params.section;
  const dir = path.join(BASE_DIR, section);

  if (!fs.existsSync(dir)) return res.json([]);

  const files = fs.readdirSync(dir)
    .filter(f => /\.(mp4|jpg|jpeg|png)$/i.test(f))
    .map(name => ({
      name,
      url: `/media/${section}/${name}`
    }));

  res.json(files);
});

module.exports = router;
