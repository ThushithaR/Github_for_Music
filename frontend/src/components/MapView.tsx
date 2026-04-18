'use client';

import React, { useState, useEffect, useRef, useCallback, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';
import { useGoodwinsun } from '@/context/GoodwinsunContext';
import { Clip } from '@/types';

// ─── palette ─────────────────────────────────────────────────────────────────
const SESSION_COLORS = [
  '#D4883A', '#3D7A5C', '#6B4F88', '#4A5A99', '#7A4F3D',
  '#2D6A8C', '#8C4D4A', '#4D8C4A', '#8C7A2D', '#4D4A8C',
];

const typeColor = (t: string) => {
  const map: Record<string, string> = {
    root: '#D4883A', branch: '#3D7A5C', merge: '#6B4F88', version: '#4A5A99',
  };
  return map[t] || '#888';
};

const typeGlow = (t: string) => {
  const map: Record<string, string> = {
    root: 'rgba(212,136,58,.35)', branch: 'rgba(61,122,92,.35)',
    merge: 'rgba(107,79,136,.35)', version: 'rgba(74,90,153,.35)',
  };
  return map[t] || 'rgba(255,255,255,.12)';
};

// node card size
const NW = 120, NH = 54;

// ─── helpers ─────────────────────────────────────────────────────────────────
function getWavePoints(seed: string, w: number, h: number): string {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n += seed.charCodeAt(i);
  const pts: string[] = [];
  const bars = 16;
  for (let i = 0; i < bars; i++) {
    const amp = ((Math.sin(n * (i + 1) * 0.37) + 1) / 2) * h;
    pts.push(`${(i / (bars - 1)) * w},${(h - amp).toFixed(1)}`);
  }
  return pts.join(' ');
}

// ─── component ───────────────────────────────────────────────────────────────
export default function MapView() {
  const {
    state, selectClip, setView,
    updateClipPosition, updateClipSession,
    toggleCustomConnection, autoWireNode,
    findPath, getNodesLeadingTo, playSequence, playbackSequence, clearPlaybackSequence,
    forkClipDirect, showToast,
  } = useGoodwinsun();

  // ── canvas transform ──────────────────────────────────────────────────────
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // ── pan state ─────────────────────────────────────────────────────────────
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, tx: 0, ty: 0 });
  const spaceHeldRef = useRef(false);

  // ── node drag ─────────────────────────────────────────────────────────────
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [ghostEdge, setGhostEdge] = useState<{ x: number; y: number } | null>(null);

  // ── import confirm dialog ─────────────────────────────────────────────────
  const [importDialog, setImportDialog] = useState<{
    nodeId: string; targetSession: string;
    prevId: string | null; nextId: string | null;
    screenX: number; screenY: number;
  } | null>(null);

  // ── modes ─────────────────────────────────────────────────────────────────
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [playbackMode, setPlaybackMode] = useState(false);
  const [playbackSource, setPlaybackSource] = useState<string | null>(null);

  // ── interactive traversal state ───────────────────────────────────────────
  // When a node has >1 outgoing edge during step-by-step playback, we pause
  // and show a branch picker overlay.
  const [branchPicker, setBranchPicker] = useState<{
    currentNodeId: string;
    choices: string[];         // IDs of next possible nodes
    resolveChoice: (chosen: string) => void;
  } | null>(null);

  // Ref-based async traversal so state updates don’t break the loop
  const traversalAbortRef = useRef(false);

  // ── context menu ─────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; clipId: string } | null>(null);

  // ── hover popup ──────────────────────────────────────────────────────────
  const [hoverInfo, setHoverInfo] = useState<{ clip: Clip; screenX: number; screenY: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── compute sessions + clusters ──────────────────────────────────────────
  const sessColorMap: Record<string, string> = {};
  const sessMap: Record<string, string[]> = {};
  state.clips.forEach(c => {
    const s = c.session || 'Unsorted';
    if (!sessMap[s]) sessMap[s] = [];
    sessMap[s].push(c.id);
  });
  Object.keys(sessMap).forEach((s, i) => {
    sessColorMap[s] = SESSION_COLORS[i % SESSION_COLORS.length];
  });

  // ── auto-position on first render ────────────────────────────────────────
  useEffect(() => {
    const defaultPositions: Record<string, { x: number; y: number }> = {};
    Object.keys(sessMap).forEach((sess, si) => {
      sessMap[sess].forEach((clipId, ci) => {
        defaultPositions[clipId] = { x: 180 + si * 320, y: 100 + ci * 120 };
      });
    });
    state.clips.forEach(clip => {
      if (clip.x === undefined || clip.y === undefined) {
        const def = defaultPositions[clip.id] || { x: 300, y: 300 };
        updateClipPosition(clip.id, def.x, def.y);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.clips.length]);

  // ── edges ─────────────────────────────────────────────────────────────────
  type Edge = { from: string; to: string; type: string; crossSession: boolean; fromSession: string };
  const allEdges: Edge[] = [];
  state.clips.forEach(c => {
    if (c.parent) {
      String(c.parent).split('+').map(s => s.trim()).forEach(pid => {
        const parentClip = state.clips.find(x => x.id === pid);
        if (parentClip) {
          allEdges.push({ from: pid, to: c.id, type: c.type, crossSession: parentClip.session !== c.session, fromSession: parentClip.session });
        }
      });
    }
    if (c.customConnections) {
      c.customConnections.forEach(tid => {
        const target = state.clips.find(x => x.id === tid);
        if (target) {
          allEdges.push({ from: c.id, to: tid, type: 'custom', crossSession: c.session !== target.session, fromSession: c.session });
        }
      });
    }
  });

  // ── playback path helpers ────────────────────────────────────────────────
  const isPathEdge = (from: string, to: string): boolean => {
    if (!playbackSequence.length) return false;
    for (let i = 0; i < playbackSequence.length - 1; i++) {
      if (playbackSequence[i] === from && playbackSequence[i + 1] === to) return true;
    }
    return false;
  };
  const isPathNode = (id: string) => playbackSequence.includes(id);

  // ── coordinate helpers ───────────────────────────────────────────────────
  const screenToSVG = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale,
    };
  }, [transform]);

  // ── keyboard space ────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        spaceHeldRef.current = true;
        if (containerRef.current) containerRef.current.style.cursor = 'grab';
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
        if (containerRef.current) containerRef.current.style.cursor = 'default';
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // ── global mouse-up to end panning / dragging ─────────────────────────────
  useEffect(() => {
    const up = () => {
      isPanningRef.current = false;
      if (containerRef.current && !spaceHeldRef.current) {
        containerRef.current.style.cursor = 'default';
      }
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // ── wheel zoom ────────────────────────────────────────────────────────────
  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = containerRef.current!.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    setTransform(prev => {
      const newScale = Math.min(3, Math.max(0.2, prev.scale * factor));
      return {
        scale: newScale,
        x: ox - (ox - prev.x) * (newScale / prev.scale),
        y: oy - (oy - prev.y) * (newScale / prev.scale),
      };
    });
  };

  // ── canvas mouse events ───────────────────────────────────────────────────
  const handleCanvasMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    // middle click or space+left = pan
    if (e.button === 1 || (e.button === 0 && spaceHeldRef.current)) {
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = { mx: e.clientX, my: e.clientY, tx: transform.x, ty: transform.y };
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    }
    // dismiss context menu on any click
    if (ctxMenu) setCtxMenu(null);
  };

  const handleCanvasMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.mx;
      const dy = e.clientY - panStartRef.current.my;
      setTransform(prev => ({ ...prev, x: panStartRef.current.tx + dx, y: panStartRef.current.ty + dy }));
      return;
    }

    if (draggingNode) {
      const pos = screenToSVG(e.clientX, e.clientY);
      updateClipPosition(draggingNode, pos.x - NW / 2, pos.y - NH / 2);
      setGhostEdge({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseUp = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      if (containerRef.current) containerRef.current.style.cursor = spaceHeldRef.current ? 'grab' : 'default';
      return;
    }

    if (draggingNode) {
      const pos = screenToSVG(e.clientX, e.clientY);

      // find target session from bounding boxes
      let targetSess: string | null = null;
      Object.keys(sessMap).forEach(sess => {
        const nodes = sessMap[sess].map(id => state.clips.find(c => c.id === id)).filter(Boolean) as Clip[];
        const positioned = nodes.filter(n => n.x !== undefined);
        if (!positioned.length) return;
        const xs = positioned.map(n => n.x!);
        const ys = positioned.map(n => n.y!);
        const bx = Math.min(...xs) - 60, by = Math.min(...ys) - 40;
        const bw = Math.max(...xs) - Math.min(...xs) + NW + 120;
        const bh = Math.max(...ys) - Math.min(...ys) + NH + 80;
        if (pos.x >= bx && pos.x <= bx + bw && pos.y >= by && pos.y <= by + bh) {
          targetSess = sess;
        }
      });

      const draggedClip = state.clips.find(c => c.id === draggingNode);
      if (targetSess && draggedClip && draggedClip.session !== targetSess) {
        // compute prev/next neighbours in target session by x position
        const targetNodes = state.clips
          .filter(c => c.session === targetSess && c.x !== undefined && c.id !== draggingNode)
          .sort((a, b) => a.x! - b.x!);
        let prevId: string | null = null, nextId: string | null = null;
        for (const n of targetNodes) {
          if (n.x! + NW / 2 < pos.x) prevId = n.id;
          if (n.x! + NW / 2 > pos.x && !nextId) nextId = n.id;
        }
        // show confirm dialog instead of committing immediately
        setImportDialog({
          nodeId: draggingNode,
          targetSession: targetSess,
          prevId, nextId,
          screenX: e.clientX,
          screenY: e.clientY,
        });
      }

      setGhostEdge(null);
      setDraggingNode(null);
    }
  };

  // ── node event handlers ────────────────────────────────────────────────────
  const handleNodeMouseDown = (clipId: string, e: ReactMouseEvent) => {
    e.stopPropagation();
    if (e.button !== 0 || connectMode || playbackMode) return;
    setDraggingNode(clipId);
    clearHover();
  };

  // ── interactive step-by-step graph traversal ─────────────────────────────
  const getNeighbors = useCallback((nodeId: string): string[] => {
    const clip = state.clips.find(c => c.id === nodeId);
    if (!clip) return [];
    const direct = clip.children || [];
    const custom = clip.customConnections || [];
    // Deduplicate
    return [...new Set([...direct, ...custom])].filter(id => state.clips.find(c => c.id === id));
  }, [state.clips]);

  const startInteractivePlayback = useCallback(async (startId: string, destId: string | null) => {
    traversalAbortRef.current = false;
    const path: string[] = [startId];
    let current = startId;

    const validDestNodes = destId ? getNodesLeadingTo(destId) : null;
    
    if (destId && validDestNodes && !validDestNodes.has(startId)) {
      showToast('No valid path exists between these fragments.');
      setPlaybackMode(false);
      return;
    }

    // Step 1: Resolve the path (including any user prompts for branches)
    while (!traversalAbortRef.current) {
      if (destId && current === destId) break; // reached destination

      let neighbors = getNeighbors(current);
      if (validDestNodes) {
        neighbors = neighbors.filter(n => validDestNodes.has(n));
      }

      if (neighbors.length === 0) {
        if (!destId) showToast('End of path reached.');
        break;
      }

      if (neighbors.length === 1) {
        // Auto-advance
        current = neighbors[0];
        path.push(current);
        continue;
      }

      // Multiple branches — pause and wait for user choice
      const chosen = await new Promise<string>(resolve => {
        setBranchPicker({
          currentNodeId: current,
          choices: neighbors,
          resolveChoice: resolve,
        });
      });

      setBranchPicker(null);
      if (traversalAbortRef.current) break;
      current = chosen;
      path.push(chosen);
    }

    // Step 2: Play the path completely at once sequentially
    if (!traversalAbortRef.current) {
      if (path.length > 1) {
        playSequence(path);
      } else {
        showToast('Path resolved to a single fragment.');
      }
    }
  }, [getNeighbors, playSequence, showToast, getNodesLeadingTo]);

  const handleNodeClick = (clipId: string, e: ReactMouseEvent) => {
    e.stopPropagation();

    if (playbackMode) {
      if (!playbackSource) {
        setPlaybackSource(clipId);
      } else {
        if (playbackSource !== clipId) {
          // Source is set — start interactive traversal toward optional dest
          setPlaybackMode(false);
          setPlaybackSource(null);
          startInteractivePlayback(playbackSource, clipId);
        } else {
          // Clicked same node — treat as open-ended traversal (no fixed dest)
          setPlaybackMode(false);
          setPlaybackSource(null);
          startInteractivePlayback(clipId, null);
        }
      }
      return;
    }

    if (connectMode) {
      if (!connectSource) {
        setConnectSource(clipId);
      } else {
        if (connectSource !== clipId) toggleCustomConnection(connectSource, clipId);
        setConnectSource(null);
        setConnectMode(false);
      }
      return;
    }

    // normal click → open detail in vault
    if (!draggingNode) {
      selectClip(clipId);
      setView('vault');
    }
  };

  const handleNodeContextMenu = (clipId: string, e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, clipId });
  };

  // ── hover ─────────────────────────────────────────────────────────────────
  const clearHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHoverInfo(null);
  };

  const handleNodeMouseEnter = (clip: Clip, e: ReactMouseEvent) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setHoverInfo({ clip, screenX: e.clientX, screenY: e.clientY });
    }, 500);
  };

  const handleNodeMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHoverInfo(null), 200);
  };

  // ── context menu fork ─────────────────────────────────────────────────────
  const handleContextFork = () => {
    if (!ctxMenu) return;
    // forkClipDirect creates the fork and adds it to the vault without navigation
    forkClipDirect(ctxMenu.clipId);
    setCtxMenu(null);
    // stay on the map — the new node will auto-appear once clips update
  };

  const handleContextConnect = () => {
    if (!ctxMenu) return;
    setConnectMode(true);
    setConnectSource(ctxMenu.clipId);
    setCtxMenu(null);
  };

  const handleContextViewDetail = () => {
    if (!ctxMenu) return;
    selectClip(ctxMenu.clipId);
    setView('vault');
    setCtxMenu(null);
  };

  // ── import confirm ────────────────────────────────────────────────────────
  const confirmImport = () => {
    if (!importDialog) return;
    autoWireNode(importDialog.nodeId, importDialog.targetSession, importDialog.prevId, importDialog.nextId);
    setImportDialog(null);
  };

  const cancelImport = () => {
    // Move node back to its original session (revert position tracking)
    setImportDialog(null);
    // ghost edge already cleaned up via setGhostEdge(null) in mouseUp
  };

  // ── cluster bounding boxes ────────────────────────────────────────────────
  const clusterBoxes = Object.keys(sessMap).map(sess => {
    const nodes = sessMap[sess].map(id => state.clips.find(c => c.id === id)).filter(Boolean) as Clip[];
    const positioned = nodes.filter(n => n.x !== undefined);
    if (!positioned.length) return null;
    const xs = positioned.map(n => n.x!);
    const ys = positioned.map(n => n.y!);
    const pad = 40;
    return {
      sess,
      x: Math.min(...xs) - pad,
      y: Math.min(...ys) - pad,
      w: Math.max(...xs) - Math.min(...xs) + NW + pad * 2,
      h: Math.max(...ys) - Math.min(...ys) + NH + pad * 2,
      color: sessColorMap[sess] || '#888',
    };
  }).filter(Boolean) as { sess: string; x: number; y: number; w: number; h: number; color: string }[];

  // ── bezier edge path ──────────────────────────────────────────────────────
  const edgePath = (from: Clip, to: Clip) => {
    const x1 = from.x! + NW, y1 = from.y! + NH / 2;
    const x2 = to.x!, y2 = to.y! + NH / 2;
    const cx = (x1 + x2) / 2;
    return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
  };

  // ── cursor style ──────────────────────────────────────────────────────────
  const getCursor = () => {
    if (connectMode || playbackMode) return 'crosshair';
    return 'default';
  };

  const visible = state.currentView === 'map';

  return (
    <div
      className="view"
      id="view-map"
      style={{
        display: visible ? 'flex' : 'none',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#0D0D0C',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── toolbar ─────────────────────────────────────────────────────── */}
      <div style={{
        height: 52, minHeight: 52, background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)', display: 'flex',
        alignItems: 'center', padding: '0 20px', gap: 12, zIndex: 20,
        fontFamily: 'var(--font-mono)',
      }}>
        {/* legend */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginRight: 8 }}>
          {['root', 'branch', 'merge', 'version'].map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColor(t), boxShadow: `0 0 6px ${typeGlow(t)}` }} />
              {t.toUpperCase()}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
          <button onClick={() => setTransform(p => ({ ...p, scale: Math.min(3, p.scale * 1.2) }))}
            style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-mid)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 14 }}>+</button>
          <span style={{ minWidth: 36, textAlign: 'center' }}>{Math.round(transform.scale * 100)}%</span>
          <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.2, p.scale * 0.8) }))}
            style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-mid)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 14 }}>−</button>
          <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
            style={{ height: 24, padding: '0 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-mid)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em' }}>RESET</button>
        </div>

        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

        {/* PATH PLAYBACK */}
        <button
          onClick={() => { setPlaybackMode(p => !p); setPlaybackSource(null); setConnectMode(false); if (playbackSequence.length) clearPlaybackSequence(); }}
          style={{
            height: 30, padding: '0 12px',
            background: playbackMode ? '#4A5A99' : playbackSequence.length ? 'rgba(74,90,153,.25)' : 'rgba(255,255,255,0.05)',
            color: playbackMode ? '#fff' : playbackSequence.length ? '#8899cc' : 'var(--text-secondary)',
            border: '1px solid', borderColor: playbackMode ? '#4A5A99' : playbackSequence.length ? 'rgba(74,90,153,.5)' : 'var(--border-mid)',
            borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
            transition: 'all 0.15s',
          }}
        >
          {playbackMode
            ? (playbackSource ? '▸ SELECT DEST' : '▸ SELECT SOURCE')
            : playbackSequence.length ? '▸ PLAYING PATH' : '▸ PLAY PATH'}
        </button>

        {/* CONNECT NODES */}
        <button
          onClick={() => { setConnectMode(p => !p); setConnectSource(null); setPlaybackMode(false); setPlaybackSource(null); }}
          style={{
            height: 30, padding: '0 12px',
            background: connectMode ? 'var(--amber)' : 'rgba(255,255,255,0.05)',
            color: connectMode ? '#111' : 'var(--text-secondary)',
            border: '1px solid', borderColor: connectMode ? 'var(--amber)' : 'var(--border-mid)',
            borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
            transition: 'all 0.15s',
          }}
        >
          {connectMode ? (connectSource ? '⊕ SELECT TARGET' : '⊕ SELECT SOURCE') : '⊕ CONNECT'}
        </button>
      </div>

      {/* ── canvas ──────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: getCursor() }}
        onWheel={handleWheel}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onClick={() => setCtxMenu(null)}
      >
        {/* transformed SVG layer */}
        <svg
          ref={svgRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            transformOrigin: '0 0',
            transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
            userSelect: 'none',
          }}
        >
          <defs>
            <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="rgba(255,255,255,0.25)" />
            </marker>
            <marker id="arr-path" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="#6B8FD4" />
            </marker>
            {Object.keys(sessColorMap).map(sess => (
              <marker key={sess} id={`arr-${sess.replace(/\s/g, '_')}`} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L7,3 z" fill={sessColorMap[sess]} />
              </marker>
            ))}
          </defs>

          {/* Session cluster backgrounds */}
          {clusterBoxes.map(cl => (
            <g key={cl.sess}>
              <rect
                x={cl.x} y={cl.y} width={cl.w} height={cl.h}
                rx={12} ry={12}
                fill={cl.color}
                fillOpacity={0.05}
                stroke={cl.color}
                strokeOpacity={0.15}
                strokeWidth={1}
              />
              <text
                x={cl.x + 14} y={cl.y + 20}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
                fill={cl.color} fillOpacity={0.7}
                letterSpacing="0.12em"
              >
                {cl.sess.toUpperCase()}
              </text>
            </g>
          ))}

          {/* Edges */}
          {allEdges.map((edge, i) => {
            const from = state.clips.find(c => c.id === edge.from);
            const to = state.clips.find(c => c.id === edge.to);
            if (!from || !to || from.x === undefined || to.x === undefined) return null;

            const onPath = isPathEdge(edge.from, edge.to);
            const sessColor = sessColorMap[edge.fromSession] || '#888';
            const markerId = edge.crossSession ? `arr-${edge.fromSession.replace(/\s/g, '_')}` : onPath ? 'arr-path' : 'arr';

            return (
              <path
                key={i}
                d={edgePath(from, to)}
                fill="none"
                stroke={onPath ? '#6B8FD4' : edge.crossSession ? sessColor : 'rgba(255,255,255,0.2)'}
                strokeWidth={onPath ? 2.5 : 1.5}
                strokeDasharray={edge.crossSession ? '6 3' : undefined}
                strokeOpacity={onPath ? 1 : 0.7}
                markerEnd={`url(#${markerId})`}
                style={{ filter: onPath ? 'drop-shadow(0 0 4px rgba(107,143,212,0.6))' : undefined, transition: 'stroke 0.2s' }}
              />
            );
          })}

          {/* Nodes */}
          {state.clips.map(clip => {
            if (clip.x === undefined || clip.y === undefined) return null;
            const tc = typeColor(clip.type);
            const tg = typeGlow(clip.type);
            const onPath = isPathNode(clip.id);
            const isPlayingNow = state.playingId === clip.id;
            const isSrc = connectSource === clip.id || playbackSource === clip.id;
            const isImported = clip.customConnections !== undefined && state.clips.some(
              o => o.session !== clip.session && (o.customConnections || []).includes(clip.id)
            );

            return (
              <g
                key={clip.id}
                transform={`translate(${clip.x},${clip.y})`}
                style={{ cursor: connectMode || playbackMode ? 'crosshair' : 'pointer' }}
                onMouseDown={e => handleNodeMouseDown(clip.id, e)}
                onClick={e => handleNodeClick(clip.id, e)}
                onContextMenu={e => handleNodeContextMenu(clip.id, e)}
                onMouseEnter={e => handleNodeMouseEnter(clip, e)}
                onMouseLeave={handleNodeMouseLeave}
              >
                {/* Drop shadow / glow */}
                <rect
                  x={-2} y={-2} width={NW + 4} height={NH + 4}
                  rx={10} ry={10}
                  fill="transparent"
                  stroke={onPath ? '#6B8FD4' : isSrc ? '#fff' : tc}
                  strokeWidth={onPath ? 2.5 : isSrc ? 2 : 0}
                  strokeOpacity={onPath ? 0.9 : 0.6}
                  style={{ filter: (onPath || isSrc || isPlayingNow) ? `drop-shadow(0 0 8px ${onPath ? 'rgba(107,143,212,0.8)' : tg})` : undefined }}
                />
                {/* Card body */}
                <rect
                  x={0} y={0} width={NW} height={NH}
                  rx={8} ry={8}
                  fill={isPlayingNow ? 'rgba(74,90,153,.25)' : 'var(--bg-elevated, #1C1C1B)'}
                  stroke={isPlayingNow ? '#6B8FD4' : tc}
                  strokeWidth={1.5}
                  strokeOpacity={isPlayingNow ? 1 : 0.5}
                />
                {/* Type stripe */}
                <rect x={0} y={0} width={4} height={NH} rx={2} fill={tc} fillOpacity={0.9} />
                {/* ID */}
                <text x={12} y={17} style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }} fill="rgba(255,255,255,0.9)" fontWeight="600">
                  {clip.id}
                </text>
                {/* Name */}
                <text x={12} y={30} style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }} fill="rgba(255,255,255,0.45)">
                  {(clip.name || 'Untitled').substring(0, 16)}
                </text>
                {/* BPM / Key */}
                <text x={12} y={44} style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }} fill={tc} fillOpacity={0.75}>
                  {clip.bpm}bpm · {clip.key}
                </text>
                {/* Import badge */}
                {isImported && (
                  <g>
                    <rect x={NW - 30} y={2} width={28} height={12} rx={3} fill={tc} fillOpacity={0.2} />
                    <text x={NW - 29} y={11} style={{ fontFamily: 'var(--font-mono)', fontSize: 7 }} fill={tc} fillOpacity={0.9}>IMPORT</text>
                  </g>
                )}
                {/* Playing indicator */}
                {isPlayingNow && (
                  <g>
                    <circle cx={NW - 10} cy={10} r={4} fill="#6B8FD4">
                      <animate attributeName="r" values="3;5;3" dur="0.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;1;0.8" dur="0.8s" repeatCount="indefinite" />
                    </circle>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* ── hover popup (DOM overlay, not SVG) ──────────────────────── */}
        {hoverInfo && (
          <div
            style={{
              position: 'fixed',
              left: hoverInfo.screenX + 12, top: hoverInfo.screenY - 80,
              background: 'var(--bg-elevated, #1C1C1B)',
              border: `1px solid ${typeColor(hoverInfo.clip.type)}`,
              borderRadius: 8, padding: '10px 14px',
              minWidth: 180, zIndex: 200,
              boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 12px ${typeGlow(hoverInfo.clip.type)}`,
              fontFamily: 'var(--font-mono)',
              pointerEvents: 'none',
            }}
            onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }}
            onMouseLeave={handleNodeMouseLeave}
          >
            <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>{hoverInfo.clip.name || hoverInfo.clip.id}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 8 }}>{hoverInfo.clip.session} · {hoverInfo.clip.ago}</div>
            {/* Mini waveform */}
            <svg width={150} height={24} style={{ display: 'block', marginBottom: 6 }}>
              <polyline
                points={getWavePoints(hoverInfo.clip.id, 150, 24)}
                fill="none"
                stroke={typeColor(hoverInfo.clip.type)}
                strokeWidth={1.5}
                strokeOpacity={0.7}
              />
            </svg>
            <div style={{ display: 'flex', gap: 8, fontSize: 9, color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--amber)' }}>{hoverInfo.clip.bpm} BPM</span>
              <span>{hoverInfo.clip.key}</span>
              <span>{hoverInfo.clip.duration}</span>
            </div>
          </div>
        )}

        {/* ── context menu ────────────────────────────────────────────── */}
        {ctxMenu && (
          <div
            style={{
              position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
              background: 'var(--bg-elevated, #1C1C1B)',
              border: '1px solid var(--border-mid)',
              borderRadius: 8, padding: '4px 0',
              zIndex: 300, minWidth: 180,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              fontFamily: 'var(--font-mono)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {[
              { label: '⎇  Fork from here', action: handleContextFork, color: '#3D7A5C' },
              { label: '⊕  Connect to…', action: handleContextConnect, color: 'var(--amber)' },
              { label: '↗  View Detail', action: handleContextViewDetail, color: 'var(--text-secondary)' },
            ].map(item => (
              <div
                key={item.label}
                onClick={item.action}
                style={{
                  padding: '8px 14px', fontSize: 11, color: item.color,
                  cursor: 'pointer', letterSpacing: '0.06em',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {item.label}
              </div>
            ))}
          </div>
        )}

        {/* ── import confirm dialog ────────────────────────────────────── */}
        {importDialog && (
          <div
            style={{
              position: 'fixed',
              left: Math.min(importDialog.screenX, window.innerWidth - 260),
              top: Math.min(importDialog.screenY - 50, window.innerHeight - 120),
              background: 'var(--bg-elevated, #1C1C1B)',
              border: '1px solid var(--amber)',
              borderRadius: 8, padding: '14px 16px',
              zIndex: 300, width: 250,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 16px rgba(212,136,58,0.2)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--amber)', letterSpacing: '0.1em', marginBottom: 6 }}>IMPORT FRAGMENT</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Move <strong style={{ color: 'var(--text-primary)' }}>{importDialog.nodeId}</strong> into
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 12 }}>
              {importDialog.targetSession}?
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
              {importDialog.prevId && <span>Connects after <strong>{importDialog.prevId}</strong></span>}
              {importDialog.prevId && importDialog.nextId && ' · '}
              {importDialog.nextId && <span>Flows into <strong>{importDialog.nextId}</strong></span>}
              {!importDialog.prevId && !importDialog.nextId && 'Will be positioned at start of session.'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={confirmImport}
                style={{ flex: 1, height: 28, background: 'var(--amber)', color: '#111', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em' }}
              >CONFIRM</button>
              <button
                onClick={cancelImport}
                style={{ flex: 1, height: 28, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em' }}
              >CANCEL</button>
            </div>
          </div>
        )}

        {/* ── playback bottom bar ──────────────────────────────────────── */}
        {playbackSequence.length > 0 && (
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: 72, background: 'rgba(13,13,12,0.92)',
              borderTop: '1px solid rgba(107,143,212,0.4)',
              backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center',
              padding: '0 20px', gap: 0, zIndex: 50,
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#6B8FD4', letterSpacing: '0.14em', marginRight: 16, whiteSpace: 'nowrap' }}>PATH PLAYBACK</div>
            <div style={{ display: 'flex', gap: 0, alignItems: 'center', flex: 1, overflowX: 'auto' }}>
              {playbackSequence.map((id, i) => {
                const clip = state.clips.find(c => c.id === id);
                const active = state.playingId === id;
                return (
                  <React.Fragment key={id}>
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      padding: '4px 10px', borderRadius: 6,
                      background: active ? 'rgba(74,90,153,.4)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? '#6B8FD4' : 'rgba(255,255,255,0.08)'}`,
                      transition: 'all 0.3s',
                      minWidth: 70, flexShrink: 0,
                      boxShadow: active ? '0 0 12px rgba(107,143,212,0.5)' : 'none',
                    }}>
                      <span style={{ fontSize: 10, color: active ? '#fff' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontWeight: active ? 600 : 400 }}>{id}</span>
                      <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{clip?.bpm}bpm</span>
                    </div>
                    {i < playbackSequence.length - 1 && (
                      <div style={{ width: 20, height: 1, background: 'rgba(107,143,212,0.4)', flexShrink: 0 }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <button
              onClick={() => {
                traversalAbortRef.current = true;
                setBranchPicker(null);
                clearPlaybackSequence();
              }}
              style={{ marginLeft: 16, height: 26, padding: '0 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', flexShrink: 0 }}
            >✕ STOP</button>
          </div>
        )}

        {/* ── branch picker dialog (pauses traversal at forks) ─────────────── */}
        {branchPicker && (
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-elevated, #1C1C1B)',
            border: '1px solid #4A5A99',
            borderRadius: 12, padding: '20px 24px',
            zIndex: 400, minWidth: 300, maxWidth: 420,
            boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 24px rgba(74,90,153,0.3)',
            fontFamily: 'var(--font-mono)',
          }}>
            <div style={{ fontSize: 9, color: '#6B8FD4', letterSpacing: '0.14em', marginBottom: 6 }}>PATH DIVERGENCE</div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
              Node <span style={{ color: 'var(--amber)' }}>{branchPicker.currentNodeId}</span> branches
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
              Which path do you want to follow?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {branchPicker.choices.map(choiceId => {
                const choiceClip = state.clips.find(c => c.id === choiceId);
                const tc = typeColor(choiceClip?.type || 'root');
                return (
                  <button
                    key={choiceId}
                    onClick={() => branchPicker.resolveChoice(choiceId)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${tc}55`,
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = `${tc}18`;
                      e.currentTarget.style.borderColor = tc;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.borderColor = `${tc}55`;
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: tc, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{choiceId}</div>
                      {choiceClip && (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                          {choiceClip.name || 'Untitled'} &middot; {choiceClip.bpm}bpm &middot; {choiceClip.key} &middot; <span style={{ color: tc, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{choiceClip.type}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: tc, opacity: 0.7 }}>▸</div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { traversalAbortRef.current = true; setBranchPicker(null); clearPlaybackSequence(); }}
              style={{ marginTop: 14, width: '100%', padding: '7px 0', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em' }}
            >✕ STOP PLAYBACK</button>
          </div>
        )}

        {/* ── mode hint banner ─────────────────────────────────────────── */}
        {(connectMode || playbackMode) && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            background: connectMode ? 'rgba(212,136,58,0.95)' : 'rgba(74,90,153,0.95)',
            color: '#fff', padding: '6px 16px', borderRadius: 6,
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em',
            zIndex: 100, pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            {connectMode
              ? (connectSource ? `⊕ SELECT TARGET NODE  (ESC to cancel)` : `⊕ SELECT SOURCE NODE`)
              : (playbackSource ? `▸ SELECT DESTINATION  (source: ${playbackSource})` : `▸ SELECT START NODE`)}
          </div>
        )}
      </div>
    </div>
  );
}
