'use client';

import { useEffect, useRef } from 'react';

interface LiveVisualizerProps {
  analyser: AnalyserNode | null;
  bufferLength: number; // 0 to 30
}

export default function LiveVisualizer({ analyser, bufferLength }: LiveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLengthData = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLengthData);
    let animationFrameId: number;

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      // Dark background
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#D4883A'; // Amber wave
      ctx.beginPath();

      const sliceWidth = canvas.width * 1.0 / bufferLengthData;
      let x = 0;

      for (let i = 0; i < bufferLengthData; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * (canvas.height / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();

    return () => cancelAnimationFrame(animationFrameId);
  }, [analyser]);

  // Calculate buffer percentage (max 30 seconds)
  const bufferPercent = Math.min((bufferLength / 30) * 100, 100);

  return (
    <div style={{ marginTop: '4px', padding: '6px 10px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#888', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
        <span>LIVE FEED</span>
        <span>{bufferLength}s / 30s</span>
      </div>
      
      {/* Live Waveform Canvas */}
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={32} 
        style={{ width: '100%', height: '32px', borderRadius: '2px', background: '#111' }} 
      />

      {/* Buffer Progress Bar */}
      <div style={{ width: '100%', height: '2px', background: '#333', marginTop: '6px', borderRadius: '1px', overflow: 'hidden' }}>
        <div style={{ 
          height: '100%', 
          width: `${bufferPercent}%`, 
          background: bufferLength === 30 ? '#3D7A5C' : '#D4883A', // Turns green when full
          transition: 'width 1s linear'
        }}></div>
      </div>
    </div>
  );
}
