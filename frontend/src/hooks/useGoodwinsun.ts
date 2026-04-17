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
    
    // Overlays
    activeOverlay,
    successMessage,
    hideOverlays,
    confirmBranch,
    confirmFork,
    confirmDelete,
    confirmExport,
    
    // Merge
    cancelMergeMode,
    
    // Banner
    dismissBanner,
    
    // Shortcuts
    toggleShortcuts,
    
    // Tags
    setCmTags,
    
    // Toasts
    showToast,
    
    // Utilities
    getWaveform,
    
    // Constants
    VIEW_NAMES,
  };
}
