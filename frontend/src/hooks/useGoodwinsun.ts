'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudio } from './useAudio';
import { AppState, Clip, ViewType, TabType, PendingCapture, KeyTimelineChunk } from '@/types';
import { DEFAULT_CLIPS, CHIP_DEFINITIONS, VIEW_NAMES } from '@/utils/constants';
import { randomPick, randomInt, generateId, getNextSession, getWaveform } from '@/utils/helpers';

const AUDIO_PATHS: Record<string, string> = {
  'W1V2': '/maco_mamuko.mp3',
  'B4H1': '/bilahari.mp3',
};

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
  mergeTargetId: null,
  isMergeModalOpen: false,
  playbackSequence: [],
  playbackSequenceIndex: null,
  isAnalyzing: false,
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

  
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  const bufferStartRef = useRef(Date.now());
  const cpPhaseRef = useRef(0);
  const audioInstanceRef = useRef<HTMLAudioElement | null>(null);
  const audioInstanceRef2 = useRef<HTMLAudioElement | null>(null);

  // Wire up auto-fragment callback from the audio hook
  // This will be set after handleCapture is defined (see below)

  // Toasts
  const showToast = useCallback((message: string) => {
    setToasts(prev => [...prev, message]);
    setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 2600);
  }, []);


  const handleClipEnded = useCallback(() => {
    setState(prev => {
      const { playbackSequence, playbackSequenceIndex } = prev;

      if (playbackSequence.length > 0 && playbackSequenceIndex !== null && playbackSequenceIndex < playbackSequence.length - 1) {
          const nextIndex = playbackSequenceIndex + 1;
          const nextId = playbackSequence[nextIndex];
          console.log(`[SequencePlayer] Advancing to next: ${nextId} (${nextIndex + 1}/${playbackSequence.length})`);
          return {
              ...prev,
              playbackSequenceIndex: nextIndex,
              playingId: nextId
          };
      } else {
          console.log('[SequencePlayer] Sequence complete or single clip end');
          const wasSequence = playbackSequence.length > 0;
          if (wasSequence) showToast('Playback Complete');
          return {
              ...prev,
              playbackSequence: [],
              playbackSequenceIndex: null,
              playingId: null
          };
      }
    });
  }, [showToast]);

  // Audio Playback Orchestrator
  useEffect(() => {
    const pid = state.playingId;
    
    // Stop and cleanup ALL existing audios
    if (audioInstanceRef.current) {
        audioInstanceRef.current.pause();
        audioInstanceRef.current.src = "";
        audioInstanceRef.current = null;
    }
    if (audioInstanceRef2.current) {
        audioInstanceRef2.current.pause();
        audioInstanceRef2.current.src = "";
        audioInstanceRef2.current = null;
    }

    if (!pid) return;

    // Use current 'state' for the initial trigger values to ensure we see
    // exactly what caused this effect to run, avoiding 'stateRef' lag.
    const clip = state.clips.find(c => c.id === pid);
    if (!clip) {
        console.warn(`[AudioOrchestrator] Clip not found for id: ${pid}`);
        handleClipEnded();
        return;
    }

    if (clip.type === 'merge' && clip.parent) {
        const parents = clip.parent.split(' + ').map(s => s.trim());
        
        // Resolve parent audio paths from current state or static storage
        const p1 = state.clips.find(c => c.id === parents[0]);
        const p2 = state.clips.find(c => c.id === parents[1]);
        
        const path1 = p1?.audioPath || AUDIO_PATHS[parents[0]];
        const path2 = p2?.audioPath || AUDIO_PATHS[parents[1]];
        
        if (clip.mergeStrategy === 'overlap') {
            // Simultaneous playback
            const a1 = new Audio(path1 || "");
            const a2 = new Audio(path2 || "");
            a1.playbackRate = state.playbackRate;
            a2.playbackRate = state.playbackRate;
            
            if (path1) {
                console.log(`[AudioOrchestrator] Overlap P1: ${path1}`);
                a1.play().catch(e => console.error(e));
            }
            if (path2) {
                console.log(`[AudioOrchestrator] Overlap P2: ${path2}`);
                a2.play().catch(e => console.error(e));
            }
            
            // Revert state when LONGER one ends
            let endedCount = 0;
            const totalToWait = (path1 ? 1 : 0) + (path2 ? 1 : 0);
            
            const handleEnded = () => {
                endedCount++;
                if (endedCount >= totalToWait) handleClipEnded();
            };
            
            if (path1) a1.onended = handleEnded;
            if (path2) a2.onended = handleEnded;
            
            audioInstanceRef.current = a1;
            audioInstanceRef2.current = a2;
        } else {
            // Sequential playback
                const a1 = new Audio(path1 || "");
                a1.playbackRate = state.playbackRate;
            
            if (path1) {
                console.log(`[AudioOrchestrator] Sequence P1: ${path1}`);
                a1.play().catch(e => {
                    console.error(e);
                    handleClipEnded();
                });
                
                a1.onended = () => {
                    if (path2) {
                        console.log(`[AudioOrchestrator] Sequence P2: ${path2}`);
                        const a2 = new Audio(path2);
                        a2.playbackRate = state.playbackRate;
                        a2.play().catch(e => console.error(e));
                        a2.onended = () => handleClipEnded();
                        audioInstanceRef.current = a2;
                    } else {
                        setTimeout(() => handleClipEnded(), 1000);
                    }
                };
                audioInstanceRef.current = a1;
            } else if (path2) {
                const a2 = new Audio(path2);
                a2.playbackRate = state.playbackRate;
                a2.play().catch(e => {
                    console.error(e);
                    handleClipEnded();
                });
                a2.onended = () => handleClipEnded();
                audioInstanceRef.current = a2;
            } else {
                setTimeout(() => handleClipEnded(), 1000);
            }
        }
    } else {
        const path = clip.audioPath || AUDIO_PATHS[pid];
        if (path) {
            console.log(`[AudioOrchestrator] Playing: ${path} for clip ${pid}`);
            const audioEl = new Audio(path);
            audioEl.playbackRate = state.playbackRate;
            audioEl.play().catch(err => {
                console.error("Playback failed:", err);
                handleClipEnded();
            });
            audioEl.onended = () => {
                handleClipEnded();
            };
            audioInstanceRef.current = audioEl;
        } else {
            console.warn(`No audio path found for clip ${pid}. Staying for 1s of silence.`);
            // Intentional 1s stay for silent nodes to prevent 'flashing'
            setTimeout(() => {
                handleClipEnded();
            }, 1000);
        }
    }
  }, [state.playingId, handleClipEnded]);

  // Sync Playback Rate
  useEffect(() => {
    if (audioInstanceRef.current) audioInstanceRef.current.playbackRate = state.playbackRate;
    if (audioInstanceRef2.current) audioInstanceRef2.current.playbackRate = state.playbackRate;
  }, [state.playbackRate]);

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

  const selectClip = useCallback((id: string) => {
    // Handle merge mode
    if (state.mergeMode && state.mergeSourceId && state.mergeSourceId !== id) {
      setState(prev => ({ ...prev, mergeTargetId: id, isMergeModalOpen: true }));
      return;
    }
    setState(prev => ({ ...prev, selectedId: id, isEditing: false }));
  }, [state.mergeMode, state.mergeSourceId]);

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
    let instrument = randomPick(['guitar', 'piano', 'synth', 'drums', 'bass + synth', 'guitar + bass', 'keys', 'violin + pad']);
    let name = '';
    let tags: string[] = [];
    let keyTimeline: KeyTimelineChunk[] = [];
    let analyzedDuration: number | null = null;
    
    if (blob) {
      try {
        const formData = new FormData();
        formData.append('file', blob, 'capture.webm');
        
        console.log('Submitting audio to Python (127.0.0.1:8000)...');
        
        const res = await fetch('http://127.0.0.1:8000/api/analyze', {
          method: 'POST',
          body: formData,
        });
        
        if (res.ok) {
          const data = await res.json();
          console.log('Analysis successful:', data);
          bpm = data.bpm || bpm;
          key = data.key || key;
          mood = data.mood || mood;
          instrument = data.instrument || instrument;
          name = data.name || '';
          tags = data.tags || [];
          keyTimeline = data.key_timeline || [];
          if (data.duration) analyzedDuration = data.duration;
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

    // Format duration string from analyzed seconds or estimate from blob size
    let durationStr: string;
    if (analyzedDuration !== null) {
      const mins = Math.floor(analyzedDuration / 60);
      const secs = Math.floor(analyzedDuration % 60);
      durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    } else if (blob) {
      durationStr = `0:${Math.max(1, Math.floor(blob.size / 100000)).toString().padStart(2, '0')}`;
    } else {
      durationStr = `0:${randomInt(15, 55)}`;
    }
    
    const newCapture: PendingCapture = {
      id: newId,
      name,
      bpm,
      key,
      mood,
      instrument,
      session: getNextSession(),
      ago: 'just now',
      type: 'root',
      parent: null,
      children: [],
      duration: durationStr,
      keyTimeline,
      audioPath: blob ? URL.createObjectURL(blob) : undefined,
    };
    
    setPendingCapture(newCapture);
    setCapturing(false);
    setState(prev => ({ ...prev, isAnalyzing: false })); // End analysis
    openCaptureModal(newCapture);
  }, [capturing, state.clips, audio, openCaptureModal]);

  // Wire auto-fragment: when voice activation detects silence, auto-capture
  useEffect(() => {
    audio.setOnAutoFragment((blob: Blob) => {
      setState(prev => ({ ...prev, isAnalyzing: true })); // Start analysis banner
      handleCapture(blob);
    });
    return () => {
      audio.setOnAutoFragment(null);
    };
  }, [audio, handleCapture]);

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
      x: 300,
      y: 300,
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
    setState(prev => ({ ...prev, topbarQuery: query }));
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
  

  const confirmMerge = useCallback((strategy: 'sequential' | 'overlap') => {
    if (!state.mergeSourceId || !state.mergeTargetId) return;
    const sourceClip = state.clips.find(c => c.id === state.mergeSourceId);
    const targetClip = state.clips.find(c => c.id === state.mergeTargetId);
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
        duration: strategy === 'sequential' 
            ? `0:${parseInt(sourceClip.duration.split(':')[1]) + parseInt(targetClip.duration.split(':')[1])}`
            : sourceClip.duration,
        tags: [...new Set([...sourceClip.tags, ...targetClip.tags])],
        mergeStrategy: strategy,
        x: (sourceClip.x || targetClip.x || 100) + 200,
        y: (sourceClip.y || targetClip.y || 100) + 50,
      };
      setState(prev => ({
        ...prev,
        clips: [mergedClip, ...prev.clips],
        mergeMode: false,
        mergeSourceId: null,
        mergeTargetId: null,
        isMergeModalOpen: false,
        selectedId: mergedClip.id,
      }));
      showToast(`Created ${strategy} merge: ${mergedClip.id}`);
    }
  }, [state.mergeSourceId, state.mergeTargetId, state.clips, showToast]);

  const cancelMergeModal = useCallback(() => {
    setState(prev => ({ ...prev, isMergeModalOpen: false, mergeTargetId: null }));
  }, []);


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

  const playSequence = useCallback((path: string[]) => {
    if (!path.length) return;
    console.log(`[SequencePlayback] Queueing path: ${path.join(' -> ')}`);
    
    setState(prev => ({
      ...prev,
      playbackSequence: path,
      playbackSequenceIndex: 0,
      playingId: path[0]
    }));
  }, []);

  const clearPlaybackSequence = useCallback(() => {
    setState(prev => ({
      ...prev,
      playbackSequence: [],
      playbackSequenceIndex: null,
      playingId: null
    }));
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
      audioPath: src.audioPath || AUDIO_PATHS[src.id],
      x: (src.x !== undefined ? src.x : 300) + 150,
      y: (src.y !== undefined ? src.y : 300) + 80,
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
  const forkClipDirect = useCallback((sourceId: string, x?: number, y?: number, targetSession?: string) => {
    const src = state.clips.find(c => c.id === sourceId);
    if (!src) return null;

    let newId = generateId();
    while (state.clips.find(c => c.id === newId)) newId = generateId();

    const newSession = targetSession !== undefined ? targetSession : `${src.session} fork`;
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
      audioPath: src.audioPath || AUDIO_PATHS[src.id],
      x: x !== undefined ? x : (src.x !== undefined ? src.x + 160 : undefined),
      y: y !== undefined ? y : (src.y !== undefined ? src.y + 100 : undefined),
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
    
    const path = clip.audioPath || AUDIO_PATHS[clip.id];
    if (path) {
      const link = document.createElement('a');
      link.href = path;
      link.download = `${clip.name || clip.id}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setActiveOverlay(null);
    setSuccessMessage(`✓ EXPORTED\n${clip.name || clip.id}.wav\nFile download triggered`);
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
        (c.id && c.id.toLowerCase().includes(query)) ||
        (c.mood && c.mood.toLowerCase().includes(query)) ||
        (c.key && c.key.toLowerCase().includes(query)) ||
        (c.bpm !== undefined && String(c.bpm).includes(query)) ||
        (c.instrument && c.instrument.toLowerCase().includes(query)) ||
        (c.tags && c.tags.some(t => t.toLowerCase().includes(query))) ||
        (c.session && c.session.toLowerCase().includes(query)) ||
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

    // Clip selection and playback
    selectClip,
    confirmMerge,
    cancelMergeModal,
    
    // Tabs and filters
    setTab,
    toggleFilter,
    toggleTagFilter,
    clearAllFilters,
    getActiveFilters,
    getTabCounts,
    
    // Audio Hook properties exported for VaultView UI
    audio,
    
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
    playbackSequence: state.playbackSequence,
    clearPlaybackSequence,
    
    // Overlays
    activeOverlay,
    successMessage,
    hideOverlays,

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
