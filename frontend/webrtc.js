function app() {
  return {
    textForSendingSdp: "SDP to send",
    textForReceivingSdp: "",

    mediaStream: null,
    rtcPeerConnection: null,
    isNegotiationNeeded: true,

    webSocket: null,

    async startVideo() {
      try {
        this.mediaStream = await window.navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        await this.playVideo(this.$refs.localVideo, this.mediaStream);
      } catch (e) {
        console.error(e);
      }
    },

    async playVideo(video, mediaStream) {
      try {
        video.srcObject = mediaStream;
        await video.play();
      } catch (e) {
        console.error(e);
      }
    },

    prepareNewConnection(isOffer) {
      const rtcPeerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.webrtc.ecl.ntt.com:3478" }],
      });

      rtcPeerConnection.ontrack = async (event) => {
        try {
          await this.playVideo(this.$refs.remoteVideo, event.streams[0]);
        } catch (e) {
          console.error(e);
        }
      };

      rtcPeerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendCandidate(event.candidate);
        }
      };

      rtcPeerConnection.onnegotiationneeded = async () => {
        if (isOffer && this.isNegotiationNeeded) {
          try {
            let offer = rtcPeerConnection.createOffer();
            await rtcPeerConnection.setLocalDescription(offer);
            this.sendSdp(rtcPeerConnection.localDescription);
            this.isNegotiationNeeded = false;
          } catch (e) {
            console.error(e);
          }
        }
      };

      rtcPeerConnection.oniceconnectionstatechange = () => {
        switch (rtcPeerConnection.iceConnectionState) {
          case "closed":
          case "failed":
            if (this.rtcPeerConnection) {
              this.hangUp();
            }
        }
      };

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => {
          rtcPeerConnection.addTrack(track, this.mediaStream);
        });
      }

      return rtcPeerConnection;
    },

    sendSdp(rtcSessionDescription) {
      this.textForSendingSdp = rtcSessionDescription.sdp;
      const message = JSON.stringify(rtcSessionDescription);
      this.webSocket.send(message);
    },

    connect() {
      if (!this.rtcPeerConnection) {
        this.rtcPeerConnection = this.prepareNewConnection(true);
      }
    },

    async makeAnswer() {
      if (this.rtcPeerConnection) {
        try {
          let answer = await this.rtcPeerConnection.createAnswer();
          await this.rtcPeerConnection.setLocalDescription(answer);
          this.sendSdp(this.rtcPeerConnection.localDescription);
        } catch (e) {
          console.error(e);
        }
      }
    },

    async setOffer(rtcSessionDescription) {
      try {
        this.rtcPeerConnection = this.prepareNewConnection(false);
        await this.rtcPeerConnection.setRemoteDescription(
          rtcSessionDescription
        );
        await this.makeAnswer();
      } catch (e) {
        console.log(e);
      }
    },

    async setAnswer(rtcSessionDescription) {
      if (this.rtcPeerConnection) {
        try {
          await this.rtcPeerConnection.setRemoteDescription(
            rtcSessionDescription
          );
        } catch (e) {
          console.log(e);
        }
      }
    },

    hangUp() {
      if (
        this.rtcPeerConnection &&
        this.rtcPeerConnection.iceConnectionState !== "closed"
      ) {
        this.rtcPeerConnection.close();
        this.rtcPeerConnection = null;
        this.isNegotiationNeeded = true;

        const message = JSON.stringify({ type: "close" });
        this.webSocket.send(message);

        this.cleanVideo(this.$refs.remoteVideo);
        this.textForSendingSdp = "";
        this.textForReceivingSdp = "";
      }
    },

    cleanVideo(video) {
      video.pause();
      video.srcObject = null;
    },

    init() {
      const webSocketUrl = "ws://localhost:3001";
      this.webSocket = new WebSocket(webSocketUrl);

      this.webSocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case "offer":
            try {
              this.textForReceivingSdp = message.sdp;
              await this.setOffer(message);
            } catch (e) {
              console.error(e);
            }
            break;
          case "answer":
            try {
              this.textForReceivingSdp = message.sdp;
              await this.setAnswer(message);
            } catch (e) {
              console.error(e);
            }
            break;
          case "candidate":
            const candidate = new RTCIceCandidate(message.ice);
            this.addCandidate(candidate);
            break;
          case "close":
            this.hangUp();
        }
      };
    },

    addCandidate(rtcIceCandidate) {
      if (this.rtcPeerConnection) {
        this.rtcPeerConnection.addIceCandidate(rtcIceCandidate);
      }
    },

    sendCandidate(rtcIceCandidate) {
      const message = JSON.stringify({
        type: "candidate",
        ice: rtcIceCandidate,
      });
      this.webSocket.send(message);
    },
  };
}
