import { SESSION_LETTERS } from './constants';

export function randomPick<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function generateId(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars[randomInt(0, chars.length - 1)];
  }
  return result;
}

let sessionIndex = 0;
export function getNextSession(): string {
  const session = 'Session ' + SESSION_LETTERS[sessionIndex % SESSION_LETTERS.length];
  sessionIndex++;
  return session;
}

export function resetSessionIndex(): void {
  sessionIndex = 0;
}

export function setSessionIndex(index: number): void {
  sessionIndex = index;
}

const waveformCache: Record<string, number[]> = {};
export function getWaveform(id: string, bars: number = 38): number[] {
  const key = id + '_' + bars;
  if (waveformCache[key]) return waveformCache[key];
  
  let seed = 0;
  for (let i = 0; i < id.length; i++) {
    seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  }
  
  const waveform: number[] = [];
  for (let i = 0; i < bars; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    waveform.push(((seed >>> 16) & 0xFFFF) / 65535);
  }
  
  const processed = waveform.map((v, i) => 
    Math.max(0.07, v * 0.55 + Math.sin(Math.PI * i / bars) * 0.45)
  );
  
  waveformCache[key] = processed;
  return processed;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parseDuration(duration: string): number {
  const [mins, secs] = duration.split(':').map(Number);
  return mins * 60 + secs;
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for older browsers
  return Promise.reject(new Error('Clipboard API not available'));
}
