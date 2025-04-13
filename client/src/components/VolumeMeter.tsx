"use client";
import React, { useEffect, useRef } from "react";

type Props = {
  analyser: AnalyserNode;
};

export const VolumeMeter: React.FC<Props> = ({ analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
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
      analyser.disconnect(); // precaution
    };
  }, [analyser]);

  return <canvas ref={canvasRef} className="rounded bg-black" />;
};
