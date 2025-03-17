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
    const socket: Socket = io(SIGNALING_SERVER, {
      transports: ["websocket"],
      withCredentials: true,
      reconnection: true,
    });

    socketRef.current = socket;

    const start = async () => {
      try {
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

        socket.on("room-closed", (closedRoomId: string) => {
          if (closedRoomId === roomId) {
            leaveRoom();
          }
        });
      } catch (error) {
        console.error("❌ WebRTC initialization error:", error);
      }
    };

    start();

    return () => {
      leaveRoom();
    };
  }, [roomId, leaveRoom]);

  return { stream, peers: peersRef.current, leaveRoom };
}
