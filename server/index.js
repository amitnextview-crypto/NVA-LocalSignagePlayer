const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require("http");
const { Server } = require("socket.io");

const configRoutes = require('./routes/config');
const uploadRoutes = require('./routes/upload');
const mediaRoutes = require('./routes/media');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/media-list', mediaRoutes);
app.use('/upload', uploadRoutes);
app.use('/config', configRoutes);
app.use('/media', express.static(path.join(__dirname, 'uploads')));
app.use('/', express.static(path.join(__dirname, 'public')));

/* ⭐ SOCKET SERVER */
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

global.io = io;

io.on("connection", socket => {
  console.log("TV connected");
});

/* START SERVER */
const PORT = 8080;

server.listen(PORT, () => {
  console.log(`CMS running on http://0.0.0.0:${PORT}`);
});
