function app() {
  return {
    /**
     * @type {string}
     */
    textForSendingSdp: "",

    /**
     * @type {string}
     */
    textForReceivingSdp: "",

    /**
     * @type {MediaStream|null}
     */
    mediaStream: null,

    /**
     * @type {RTCPeerConnection|null}
     */
    rtcPeerConnection: null,

    /**
     * @type {boolean}
     */
    isNegotiationNeeded: true,

    /**
     * @type {WebSocket|null}
     */
    webSocket: null,

    /**
     * ビデオを開始する
     */
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

    /**
     * ビデオを接続する
     *
     * @param {*} video
     * @param {MediaStream} mediaStream
     */
    async playVideo(video, mediaStream) {
      try {
        video.srcObject = mediaStream;
        await video.play();
      } catch (e) {
        console.error(e);
      }
    },

    /**
     * コネクションを作成する
     *
     * @param {boolean} isOffer
     * @returns {RTCPeerConnection}
     */
    newRtcPeerConnection(isOffer) {
      const rtcPeerConnection = new RTCPeerConnection({
        // STUN サーバーを設定する
        iceServers: [{ urls: "stun:stun.webrtc.ecl.ntt.com:3478" }],
      });

      rtcPeerConnection.ontrack = async (event) => {
        // リモートの MediaStreamTrack を受信した場合
        try {
          await this.playVideo(this.$refs.remoteVideo, event.streams[0]);
        } catch (e) {
          console.error(e);
        }
      };

      rtcPeerConnection.onicecandidate = (event) => {
        // ICE Candidate を収集した場合
        if (event.candidate) {
          this.sendRtcIceCandidate(event.candidate);
        }
      };

      rtcPeerConnection.onnegotiationneeded = async () => {
        // Offer 側でネゴシエーションを必要とする場合
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
        // ICE のステータスが変更された場合
        switch (rtcPeerConnection.iceConnectionState) {
          case "closed":
          case "failed":
            if (this.rtcPeerConnection) {
              // 通信終了
              this.hangUp();
            }
        }
      };

      if (this.mediaStream) {
        // ローカルの MediaStreamTrack を追加する
        this.mediaStream.getTracks().forEach((track) => {
          rtcPeerConnection.addTrack(track, this.mediaStream);
        });
      }

      return rtcPeerConnection;
    },

    /**
     * SDP を送信する
     *
     * @param {RTCSessionDescription} rtcSessionDescription
     */
    sendSdp(rtcSessionDescription) {
      this.textForSendingSdp = rtcSessionDescription.sdp;
      const message = JSON.stringify(rtcSessionDescription);
      this.webSocket.send(message);
    },

    /**
     * Offer 処理を開始する
     */
    connect() {
      if (!this.rtcPeerConnection) {
        this.rtcPeerConnection = this.newRtcPeerConnection(true);
      }
    },

    /**
     * Answer 処理を開始する
     */
    async answer() {
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

    /**
     * Offer 側の SDP を設定する
     *
     * @param {RTCSessionDescription} rtcSessionDescription
     */
    async setOfferSdp(rtcSessionDescription) {
      if (!this.rtcPeerConnection) {
        try {
          this.rtcPeerConnection = this.newRtcPeerConnection(false);
          await this.rtcPeerConnection.setRemoteDescription(
            rtcSessionDescription
          );
        } catch (e) {
          console.log(e);
        }
      }
    },

    /**
     * Answer 側の SDP を設定する
     *
     * @param {RTCSessionDescription} rtcSessionDescription
     */
    async setAnswerSdp(rtcSessionDescription) {
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

    /**
     * P2P 接続を切断する
     */
    hangUp() {
      if (
        this.rtcPeerConnection &&
        this.rtcPeerConnection.iceConnectionState !== "closed"
      ) {
        this.$refs.remoteVideo.pause();
        this.$refs.remoteVideo.srcObject = null;
        this.textForSendingSdp = "";
        this.textForReceivingSdp = "";

        // コネクションを切断する
        this.rtcPeerConnection.close();
        this.rtcPeerConnection = null;
        this.isNegotiationNeeded = true;

        // リモートを切断する
        const message = JSON.stringify({ type: "close" });
        this.webSocket.send(message);
      }
    },

    /**
     * 初期処理
     */
    init() {
      // シグナリングサーバーに接続する
      this.webSocket = new WebSocket("ws://localhost:3001");

      this.webSocket.onmessage = async (event) => {
        // シグナリングサーバーからメッセージを受信した場合
        const message = JSON.parse(event.data);
        switch (message.type) {
          case "offer":
            try {
              this.textForReceivingSdp = message.sdp;
              await this.setOfferSdp(message);
              await this.answer();
            } catch (e) {
              console.error(e);
            }
            break;
          case "answer":
            try {
              this.textForReceivingSdp = message.sdp;
              await this.setAnswerSdp(message);
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

    /**
     * ICE Candidate を追加する
     *
     * @param {RTCIceCandidate} rtcIceCandidate
     */
    addRtcIceCandidate(rtcIceCandidate) {
      if (this.rtcPeerConnection) {
        this.rtcPeerConnection.addIceCandidate(rtcIceCandidate);
      }
    },

    /**
     * ICE Candidate を送信する
     *
     * @param {RTCIceCandidate} rtcIceCandidate
     */
    sendRtcIceCandidate(rtcIceCandidate) {
      const message = JSON.stringify({
        type: "candidate",
        ice: rtcIceCandidate,
      });
      this.webSocket.send(message);
    },
  };
}
