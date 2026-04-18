'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudio() {
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [bufferLength, setBufferLength] = useState(0);
  const [threshold, setThreshold] = useState(15);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<BlobPart[]>([]);
  const headerChunkRef = useRef<Blob | null>(null);  // Stores the EBML/WebM header
  const isFirstChunkRef = useRef<boolean>(true);      // Tracks if next chunk is the header
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const volumeMeterRef = useRef<HTMLDivElement | null>(null);
  const speechStartTimeRef = useRef<number>(0);
  const onAutoFragmentRef = useRef<((blob: Blob) => void) | null>(null);

  // Build a valid WebM blob by prepending the stored header to data chunks
  const buildBlob = useCallback((chunks: BlobPart[]): Blob => {
    if (headerChunkRef.current && chunks.length > 0) {
      return new Blob([headerChunkRef.current, ...chunks], { type: 'audio/webm;codecs=opus' });
    }
    // Fallback: if no separate header, chunks[0] likely has the header already
    return new Blob(chunks, { type: 'audio/webm;codecs=opus' });
  }, []);

  // Initialize the ambient listener with voice activation
  const startListening = useCallback(async () => {
    try {
      setAudioError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up Web Audio API analyser for visualizer + volume detection
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      setAnalyserNode(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Force a standard webm format to help FFmpeg parsing
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorder.current = recorder;
      audioChunks.current = [];
      headerChunkRef.current = null;
      isFirstChunkRef.current = true;
      setBufferLength(0);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          // The FIRST chunk from MediaRecorder contains the EBML/WebM header.
          // We store it separately so it's never lost during rolling buffer trimming.
          if (isFirstChunkRef.current) {
            headerChunkRef.current = e.data;
            isFirstChunkRef.current = false;
            console.log('[useAudio] Header chunk captured:', e.data.size, 'bytes');
            return; // Don't add header to the data chunks array
          }

          audioChunks.current.push(e.data);

          // Rolling buffer: keep max ~30 data chunks when not actively recording
          if (!isSpeakingRef.current && audioChunks.current.length > 30) {
            audioChunks.current.shift();
          }
          setBufferLength(audioChunks.current.length);
        }
      };

      // Volume check loop for voice activation
      const currentThreshold = threshold;
      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const volume = sum / dataArray.length;

        // Update volume meter if ref is available
        if (volumeMeterRef.current) {
          volumeMeterRef.current.style.width = `${Math.min(volume * 2, 100)}%`;
          volumeMeterRef.current.style.backgroundColor = volume > currentThreshold ? '#D4883A' : '#555';
        }

        if (volume > currentThreshold) {
          if (!isSpeakingRef.current) {
            isSpeakingRef.current = true;
            setIsSpeaking(true);
            speechStartTimeRef.current = Date.now();
          }

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else {
          if (isSpeakingRef.current && !silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              const speechDuration = Date.now() - speechStartTimeRef.current - 5000;

              isSpeakingRef.current = false;
              setIsSpeaking(false);
              silenceTimerRef.current = null;

              // Auto-fragment: if spoke for at least 1s, save and send
              if (speechDuration >= 1000) {
                autoSaveFragment();
              }
            }, 5000); // 5s silence = end of fragment
          }
        }
        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };

      recorder.start(1000); // 1 chunk per second
      setIsListening(true);
      checkVolume();

    } catch (err) {
      console.error("Error accessing microphone:", err);
      setAudioError("Microphone access denied. Please allow microphone permissions.");
      setIsListening(false);
    }
  }, [threshold]);

  const stopListening = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setIsListening(false);
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    setAnalyserNode(null);
    audioChunks.current = [];
    headerChunkRef.current = null;
    isFirstChunkRef.current = true;
    setBufferLength(0);
  }, []);

  // Auto-fragment: joins current chunks into a valid blob and triggers callback
  const autoSaveFragment = useCallback(() => {
    if (audioChunks.current.length === 0) return;

    // Build a valid WebM blob with the header prepended
    const audioBlob = buildBlob(audioChunks.current);
    console.log('[useAudio] Auto-fragment saved:', audioBlob.size, 'bytes,', audioChunks.current.length, 'chunks + header');

    // Trigger the callback if set (useGoodwinsun hooks into this)
    if (onAutoFragmentRef.current) {
      onAutoFragmentRef.current(audioBlob);
    }

    // Clear data chunks but KEEP the header for the next fragment
    audioChunks.current = [];
    setBufferLength(0);
  }, [buildBlob]);

  // Manual recording (clears buffer, records fresh)
  const startRecording = useCallback(() => {
    audioChunks.current = [];
    setBufferLength(0);
    setIsRecording(true);
    if (!isListening) {
      startListening();
    }
  }, [isListening, startListening]);

  const stopRecordingAndGetBlob = useCallback((): Promise<Blob | null> => {
    setIsRecording(false);

    if (audioChunks.current.length === 0) return Promise.resolve(null);

    // Build a valid WebM blob with the header prepended
    const blob = buildBlob(audioChunks.current);
    console.log('[useAudio] Manual recording blob:', blob.size, 'bytes');
    return Promise.resolve(blob);
  }, [buildBlob]);

  // Get the current rolling buffer as a valid blob
  const getBufferedBlob = useCallback((): Blob | null => {
    if (audioChunks.current.length === 0) return null;
    // Build a valid WebM blob with the header prepended
    const blob = buildBlob(audioChunks.current);
    console.log('[useAudio] Buffer capture blob:', blob.size, 'bytes');
    return blob;
  }, [buildBlob]);

  // Set callback for auto-fragmentation
  const setOnAutoFragment = useCallback((callback: ((blob: Blob) => void) | null) => {
    onAutoFragmentRef.current = callback;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  return {
    isListening,
    isRecording,
    isSpeaking,
    audioError,
    bufferLength,
    threshold,
    setThreshold,
    analyserNode,
    volumeMeterRef,
    startListening,
    stopListening,
    startRecording,
    stopRecordingAndGetBlob,
    getBufferedBlob,
    setOnAutoFragment,
  };
}
