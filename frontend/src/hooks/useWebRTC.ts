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

      // Add local tracks to peer connection
      if (stream) {
        stream.getTracks().forEach((track) => {
          peer.addTrack(track, stream);
        });
      }

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
        console.log("Remote stream received:", remoteStream);

        if (remoteStream) {
          console.log(`Remote stream received from ${userId}`, remoteStream);

          setRemoteStreams((prev) => {
            // Check if the remote stream for this userId already exists
            const exists = prev.some((s) => s.id === userId);

            if (!exists) {
              console.log(`Adding remote stream for userId: ${userId}`);
              // Only add the stream once per userId
              return [...prev, { id: userId, stream: remoteStream }];
            }

            // If the stream already exists, return the previous state (do not add again)
            return prev;
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

              window.dispatchEvent(
                new CustomEvent("plenum-user-id", {
                  detail: { userId: message.userId },
                })
              );
              break;

            case "user-joined":
              if (message.userId !== userIdRef.current) {
                createPeer(message.userId, true);
              }
              break;

            case "offer":
              {
                // Check if the peer connection already exists
                let peer = peersRef.current[message.userId];
                if (!peer) {
                  // If no peer exists, create a new one
                  peer = createPeer(message.userId, false);
                } else {
                  console.log(
                    `Peer connection for ${message.userId} already exists.`
                  );
                }

                // Set the remote description (offer)
                await peer.setRemoteDescription(
                  new RTCSessionDescription(message.offer)
                );

                // Create an answer and set it as local description
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);

                // Send the answer back to the signaling server
                send({ type: "answer", userId: message.userId, answer });
              }
              break;

            case "answer":
              {
                const peer = peersRef.current[message.userId];
                if (peer) {
                  // Check if the signaling state is not stable
                  if (peer.signalingState !== "stable") {
                    // Only set the remote description if it's not stable
                    await peer.setRemoteDescription(
                      new RTCSessionDescription(message.answer)
                    );
                  } else {
                    console.warn(
                      `⚠️ Skipping setRemoteDescription(answer) for ${message.userId} — signalingState: ${peer.signalingState}`
                    );
                  }
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
