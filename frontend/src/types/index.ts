export interface KeyTimelineChunk {
  start: number;
  end: number;
  key: string;
}

export interface Clip {
  id: string;
  name: string;
  bpm: number;
  key: string;
  mood: string;
  instrument: string;
  session: string;
  ago: string;
  type: 'root' | 'branch' | 'merge' | 'version';
  parent: string | null;
  children: string[];
  duration: string;
  tags: string[];
  isNew?: boolean;
  keyTimeline?: KeyTimelineChunk[];
  x?: number;
  y?: number;
  customConnections?: string[]; // IDs of other clips it connects to
  mergeStrategy?: 'sequential' | 'overlap';
  audioPath?: string;
}

export interface ChipDefinition {
  key: string;
  label: string;
  fn: (clip: Clip) => boolean;
}

export type ViewType = 'vault' | 'map' | 'search' | 'timeline';
export type TabType = 'all' | 'recent' | 'roots' | 'branches' | 'merges';

export interface AppState {
  clips: Clip[];
  activeTab: TabType;
  selectedId: string | null;
  playingId: string | null;
  currentView: ViewType;
  topbarQuery: string;
  activeFilters: Set<string>;
  mergeMode: boolean;
  mergeSourceId: string | null;
  bannerDismissed: boolean;
  userCaptures: number;
  playbackRate: number;
  isEditing: boolean;
  mergeTargetId: string | null;
  isMergeModalOpen: boolean;
}

export interface PendingCapture {
  id: string;
  name: string;
  bpm: number;
  key: string;
  mood: string;
  instrument: string;
  session: string;
  ago: string;
  type: 'root';
  parent: null;
  children: [];
  duration: string;
  keyTimeline?: KeyTimelineChunk[];
  audioPath?: string;
}

export interface GraphNode {
  id: string;
  type: Clip['type'];
  x: number;
  y: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  lbl: string;
}

export interface SessionCluster {
  name: string;
  nodes: string[];
  color: string;
}
