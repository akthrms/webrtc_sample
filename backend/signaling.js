"use strict";

const WebSocketServer = require("ws").Server;

const port = 3001;
const webSocketServer = new WebSocketServer({ port: port });

webSocketServer.on("connection", (webSocket) => {
  webSocket.on("message", (message) => {
    webSocketServer.clients.forEach((client) => {
      if (webSocket !== client) {
        client.send(message);
      }
    });
  });
});
