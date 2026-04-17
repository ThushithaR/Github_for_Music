'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudio } from './useAudio';
import { AppState, Clip, ViewType, TabType, PendingCapture, KeyTimelineChunk } from '@/types';
import { DEFAULT_CLIPS, CHIP_DEFINITIONS, VIEW_NAMES } from '@/utils/constants';
import { randomPick, randomInt, generateId, getNextSession, getWaveform } from '@/utils/helpers';

const initialState: AppState = {
  clips: DEFAULT_CLIPS.map(c => ({ ...c, children: [...c.children] })),
  activeTab: 'all',
  selectedId: null,
  playingId: null,
  currentView: 'vault',
  topbarQuery: '',
  activeFilters: new Set(),
  mergeMode: false,
  mergeSourceId: null,
  bannerDismissed: false,
  userCaptures: 0,
  playbackRate: 1.0,
  isEditing: false,
};

export function useGoodwinsunInternal() {
  const audio = useAudio();
  const [state, setState] = useState<AppState>(initialState);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const [captureModalVisible, setCaptureModalVisible] = useState(false);
  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(null);
  const [cmTags, setCmTags] = useState<string[]>([]);
  const [toasts, setToasts] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [playbackSequence, setPlaybackSequence] = useState<string[]>([]);
  
  const bufferStartRef = useRef(Date.now());
  const cpPhaseRef = useRef(0);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedClips = localStorage.getItem('gs_clips');
      const savedSessIdx = localStorage.getItem('gs_sessIdx');
      const savedBanner = localStorage.getItem('gs_banner');
      
      if (savedClips) {
        setState(prev => ({
          ...prev,
          clips: JSON.parse(savedClips).map((c: Clip) => ({ ...c, children: [...c.children] }))
        }));
      }
      
      if (savedSessIdx) {
        // Set session index from saved data
      }
      
      if (savedBanner === 'true') {
        setState(prev => ({ ...prev, bannerDismissed: true }));
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  }, []);

  // Save to localStorage
  const saveToDisk = useCallback(() => {
    try {
      localStorage.setItem('gs_clips', JSON.stringify(state.clips));
      localStorage.setItem('gs_banner', state.bannerDismissed.toString());
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }, [state.clips, state.bannerDismissed]);

  // Auto-save when clips change
  useEffect(() => {
    saveToDisk();
  }, [state.clips, saveToDisk]);

  // View management
  const setView = useCallback((view: ViewType) => {
    setState(prev => ({ ...prev, currentView: view }));
    if (state.mergeMode && view !== 'vault') {
      cancelMergeMode();
    }
  }, [state.mergeMode]);

  const openCaptureModal = useCallback((capture: PendingCapture) => {
    setPendingCapture(capture);
    setCmTags([]);
    setCaptureModalVisible(true);
  }, []);

  // Capture functionality
  const handleCapture = useCallback(async (customBlob?: Blob) => {
    if (capturing) return;
    
    setCapturing(true);
    
    const blob = customBlob || audio.getBufferedBlob();
    let bpm = randomInt(70, 145);
    let key = randomPick(['A min', 'C maj', 'G maj', 'E min', 'D maj', 'F maj', 'B min', 'Bb maj', 'F# min']);
    let mood = randomPick(['melancholic', 'dark', 'energetic', 'bright', 'chill', 'upbeat', 'tense']);
    let keyTimeline: KeyTimelineChunk[] = [];
    
    if (blob) {
      try {
        const formData = new FormData();
        formData.append('file', blob, 'capture.webm');
        
        const res = await fetch('http://localhost:8000/api/analyze', {
          method: 'POST',
          body: formData,
        });
        
        if (res.ok) {
          const data = await res.json();
          bpm = data.bpm || bpm;
          key = data.key || key;
          mood = data.mood || mood;
          keyTimeline = data.key_timeline || [];
        }
      } catch (err) {
        console.error('Failed to communicate with analysis API', err);
      }
    } else {
      // No blob captured (mic off), simulating 1.5s delay
      await new Promise(r => setTimeout(r, 1500));
    }
    
    let newId = generateId();
    while (state.clips.find(c => c.id === newId)) {
      newId = generateId();
    }
    
    const newCapture: PendingCapture = {
      id: newId,
      name: '',
      bpm,
      key,
      mood,
      instrument: randomPick(['guitar', 'piano', 'synth', 'drums', 'bass + synth', 'guitar + bass', 'keys', 'violin + pad']),
      session: getNextSession(),
      ago: 'just now',
      type: 'root',
      parent: null,
      children: [],
      duration: blob ? `0:30` : `0:${randomInt(15, 55)}`, // Simple default
      keyTimeline,
    };
    
    setPendingCapture(newCapture);
    setCapturing(false);
    openCaptureModal(newCapture);
  }, [capturing, state.clips, audio, openCaptureModal]);

  const closeCaptureModal = useCallback(() => {
    setCaptureModalVisible(false);
    setPendingCapture(null);
    setCmTags([]);
  }, []);

  const saveCapture = useCallback(() => {
    if (!pendingCapture) return;
    
    const newClip: Clip = {
      ...pendingCapture,
      name: pendingCapture.name || `Fragment ${pendingCapture.id}`,
      tags: [...cmTags],
      isNew: true,
    };
    
    // Avoid duplicate IDs
    let finalId = newClip.id;
    if (state.clips.find(c => c.id === finalId)) {
      finalId = generateId();
      newClip.id = finalId;
    }
    
    setState(prev => ({
      ...prev,
      clips: [newClip, ...prev.clips],
      userCaptures: prev.userCaptures + 1,
      bannerDismissed: true,
    }));
    
    closeCaptureModal();
    showToast(`SAVED ${newClip.name}`);
    
    setTimeout(() => {
      selectClip(finalId);
    }, 80);
    
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        clips: prev.clips.map(c => 
          c.id === finalId ? { ...c, isNew: false } : c
        )
      }));
    }, 3500);
  }, [pendingCapture, cmTags, state.clips, closeCaptureModal]);

  const discardCapture = useCallback(() => {
    closeCaptureModal();
    showToast('Capture discarded');
  }, [closeCaptureModal]);

  // Search functionality
  const handleTopbarSearch = useCallback((query: string) => {
    setState(prev => ({ ...prev, topbarQuery: query }));
  }, []);

  const clearTopbarSearch = useCallback(() => {
    setState(prev => ({ ...prev, topbarQuery: '' }));
  }, []);

  const handleSemanticSearch = useCallback((query: string) => {
    // For now, just update the query - in real implementation this would search
    console.log('Semantic search:', query);
  }, []);

  const triggerSuggestion = useCallback((suggestion: string) => {
    // For now, just log the suggestion - in real implementation this would trigger search
    console.log('Suggestion triggered:', suggestion);
    handleSemanticSearch(suggestion);
  }, [handleSemanticSearch]);

  // Tab management
  const setTab = useCallback((tab: TabType) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  // Filter management
  const toggleFilter = useCallback((key: string) => {
    setState(prev => {
      const newFilters = new Set(prev.activeFilters);
      if (newFilters.has(key)) {
        newFilters.delete(key);
      } else {
        newFilters.add(key);
      }
      return { ...prev, activeFilters: newFilters };
    });
  }, []);

  const toggleTagFilter = useCallback((tag: string) => {
    const key = `tag_${tag}`;
    setState(prev => {
      const newFilters = new Set(prev.activeFilters);
      if (newFilters.has(key)) {
        newFilters.delete(key);
      } else {
        newFilters.add(key);
      }
      return { ...prev, activeFilters: newFilters };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setState(prev => ({ ...prev, activeFilters: new Set() }));
  }, []);

  const getActiveFilters = useCallback(() => {
    return Array.from(state.activeFilters).map(key => {
      const chipdef = CHIP_DEFINITIONS.find((c: any) => c.key === key);
      return chipdef || { key, label: key };
    });
  }, [state.activeFilters]);

  const getTabCounts = useCallback(() => {
    const clips = state.clips;
    return {
      all: clips.length,
      recent: clips.filter((c: Clip) => {
        const [m, s] = c.duration.split(':').map(Number);
        const totalSeconds = m * 60 + s;
        return totalSeconds < 60 * 60; // Less than 1 hour
      }).length,
      roots: clips.filter(c => c.type === 'root').length,
      branches: clips.filter(c => c.type === 'branch').length,
      merges: clips.filter(c => c.type === 'merge').length,
    };
  }, [state.clips]);

  // Clip selection and playback
  const selectClip = useCallback((id: string) => {
    // Handle merge mode
    if (state.mergeMode && state.mergeSourceId && state.mergeSourceId !== id) {
      const sourceClip = state.clips.find(c => c.id === state.mergeSourceId);
      const targetClip = state.clips.find(c => c.id === id);
      
      if (sourceClip && targetClip) {
        const mergedClip: Clip = {
          id: generateId(),
          name: `${sourceClip.name} + ${targetClip.name}`,
          bpm: Math.round((sourceClip.bpm + targetClip.bpm) / 2),
          key: sourceClip.key,
          mood: sourceClip.mood,
          instrument: `${sourceClip.instrument} + ${targetClip.instrument}`,
          session: sourceClip.session,
          ago: 'just now',
          type: 'merge',
          parent: `${sourceClip.id} + ${targetClip.id}`,
          children: [],
          duration: `0:${Math.floor((parseInt(sourceClip.duration.split(':')[1]) + parseInt(targetClip.duration.split(':')[1])) / 2)}`,
          tags: [...new Set([...sourceClip.tags, ...targetClip.tags])],
        };
        
        setState(prev => ({
          ...prev,
          clips: [mergedClip, ...prev.clips],
          mergeMode: false,
          mergeSourceId: null,
          selectedId: mergedClip.id,
        }));
        
        showToast(`Created merge: ${mergedClip.id}`);
        return;
      }
    }
    
    setState(prev => ({ ...prev, selectedId: id, isEditing: false }));
  }, [state.mergeMode, state.mergeSourceId, state.clips]);

  const togglePlay = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      playingId: prev.playingId === id ? null : id
    }));
  }, []);

  const closeDetail = useCallback(() => {
    if (state.mergeMode) {
      cancelMergeMode();
      return;
    }
    setState(prev => ({
      ...prev,
      selectedId: null,
      isEditing: false,
      playbackRate: 1.0
    }));
  }, [state.mergeMode]);

  // Merge functionality
  const cancelMergeMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      mergeMode: false,
      mergeSourceId: null
    }));
  }, []);

  // Banner management
  const dismissBanner = useCallback(() => {
    setState(prev => ({ ...prev, bannerDismissed: true }));
  }, []);

  // Shortcuts
  const toggleShortcuts = useCallback(() => {
    setShortcutsVisible(prev => !prev);
  }, []);

  // Toasts
  const showToast = useCallback((message: string) => {
    setToasts(prev => [...prev, message]);
    setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 2600);
  }, []);

  // Detail panel functions
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const updateClipPosition = useCallback((id: string, x: number, y: number) => {
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => c.id === id ? { ...c, x, y } : c)
    }));
  }, []);

  const updateClipSession = useCallback((id: string, session: string) => {
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => c.id === id ? { ...c, session } : c)
    }));
  }, []);

  const checkCycle = useCallback((startId: string, targetId: string) => {
    // DFS from target to see if we can reach start (backwards flow)
    const stack = [targetId];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node === startId) return true;
      
      if (!visited.has(node)) {
        visited.add(node);
        const clip = state.clips.find(c => c.id === node);
        if (clip) {
          if (clip.children) clip.children.forEach(c => stack.push(c));
          if (clip.customConnections) clip.customConnections.forEach(c => stack.push(c));
        }
      }
    }
    return false;
  }, [state.clips]);

  const findPath = useCallback((sourceId: string, destId: string) => {
    const stack: { node: string, path: string[] }[] = [{ node: sourceId, path: [sourceId] }];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const { node, path } = stack.pop()!;
      if (node === destId) return path;

      if (!visited.has(node)) {
        visited.add(node);
        const clip = state.clips.find(c => c.id === node);
        if (clip) {
          const neighbors = [...(clip.children || []), ...(clip.customConnections || [])];
          for (const n of neighbors) {
            if (!visited.has(n)) {
              stack.push({ node: n, path: [...path, n] });
            }
          }
        }
      }
    }
    return null;
  }, [state.clips]);

  /**
   * Returns a Set of all node IDs that can reach `destId` by following
   * forward edges (children + customConnections). Used to filter which
   * outgoing neighbors are still on a valid path toward the destination,
   * so the branch picker popup only shows up when multiple RELEVANT
   * branches exist — not every time any node has multiple children.
   */
  const getNodesLeadingTo = useCallback((destId: string): Set<string> => {
    // Build a reverse adjacency map: for each node, who points TO it?
    const reverseAdj: Record<string, string[]> = {};
    state.clips.forEach(c => {
      const fwd = [...(c.children || []), ...(c.customConnections || [])];
      fwd.forEach(tid => {
        if (!reverseAdj[tid]) reverseAdj[tid] = [];
        reverseAdj[tid].push(c.id);
      });
    });

    // BFS backward from destId
    const reachable = new Set<string>();
    const queue = [destId];
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (reachable.has(node)) continue;
      reachable.add(node);
      (reverseAdj[node] || []).forEach(prev => queue.push(prev));
    }
    return reachable;
  }, [state.clips]);

  const playSequence = useCallback(async (path: string[]) => {
    setPlaybackSequence(path);
    for (const id of path) {
      setState(prev => ({ ...prev, playingId: id }));
      // 3 seconds per node simulated playback
      await new Promise(r => setTimeout(r, 3000));
    }
    setState(prev => ({ ...prev, playingId: null }));
    setPlaybackSequence([]);
    showToast('Playback Complete');
  }, [showToast]);

  const clearPlaybackSequence = useCallback(() => {
    setPlaybackSequence([]);
    setState(prev => ({ ...prev, playingId: null }));
  }, []);

  const autoWireNode = useCallback((nodeId: string, targetSession: string, prevId: string | null, nextId: string | null) => {
    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => {
        let updated = { ...c };
        
        // 1. Update session of dropped node
        if (c.id === nodeId) {
          updated.session = targetSession;
          // Wire outgoing to nextId
          if (nextId) updated.customConnections = [...(updated.customConnections || []).filter(x => x !== nextId), nextId];
        }
        
        // 2. Break old connection between prevId -> nextId
        if (prevId && nextId && c.id === prevId) {
          updated.customConnections = (updated.customConnections || []).filter(x => x !== nextId);
        }

        // 3. Wire prevId to the dropped node
        if (prevId && c.id === prevId) {
          updated.customConnections = [...(updated.customConnections || []).filter(x => x !== nodeId), nodeId];
        }

        return updated;
      })
    }));
    showToast(`Fragment ${nodeId} successfully wired into ${targetSession}`);
  }, [showToast]);

  const toggleCustomConnection = useCallback((sourceId: string, targetId: string) => {
    if (checkCycle(sourceId, targetId)) {
      showToast('ERROR: Connections must flow forward chronologically. No cycle jumps allowed!');
      return;
    }

    setState(prev => ({
      ...prev,
      clips: prev.clips.map(c => {
        if (c.id === sourceId) {
          const connections = c.customConnections || [];
          if (connections.includes(targetId)) {
            // Remove connection
            return { ...c, customConnections: connections.filter(t => t !== targetId) };
          } else {
            // Add connection
            return { ...c, customConnections: [...connections, targetId] };
          }
        }
        return c;
      })
    }));
  }, [checkCycle, showToast]);


  const toggleEdit = useCallback(() => {
    setState(prev => ({ ...prev, isEditing: !prev.isEditing }));
  }, []);

  const hideOverlays = useCallback(() => {
    setActiveOverlay(null);
    setSuccessMessage(null);
  }, []);

  const handleAction = useCallback((action: string) => {
    if (!state.selectedId) return;
    hideOverlays();
    
    const selectedClip = state.clips.find(c => c.id === state.selectedId);
    if (!selectedClip) return;
    
    switch(action) {
      case 'branch':
        setActiveOverlay('branch');
        break;
        
      case 'fork':
        setActiveOverlay('fork');
        break;
        
      case 'merge':
        setState(prev => ({ ...prev, mergeMode: true, mergeSourceId: state.selectedId }));
        showToast(`Select a second fragment to merge with ${state.selectedId}`);
        break;
        
      case 'export':
        setActiveOverlay('export');
        break;
        
      case 'delete':
        setActiveOverlay('delete');
        break;
    }
  }, [state.selectedId, state.clips, showToast, hideOverlays]);

  const confirmBranch = useCallback((instrument: string, direction: string) => {
    if (!state.selectedId) return;
    const src = state.clips.find(c => c.id === state.selectedId);
    if (!src) return;

    let newId = generateId();
    while (state.clips.find(c => c.id === newId)) newId = generateId();

    const sess = direction === 'experiment' ? getNextSession() : src.session;
    const branchClip: Clip = {
      id: newId,
      name: `${src.name} (${direction})`,
      bpm: Math.max(60, src.bpm + randomInt(-4, 4)),
      key: src.key,
      mood: src.mood,
      instrument,
      session: sess,
      ago: 'just now',
      type: 'branch',
      parent: src.id,
      children: [],
      duration: src.duration,
      tags: [...src.tags],
      isNew: true,
    };

    setState(prev => {
      const updatedClips = prev.clips.map(c => 
        c.id === src.id ? { ...c, children: [...c.children, newId] } : c
      );
      return {
        ...prev,
        clips: [branchClip, ...updatedClips],
      };
    });

    setActiveOverlay(null);
    setSuccessMessage(`✓ BRANCH CREATED\n${newId} derived from ${state.selectedId}\nOpening new fragment…`);
    showToast(`BRANCHED — ${newId} derived from ${state.selectedId}`);

    setTimeout(() => {
      setSuccessMessage(null);
      selectClip(newId);
    }, 2200);

    setTimeout(() => {
      setState(prev => ({
        ...prev,
        clips: prev.clips.map(c => c.id === newId ? { ...c, isNew: false } : c)
      }));
    }, 3500);
  }, [state.selectedId, state.clips, showToast]);

  const confirmFork = useCallback((targetSession: string) => {
    if (!state.selectedId) return;
    const src = state.clips.find(c => c.id === state.selectedId);
    if (!src) return;

    let newId = generateId();
    while (state.clips.find(c => c.id === newId)) newId = generateId();

    const forkClip: Clip = {
      ...src,
      id: newId,
      name: `${src.name} (Fork)`,
      session: targetSession || `${src.session} (Fork)`,
      ago: 'just now',
      type: 'root',
      parent: null,
      children: [],
      tags: [...src.tags],
      isNew: true,
      x: src.x !== undefined ? src.x + 150 : undefined,
      y: src.y !== undefined ? src.y + 80 : undefined,
    };

    setState(prev => ({
      ...prev,
      clips: [forkClip, ...prev.clips],
    }));

    setActiveOverlay(null);
    setSuccessMessage(`✓ FORKED TO NEW SESSION\n${newId} duplicated from ${state.selectedId}\nOpening new fragment in ${forkClip.session}…`);
    showToast(`FORKED — ${newId} to ${forkClip.session}`);

    setTimeout(() => {
      setSuccessMessage(null);
      selectClip(newId);
    }, 2200);

    setTimeout(() => {
      setState(prev => ({
        ...prev,
        clips: prev.clips.map(c => c.id === newId ? { ...c, isNew: false } : c)
      }));
    }, 3500);
  }, [state.selectedId, state.clips, showToast]);

  // Fork any clip by ID directly (used by MapView context menu — no selectedId dependency)
  const forkClipDirect = useCallback((sourceId: string) => {
    const src = state.clips.find(c => c.id === sourceId);
    if (!src) return null;

    let newId = generateId();
    while (state.clips.find(c => c.id === newId)) newId = generateId();

    const newSession = `${src.session} fork`;
    const forkClip: Clip = {
      ...src,
      id: newId,
      name: `${src.name || src.id} (Fork)`,
      session: newSession,
      ago: 'just now',
      type: 'root',
      parent: null,
      children: [],
      tags: [...src.tags],
      isNew: true,
      x: src.x !== undefined ? src.x + 160 : undefined,
      y: src.y !== undefined ? src.y + 100 : undefined,
      customConnections: [],
    };

    setState(prev => ({
      ...prev,
      clips: [forkClip, ...prev.clips],
    }));

    showToast(`⎇ Forked ${sourceId} → ${newId} in "${newSession}"`);

    setTimeout(() => {
      setState(prev => ({
        ...prev,
        clips: prev.clips.map(c => c.id === newId ? { ...c, isNew: false } : c)
      }));
    }, 3500);

    return newId;
  }, [state.clips, showToast]);

  const confirmDelete = useCallback(() => {
    if (!state.selectedId) return;
    const clip = state.clips.find(c => c.id === state.selectedId);
    if (!clip) return;
    const deletedId = state.selectedId;

    setState(prev => ({
      ...prev,
      clips: prev.clips
        .filter(c => c.id !== deletedId)
        .map(c => ({
          ...c,
          parent: c.parent === deletedId ? null : c.parent,
          children: c.children.filter(x => x !== deletedId),
        })),
      selectedId: null,
    }));

    setActiveOverlay(null);
    showToast(`Deleted fragment ${deletedId}`);
  }, [state.selectedId, state.clips, showToast]);

  const confirmExport = useCallback(() => {
    if (!state.selectedId) return;
    const clip = state.clips.find(c => c.id === state.selectedId);
    if (!clip) return;
    
    setActiveOverlay(null);
    setSuccessMessage(`✓ EXPORTED\n${clip.name || clip.id}.wav\nFile downloaded successfully`);
    showToast(`EXPORTED ${clip.id}.wav`);
    
    setTimeout(() => {
      setSuccessMessage(null);
    }, 2200);
  }, [state.selectedId, state.clips, showToast]);

  const changeRate = useCallback((rate: number) => {
    setState(prev => ({ ...prev, playbackRate: rate }));
  }, []);

  const toggleDetailPlay = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      playingId: prev.playingId === id ? null : id
    }));
  }, []);

  const copyId = useCallback((id: string) => {
    navigator.clipboard.writeText(id);
    showToast('ID copied to clipboard');
  }, [showToast]);

  // Get filtered clips
  const getFilteredClips = useCallback(() => {
    let clips = [...state.clips];
    
    // Filter by tab
    if (state.activeTab === 'roots') {
      clips = clips.filter(c => c.type === 'root');
    } else if (state.activeTab === 'branches') {
      clips = clips.filter(c => c.type === 'branch');
    } else if (state.activeTab === 'merges') {
      clips = clips.filter(c => c.type === 'merge' || c.type === 'version');
    } else if (state.activeTab === 'recent') {
      clips = clips.slice(0, 4);
    }
    
    // Filter by active filters
    state.activeFilters.forEach(key => {
      const chipDef = CHIP_DEFINITIONS.find(ch => ch.key === key);
      if (chipDef) {
        clips = clips.filter(chipDef.fn);
      } else if (key.startsWith('tag_')) {
        const tag = key.replace('tag_', '');
        clips = clips.filter(c => c.tags.includes(tag));
      }
    });
    
    // Filter by search query
    const query = state.topbarQuery.toLowerCase().trim();
    if (query) {
      clips = clips.filter(c =>
        c.id.toLowerCase().includes(query) ||
        c.mood.toLowerCase().includes(query) ||
        c.key.toLowerCase().includes(query) ||
        String(c.bpm).includes(query) ||
        c.instrument.toLowerCase().includes(query) ||
        c.tags.some(t => t.toLowerCase().includes(query)) ||
        c.session.toLowerCase().includes(query) ||
        (c.name && c.name.toLowerCase().includes(query))
      );
    }
    
    return clips;
  }, [state.clips, state.activeTab, state.activeFilters, state.topbarQuery]);

  // Update counts
  const updateCounts = useCallback(() => {
    return {
      all: state.clips.length,
      roots: state.clips.filter(c => c.type === 'root').length,
      branches: state.clips.filter(c => c.type === 'branch').length,
      merges: state.clips.filter(c => c.type === 'merge' || c.type === 'version').length,
    };
  }, [state.clips]);

  // Animation helpers
  const animateCaptureWaveform = useCallback(() => {
    cpPhaseRef.current += 0.038;
    requestAnimationFrame(animateCaptureWaveform);
  }, []);

  const animateBuffer = useCallback(() => {
    const elapsed = (Date.now() - bufferStartRef.current) % 60000;
    const percentage = (elapsed / 60000) * 100;
    // Update buffer bar fill
    requestAnimationFrame(animateBuffer);
  }, []);

  // Initialize animations
  useEffect(() => {
    animateCaptureWaveform();
    animateBuffer();
  }, [animateCaptureWaveform, animateBuffer]);

  return {
    // State
    state,
    shortcutsVisible,
    captureModalVisible,
    pendingCapture,
    cmTags,
    toasts,
    capturing,
    
    // View management
    setView,
    
    // Capture
    handleCapture,
    openCaptureModal,
    closeCaptureModal,
    saveCapture,
    discardCapture,
    
    // Search
    handleTopbarSearch,
    clearTopbarSearch,
    handleSemanticSearch,
    triggerSuggestion,
    
    // Tabs and filters
    setTab,
    toggleFilter,
    toggleTagFilter,
    clearAllFilters,
    getActiveFilters,
    getTabCounts,
    
    // Audio Hook properties exported for VaultView UI
    audio,
    
    // Clip management
    selectClip,
    togglePlay,
    closeDetail,
    getFilteredClips,
    updateCounts,
    toggleEdit,
    handleAction,
    changeRate,
    toggleDetailPlay,
    copyId,
    updateClipPosition,
    updateClipSession,
    toggleCustomConnection,
    autoWireNode,
    findPath,
    getNodesLeadingTo,
    playSequence,
    playbackSequence,
    clearPlaybackSequence,
    
    // Overlays
    activeOverlay,
    successMessage,
    hideOverlays,
    confirmBranch,
    confirmFork,
    forkClipDirect,
    confirmDelete,
    confirmExport,
    
    // Merge
    cancelMergeMode,
    
    // Banner
    dismissBanner,
    
    // Shortcuts
    toggleShortcuts,
    
    // Toasts
    showToast,
    
    // Tags
    setCmTags,
    
    // Utilities
    getWaveform,
    
    // Constants
    VIEW_NAMES,
  };
}
