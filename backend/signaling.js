"use strict";

function log(message) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const second = now.getSeconds();

  console.log(
    `[${year}/${month}/${date} ${hour}:${minute}:${second}] ${message}`
  );
}

// WebSocket サーバーを起動する
const WebSocketServer = require("ws").Server;
const port = 3001;
const webSocketServer = new WebSocketServer({ port: port });

webSocketServer.on("connection", (webSocket) => {
  log("WebSocket server is connected.");

  webSocket.on("message", (message) => {
    log(`message is received.`);

    webSocketServer.clients.forEach((client) => {
      if (webSocket !== client) {
        // そのまま転送する
        client.send(message);
      }
    });
  });
});

log(`WebSocket server is started. port = ${port}`);
