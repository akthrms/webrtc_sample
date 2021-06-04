function app() {
  return {
    textForSendingSdp: "",
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

    newRtcPeerConnection(isOffer) {
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
          this.sendRtcIceCandidate(event.candidate);
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
        this.rtcPeerConnection = this.newRtcPeerConnection(true);
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
      if (!this.rtcPeerConnection) {
        try {
          this.rtcPeerConnection = this.newRtcPeerConnection(false);
          await this.rtcPeerConnection.setRemoteDescription(
            rtcSessionDescription
          );
          await this.makeAnswer();
        } catch (e) {
          console.log(e);
        }
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
        this.$refs.remoteVideo.pause();
        this.$refs.remoteVideo.srcObject = null;
        this.textForSendingSdp = "";
        this.textForReceivingSdp = "";
        this.rtcPeerConnection.close();
        this.rtcPeerConnection = null;
        this.isNegotiationNeeded = true;
        const message = JSON.stringify({ type: "close" });
        this.webSocket.send(message);
      }
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
            this.addRtcIceCandidate(candidate);
            break;
          case "close":
            this.hangUp();
        }
      };
    },

    addRtcIceCandidate(rtcIceCandidate) {
      if (this.rtcPeerConnection) {
        this.rtcPeerConnection.addIceCandidate(rtcIceCandidate);
      }
    },

    sendRtcIceCandidate(rtcIceCandidate) {
      const message = JSON.stringify({
        type: "candidate",
        ice: rtcIceCandidate,
      });
      this.webSocket.send(message);
    },
  };
}
