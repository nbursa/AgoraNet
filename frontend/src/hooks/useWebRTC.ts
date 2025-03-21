"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const SIGNALING_SERVER =
  process.env.NEXT_PUBLIC_SIGNALING_SERVER || "ws://localhost:8081/ws";

type SignalMessage =
  | { type: "join"; roomId: string }
  | { type: "init"; userId: string }
  | { type: "user-joined"; userId: string }
  | { type: "offer"; userId: string; offer: RTCSessionDescriptionInit }
  | { type: "answer"; userId: string; answer: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; userId: string; candidate: RTCIceCandidateInit }
  | { type: "leave"; userId: string };

type RemoteStreamEntry = {
  id: string;
  stream: MediaStream;
};

let wasInitialized = false;

export function useWebRTC(roomId: string) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamEntry[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<{ [id: string]: RTCPeerConnection }>({});
  const userIdRef = useRef<string | null>(null);
  const isJoiningRef = useRef(false);

  const send = useCallback((msg: SignalMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    } else {
      console.warn("❌ WebSocket not open. Skipped:", msg);
    }
  }, []);

  const createPeer = useCallback(
    (userId: string, initiator: boolean): RTCPeerConnection => {
      const existing = peersRef.current[userId];
      if (existing) return existing;

      const peer = new RTCPeerConnection();

      stream?.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          send({
            type: "ice-candidate",
            userId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      peer.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (remoteStream) {
          setRemoteStreams((prev) => {
            const exists = prev.find((s) => s.stream.id === remoteStream.id);
            if (exists) return prev;
            return [...prev, { id: userId, stream: remoteStream }];
          });
        }
      };

      if (initiator) {
        peer
          .createOffer()
          .then((offer) => peer.setLocalDescription(offer))
          .then(() => {
            if (peer.localDescription) {
              send({ type: "offer", userId, offer: peer.localDescription });
            }
          })
          .catch(console.error);
      }

      peersRef.current[userId] = peer;
      return peer;
    },
    [stream, send]
  );

  const leaveRoom = useCallback(() => {
    if (!isJoiningRef.current || !userIdRef.current) {
      console.log("⛔ Skipping leaveRoom — not fully joined.");
      return;
    }

    console.log("👋 Leaving room...");
    send({ type: "leave", userId: userIdRef.current });

    Object.values(peersRef.current).forEach((peer) => peer.close());
    peersRef.current = {};
    setRemoteStreams([]);

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    isJoiningRef.current = false;
    userIdRef.current = null;
  }, [send]);

  useEffect(() => {
    if (wasInitialized) {
      console.log("🟡 Skipping init — already initialized.");
      return;
    }

    wasInitialized = true;
    isJoiningRef.current = false;
    peersRef.current = {};
    setRemoteStreams([]);

    const connect = async () => {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setStream(localStream);
        console.log("🎙️ Got local audio stream");

        const socket = new WebSocket(SIGNALING_SERVER);
        socketRef.current = socket;

        socket.onopen = () => {
          console.log("✅ Connected to signaling server");
        };

        socket.onmessage = async (event) => {
          const message: SignalMessage = JSON.parse(event.data);
          console.log("📨 Message:", message);

          switch (message.type) {
            case "init":
              userIdRef.current = message.userId;
              isJoiningRef.current = true;
              console.log("🆔 Got user ID:", message.userId);
              send({ type: "join", roomId });
              break;

            case "user-joined":
              if (message.userId !== userIdRef.current) {
                createPeer(message.userId, true);
              }
              break;

            case "offer":
              {
                const peer = createPeer(message.userId, false);
                await peer.setRemoteDescription(
                  new RTCSessionDescription(message.offer)
                );
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                send({ type: "answer", userId: message.userId, answer });
              }
              break;

            case "answer":
              {
                const peer = peersRef.current[message.userId];
                if (peer) {
                  await peer.setRemoteDescription(
                    new RTCSessionDescription(message.answer)
                  );
                }
              }
              break;

            case "ice-candidate":
              {
                const peer = peersRef.current[message.userId];
                if (peer) {
                  try {
                    await peer.addIceCandidate(
                      new RTCIceCandidate(message.candidate)
                    );
                  } catch (err) {
                    console.warn("❌ Failed to add ICE candidate:", err);
                  }
                }
              }
              break;

            case "leave":
              {
                const peer = peersRef.current[message.userId];
                if (peer) peer.close();
                delete peersRef.current[message.userId];
                setRemoteStreams((prev) =>
                  prev.filter((s) => s.id !== message.userId)
                );
                console.log(`👋 Peer ${message.userId} left`);
              }
              break;
          }
        };

        socket.onclose = () => {
          console.warn("🔌 WebSocket closed");
          socketRef.current = null;
        };

        socket.onerror = (e) => {
          console.error("WebSocket error:", e);
        };
      } catch (err) {
        console.error("❌ Failed to connect:", err);
      }
    };

    connect();

    return () => {
      console.log("🧹 Cleanup triggered");
      leaveRoom();
    };
  }, [roomId, createPeer, leaveRoom, send]);

  return { stream, remoteStreams, leaveRoom };
}
