"use client";
import React, { useEffect, useRef } from "react";

type Props = {
  stream: MediaStream;
};

export const VolumeMeter: React.FC<Props> = ({ stream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    analyser.fftSize = 512;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    canvas.width = 100;
    canvas.height = 10;

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);
      const volume =
        dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 256;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "lime";
      ctx.fillRect(0, 0, volume * canvas.width, canvas.height);

      requestAnimationFrame(draw);
    };

    draw();

    return () => {
      source.disconnect();
      analyser.disconnect();
      audioContext.close();
    };
  }, [stream]);

  return <canvas ref={canvasRef} className="rounded bg-black" />;
};
