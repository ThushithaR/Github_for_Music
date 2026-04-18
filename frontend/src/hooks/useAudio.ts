'use client';

import { useState, useRef, useCallback } from 'react';

export function useAudio() {
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  // Store stream to avoid re-prompting
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize the constant listener (60s buffer)
  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data);
          // Keep only the last ~60 chunks (if we timeslice at 1000ms = 1s per chunk)
          // To be safe, we keep 65 chunks.
          if (audioChunks.current.length > 65) {
            audioChunks.current.shift();
          }
        }
      };
      
      // Request data every 1000ms (1 second)
      recorder.start(1000);
      setIsListening(true);
      setAudioError(null);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setAudioError("Microphone access denied. Please allow microphone permissions.");
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsListening(false);
    audioChunks.current = [];
  }, []);

  // For "intentional" recording, we might want to clear the buffer first,
  // or just note the start time. To keep it simple, we use the same buffer.
  const startRecording = useCallback(() => {
    // Clear buffer so we only get what happens from NOW on
    audioChunks.current = [];
    setIsRecording(true);
    if (!isListening) {
      startListening();
    }
  }, [isListening, startListening]);

  // Stops intentional recording and returns the blob immediately
  const stopRecordingAndGetBlob = useCallback((): Promise<Blob | null> => {
    setIsRecording(false);
    
    // If not listening, nothing to return
    if (audioChunks.current.length === 0) return Promise.resolve(null);
    
    const blob = new Blob(audioChunks.current, { type: audioChunks.current[0].type });
    // Keep listening/buffering, but we return what we have so far
    return Promise.resolve(blob);
  }, []);

  // Normal "Capture" = get the last 60s
  const getBufferedBlob = useCallback((): Blob | null => {
    if (audioChunks.current.length === 0) return null;
    return new Blob(audioChunks.current, { type: audioChunks.current[0]?.type || 'audio/webm' });
  }, []);

  return {
    isListening,
    isRecording,
    audioError,
    startListening,
    stopListening,
    startRecording,
    stopRecordingAndGetBlob,
    getBufferedBlob
  };
}
