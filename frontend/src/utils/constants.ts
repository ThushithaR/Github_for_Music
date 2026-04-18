import { Clip, ChipDefinition } from '@/types';

export const DEFAULT_CLIPS: Clip[] = [
  { id: 'K7R2', name: 'Midnight Keys', bpm: 84, key: 'A min', mood: 'melancholic', instrument: 'piano', session: 'Session A', ago: '2h ago', type: 'root', parent: null, children: ['B9W4'], duration: '0:32', tags: ['lofi', 'acoustic', 'atmospheric'] },
  { id: 'B9W4', name: 'Rainy Day Var', bpm: 84, key: 'A min', mood: 'chill', instrument: 'piano + pad', session: 'Session A', ago: '1h ago', type: 'branch', parent: 'K7R2', children: ['M3X1'], duration: '0:28', tags: ['chill', 'ambient'] },
  { id: 'D5F1', name: 'Gritty Bass', bpm: 120, key: 'E min', mood: 'dark', instrument: 'synth bass', session: 'Session B', ago: '4h ago', type: 'root', parent: null, children: ['M3X1'], duration: '0:15', tags: ['driving', 'percussive'] },
  { id: 'M3X1', name: 'Dark Fusion', bpm: 102, key: 'E min', mood: 'tense', instrument: 'piano + synth bass', session: 'Session B', ago: '45m ago', type: 'merge', parent: 'B9W4 + D5F1', children: [], duration: '0:40', tags: ['hybrid', 'cinematic'] },
  { id: 'X2P9', name: 'Vocal Hook', bpm: 95, key: 'C maj', mood: 'bright', instrument: 'vocals', session: 'Session C', ago: '1d ago', type: 'root', parent: null, children: ['Y7K2'], duration: '0:12', tags: ['vocal', 'pop'] },
  { id: 'Y7K2', name: 'Vocal Stack', bpm: 95, key: 'C maj', mood: 'upbeat', instrument: 'vocals', session: 'Session C', ago: '20h ago', type: 'version', parent: 'X2P9', children: [], duration: '0:12', tags: ['vocal', 'harmonized'] },
  { id: 'J4M7', name: 'Dusty Drums', bpm: 90, key: 'None', mood: 'chill', instrument: 'drums', session: 'Session D', ago: '3h ago', type: 'root', parent: null, children: [], duration: '1:00', tags: ['lofi', 'raw'] },
  { id: 'H1N5', name: 'Morning Dew', bpm: 72, key: 'G maj', mood: 'bright', instrument: 'acoustic guitar', session: 'Session E', ago: '30m ago', type: 'root', parent: null, children: [], duration: '0:45', tags: ['acoustic', 'bright'] },
  { id: 'S9V3', name: 'Neon Pulsar', bpm: 128, key: 'F# min', mood: 'energetic', instrument: 'synth', session: 'Session F', ago: '5h ago', type: 'root', parent: null, children: [], duration: '0:35', tags: ['electronic', 'driving'] },
  { id: 'L8T4', name: 'Static Void', bpm: 60, key: 'None', mood: 'dark', instrument: 'noise generator', session: 'Session G', ago: '10h ago', type: 'root', parent: null, children: [], duration: '1:20', tags: ['ambient', 'experimental'] }
];

export const CHIP_DEFINITIONS: ChipDefinition[] = [
  { key: 'mood_chill', label: 'Chill', fn: c => c.mood === 'chill' },
  { key: 'mood_dark', label: 'Dark', fn: c => c.mood === 'dark' },
  { key: 'mood_melancholic', label: 'Melancholic', fn: c => c.mood === 'melancholic' },
  { key: 'type_root', label: 'Roots Only', fn: c => c.type === 'root' },
  { key: 'type_branch', label: 'Branches Only', fn: c => c.type === 'branch' },
  { key: 'type_merge', label: 'Merges Only', fn: c => c.type === 'merge' },
  { key: 'fast_bpm', label: '> 120 BPM', fn: c => c.bpm > 120 },
  { key: 'short_clips', label: '< 20s', fn: c => {
    const [m, s] = c.duration.split(':').map(Number);
    return (m * 60 + s) < 20;
  }}
];

export const KEYS = ['A min', 'C maj', 'G maj', 'E min', 'D maj', 'F maj', 'B min', 'Bb maj', 'F# min'];
export const MOODS = ['melancholic', 'dark', 'energetic', 'bright', 'chill', 'upbeat', 'tense'];
export const INSTRUMENTS = ['guitar', 'piano', 'synth', 'drums', 'bass + synth', 'guitar + bass', 'keys', 'violin + pad'];
export const TAG_SUGGESTIONS = [['lofi', 'acoustic'], ['piano', 'bright'], ['synth', 'electronic'], ['chill', 'atmospheric'], ['dark', 'ambient'], ['percussive', 'raw'], ['vocal', 'upbeat'], ['energetic', 'full'], ['ambient', 'late-night'], ['hybrid', 'driving']];
export const SESSION_LETTERS = 'EFGHIJKLMNOPQRSTUVWXYZ';

export const VIEW_NAMES = {
  vault: 'THE VAULT',
  map: 'EVOLUTION MAP',
  search: 'SEMANTIC SEARCH',
  timeline: 'SESSION TIMELINE'
} as const;

export const NODE_COLORS = {
  root: '#D4883A',
  branch: '#3D7A5C',
  merge: '#6B4F88',
  version: '#4A5A99'
};

export const NODE_BG = {
  root: 'rgba(212,136,58,.1)',
  branch: 'rgba(61,122,92,.1)',
  merge: 'rgba(107,79,136,.1)',
  version: 'rgba(74,90,153,.1)'
};

export const EDGE_COLORS = {
  branch: 'rgba(61,122,92,.7)',
  merge: 'rgba(107,79,136,.7)',
  version: 'rgba(74,90,153,.7)'
};
