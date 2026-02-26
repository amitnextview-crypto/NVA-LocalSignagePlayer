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

/* ⭐ STORE CONNECTED DEVICES */
const connectedDevices = {};
global.connectedDevices = connectedDevices;
io.on("connection", (socket) => {

  socket.on("register-device", (deviceId) => {
    connectedDevices[deviceId] = socket.id;
    console.log("Device connected:", deviceId);
  });

  socket.on("disconnect", () => {
    for (let id in connectedDevices) {
      if (connectedDevices[id] === socket.id) {
        delete connectedDevices[id];
        console.log("Device disconnected:", id);
      }
    }
  });

});

/* ⭐ API TO GET CONNECTED DEVICES */
app.get("/devices", (req, res) => {
  res.json(Object.keys(connectedDevices));
});

/* START SERVER */
const PORT = 8080;

server.listen(PORT, () => {
  console.log(`CMS running on http://0.0.0.0:${PORT}`);
});