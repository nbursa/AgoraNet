"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SIGNALING_SERVER =
  process.env.NEXT_PUBLIC_SIGNALING_SERVER || "http://localhost:8080";

export function useWebRTC(roomId: string) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<{ [id: string]: RTCPeerConnection }>({});

  const leaveRoom = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit("leave-room", roomId);
      socket.disconnect();
    }
    Object.values(peersRef.current).forEach((peer) => peer.close());
    peersRef.current = {};
  }, [roomId]);

  useEffect(() => {
    const socket: Socket = io(SIGNALING_SERVER, { transports: ["websocket"] });
    socketRef.current = socket;

    const start = async () => {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setStream(localStream);

      socket.emit("join-room", roomId);

      socket.on("user-joined", async (userId: string) => {
        const peer = new RTCPeerConnection();
        localStream
          .getTracks()
          .forEach((track) => peer.addTrack(track, localStream));

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit("offer", { room: roomId, userId, offer });

        peer.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice-candidate", {
              room: roomId,
              userId,
              candidate: event.candidate,
            });
          }
        };

        peersRef.current[userId] = peer;
      });

      socket.on("offer", async ({ userId, offer }) => {
        const peer = new RTCPeerConnection();
        localStream
          .getTracks()
          .forEach((track) => peer.addTrack(track, localStream));

        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("answer", { room: roomId, userId, answer });

        peer.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice-candidate", {
              room: roomId,
              userId,
              candidate: event.candidate,
            });
          }
        };

        peersRef.current[userId] = peer;
      });

      socket.on("answer", ({ userId, answer }) => {
        if (peersRef.current[userId]) {
          peersRef.current[userId].setRemoteDescription(
            new RTCSessionDescription(answer)
          );
        }
      });

      socket.on("ice-candidate", ({ userId, candidate }) => {
        if (peersRef.current[userId]) {
          peersRef.current[userId].addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        }
      });

      socket.on("user-left", (userId: string) => {
        if (peersRef.current[userId]) {
          peersRef.current[userId].close();
          delete peersRef.current[userId];
        }
      });

      socket.on("room-closed", (closedRoomId: string) => {
        if (closedRoomId === roomId) {
          leaveRoom();
        }
      });
    };

    start();

    return () => {
      leaveRoom();
    };
  }, [roomId, leaveRoom]);

  return { stream, peers: peersRef.current, leaveRoom };
}
