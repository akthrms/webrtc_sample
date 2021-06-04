"use strict";

function log(message) {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  console.log(
    `[${year}/${month}/${day} ${hour}:${minute}:${second}] ${message}`
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
