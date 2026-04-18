'use client';

import { useState, useRef, useCallback } from 'react';

type BufferedChunk = {
  blob: Blob;
  timestamp: number;
};

type UseAudioOptions = {
  bufferWindowMs?: number;
  vadCheckIntervalMs?: number;
  onAutoCapture?: (blob: Blob) => void | Promise<void>;
};

export function useAudio(options: UseAudioOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<BufferedChunk[]>([]);
  const streamStartChunk = useRef<Blob | null>(null);
  // Store stream to avoid re-prompting
  const streamRef = useRef<MediaStream | null>(null);
  const vadTimerRef = useRef<number | null>(null);
  const flushTimerRef = useRef<number | null>(null);

  const bufferWindowMs = options.bufferWindowMs ?? 60_000;
  const vadCheckIntervalMs = options.vadCheckIntervalMs ?? 30_000;

  const pruneBuffer = useCallback((now = Date.now()) => {
    const cutoff = now - bufferWindowMs;
    audioChunks.current = audioChunks.current.filter(chunk => chunk.timestamp >= cutoff);
  }, [bufferWindowMs]);

  const buildBufferedBlob = useCallback((): Blob | null => {
    pruneBuffer();
    if (audioChunks.current.length === 0) return null;

    const parts = audioChunks.current.map(chunk => chunk.blob);
    // Rolling pruning can drop container headers; prepend session start chunk when needed.
    if (streamStartChunk.current && parts[0] !== streamStartChunk.current) {
      parts.unshift(streamStartChunk.current);
    }
    const type = parts[0]?.type || 'audio/webm';
    return new Blob(parts, { type });
  }, [pruneBuffer]);

  const consumeBufferedBlob = useCallback((): Blob | null => {
    const blob = buildBufferedBlob();
    audioChunks.current = [];
    return blob;
  }, [buildBufferedBlob]);

  const consumeBufferedBlobFresh = useCallback(async (): Promise<Blob | null> => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      try {
        mediaRecorder.current.requestData();
        await new Promise(resolve => window.setTimeout(resolve, 0));
      } catch {
        // Best effort only.
      }
    }

    return buildBufferedBlob();
  }, [buildBufferedBlob]);

  const clearVadTimer = useCallback(() => {
    if (vadTimerRef.current !== null) {
      window.clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
  }, []);

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current !== null) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const stopStreamingResources = useCallback(() => {
    clearVadTimer();
    clearFlushTimer();
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      try {
        mediaRecorder.current.requestData();
      } catch {
        // Ignore if recorder cannot flush at this moment.
      }
      mediaRecorder.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    mediaRecorder.current = null;
  }, [clearVadTimer, clearFlushTimer]);

  // Initialize the constant listener (60s buffer)
  const startListening = useCallback(async () => {
    if (streamRef.current || mediaRecorder.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 2 },
          sampleRate: { ideal: 48000 },
        },
      });
      streamRef.current = stream;

      const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/webm',
      ];
      const supportedMime = mimeCandidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));
      const recorderOptions: MediaRecorderOptions = supportedMime
        ? { mimeType: supportedMime, audioBitsPerSecond: 256000 }
        : { audioBitsPerSecond: 256000 };
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorder.current = recorder;
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          if (!streamStartChunk.current) {
            streamStartChunk.current = e.data;
          }
          audioChunks.current.push({ blob: e.data, timestamp: Date.now() });
          pruneBuffer();
        }
      };
      
      // Start recorder and request periodic flushes for stable chunk cadence.
      recorder.start();
      clearFlushTimer();
      flushTimerRef.current = window.setInterval(() => {
        if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
          try {
            mediaRecorder.current.requestData();
          } catch {
            // Some browsers can throw briefly during internal transitions.
          }
        }
      }, 1000);
      clearVadTimer();
      vadTimerRef.current = window.setInterval(async () => {
        pruneBuffer();
        if (!options.onAutoCapture) return;
        if (audioChunks.current.length === 0) return;

        const oldest = audioChunks.current[0]?.timestamp ?? 0;
        const bufferAge = Date.now() - oldest;
        if (bufferAge < bufferWindowMs) return;

        const blob = buildBufferedBlob();
        if (blob) {
          await options.onAutoCapture(blob);
        }
      }, vadCheckIntervalMs);

      setIsListening(true);
      setIsRecording(true);
      setAudioError(null);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setAudioError("Microphone access denied. Please allow microphone permissions.");
      setIsListening(false);
    }
  }, [bufferWindowMs, buildBufferedBlob, clearFlushTimer, clearVadTimer, options, pruneBuffer, vadCheckIntervalMs]);

  const stopListening = useCallback(() => {
    stopStreamingResources();
    setIsListening(false);
    setIsRecording(false);
    audioChunks.current = [];
    streamStartChunk.current = null;
  }, [stopStreamingResources]);

  const startRecording = useCallback(() => {
    if (!isListening) {
      startListening();
    } else {
      setIsRecording(true);
    }
  }, [isListening, startListening]);

  const toggleRecording = useCallback(async () => {
    if (isListening) {
      stopListening();
      return;
    }

    await startListening();
  }, [isListening, startListening, stopListening]);

  // Stops intentional recording and returns the blob immediately
  const stopRecordingAndGetBlob = useCallback((): Promise<Blob | null> => {
    return consumeBufferedBlobFresh();
  }, [consumeBufferedBlobFresh]);

  // Normal "Capture" = get the last 60s and start a fresh buffer window
  const getBufferedBlob = useCallback((): Blob | null => {
    return consumeBufferedBlob();
  }, [consumeBufferedBlob]);

  const getBufferedBlobFresh = useCallback(async (): Promise<Blob | null> => {
    return consumeBufferedBlobFresh();
  }, [consumeBufferedBlobFresh]);

  const peekBufferedBlob = useCallback((): Blob | null => {
    return buildBufferedBlob();
  }, [buildBufferedBlob]);

  const getBufferedDurationSeconds = useCallback((): number => {
    pruneBuffer();
    if (audioChunks.current.length === 0) return 0;

    const firstTimestamp = audioChunks.current[0]?.timestamp ?? 0;
    const lastTimestamp = audioChunks.current[audioChunks.current.length - 1]?.timestamp ?? firstTimestamp;
    const durationSeconds = (lastTimestamp - firstTimestamp) / 1000;
    return Math.max(1, Math.round(durationSeconds));
  }, [pruneBuffer]);

  return {
    isListening,
    isRecording,
    audioError,
    startListening,
    stopListening,
    startRecording,
    toggleRecording,
    stopRecordingAndGetBlob,
    getBufferedBlob,
    getBufferedBlobFresh,
    peekBufferedBlob,
    consumeBufferedBlob,
    getBufferedDurationSeconds
  };
}
