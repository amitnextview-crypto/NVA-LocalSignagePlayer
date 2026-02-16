const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const CONFIG_PATH = path.join(__dirname, '../data/config.json');

router.get('/', (req, res) => {
  const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
  res.json(JSON.parse(data));
});

router.post('/', (req, res) => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2));
  // ⭐ auto refresh all players
  if (global.io) global.io.emit('media-updated');
  res.json({ success: true });
});


module.exports = router;
