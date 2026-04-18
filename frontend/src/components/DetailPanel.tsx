'use client';

import { useState, useRef } from 'react';
import { useGoodwinsun } from '@/context/GoodwinsunContext';
import { getWaveform } from '@/utils/helpers';

interface DetailPanelProps {
  selectedId: string | null;
  onClose: () => void;
  onSelectClip: (id: string) => void;
}

export default function DetailPanel({ selectedId, onClose, onSelectClip }: DetailPanelProps) {
  const { 
    state, 
    toggleEdit, 
    handleAction, 
    changeRate, 
    toggleDetailPlay,
    copyId,
    activeOverlay,
    successMessage,
    hideOverlays,

    confirmFork,
    confirmDelete,
    confirmExport,
  } = useGoodwinsun();

  // Refs for overlay form inputs

  const forkSessionRef = useRef<HTMLInputElement>(null);
  const [showAllNotes, setShowAllNotes] = useState(false);

  if (!selectedId) return null;

  const selectedClip = state.clips.find(c => c.id === selectedId);
  if (!selectedClip) return null;

  const waveformBars = getWaveform(selectedId, 54);

  // Get existing sessions for fork dropdown
  const existingSessions = [...new Set(state.clips.map(c => c.session))];

  return (
    <div id="detail-panel" className="open">
      <div id="detail-panel-inner">
        <div className="detail-header">
          <div className="detail-id-block">
            <div className="detail-id-row">
              <span className="detail-id">{selectedClip.name}</span>
              <span className="detail-session" style={{fontSize: '10px', opacity: '.5'}}>{selectedId}</span>
              <span className="detail-copy" onClick={() => copyId(selectedId)} title="Copy ID">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </span>
            </div>
            <span className="detail-session">{selectedClip.session} · {selectedClip.ago}</span>
          </div>
          <div style={{display: 'flex', gap: '4px'}}>
            <button className="detail-close" onClick={toggleEdit} title="Edit Metadata">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button className="detail-close" onClick={onClose}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>



        {/* ======== FORK OVERLAY ======== */}
        {activeOverlay === 'fork' && (
          <div className="panel-overlay vis">
            <div className="po-title">FORKING <span style={{color: 'var(--text-primary)'}}>{selectedClip.name}</span> <span style={{opacity: 0.5, fontSize: '9px'}}>{selectedId}</span></div>
            <div className="po-text">Duplicate this fragment into a different session for independent exploration. The fork starts as a new root idea.</div>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '8px 10px', marginBottom: '10px', fontFamily: 'var(--font-mono)', fontSize: '9px',
              color: 'var(--text-muted)', lineHeight: '1.7'
            }}>
              <strong style={{color: 'var(--text-secondary)'}}>Fragment:</strong> {selectedClip.name} · {selectedClip.bpm} BPM · {selectedClip.key}<br/>
              <strong style={{color: 'var(--text-secondary)'}}>Current Session:</strong> {selectedClip.session}<br/>
              <strong style={{color: 'var(--text-secondary)'}}>Type:</strong> {selectedClip.type} → will become <strong style={{color: 'var(--amber)'}}>root</strong>
            </div>
            <div className="po-row">
              <div className="po-label">TARGET SESSION</div>
              <input 
                className="po-sel" 
                ref={forkSessionRef} 
                type="text" 
                placeholder="e.g. Session Z" 
                defaultValue={`${selectedClip.session} (Fork)`}
                list="session-suggestions"
              />
              <datalist id="session-suggestions">
                {existingSessions.map(s => (
                  <option key={s} value={s} />
                ))}
                <option value={`${selectedClip.session} (Fork)`} />
                <option value="Session X" />
                <option value="Session Y" />
                <option value="Session Z" />
              </datalist>
            </div>
            <div className="po-btns">
              <button className="po-btn" onClick={hideOverlays}>CANCEL</button>
              <button className="po-btn primary" onClick={() => {
                confirmFork(forkSessionRef.current?.value || `${selectedClip.session} (Fork)`);
              }}>FORK FRAGMENT</button>
            </div>
          </div>
        )}

        {/* ======== DELETE CONFIRMATION OVERLAY ======== */}
        {activeOverlay === 'delete' && (
          <div className="panel-overlay vis">
            <div className="po-title" style={{color: '#ff5555'}}>DELETE FRAGMENT</div>
            <div className="po-text">
              Are you sure you want to permanently delete this fragment? This action cannot be undone.
            </div>
            <div style={{
              background: 'rgba(255,85,85,0.06)', border: '1px solid rgba(255,85,85,0.2)', borderRadius: 'var(--radius-sm)',
              padding: '10px 12px', marginBottom: '10px', fontFamily: 'var(--font-mono)', fontSize: '10px',
              color: 'var(--text-secondary)', lineHeight: '1.8'
            }}>
              <strong style={{color: '#ff5555'}}>⚠ Deleting:</strong><br/>
              <span style={{color: 'var(--text-primary)', fontSize: '12px'}}>{selectedClip.name}</span><br/>
              <span style={{color: 'var(--text-muted)', fontSize: '9px'}}>
                ID: {selectedId} · {selectedClip.bpm} BPM · {selectedClip.key} · {selectedClip.mood}<br/>
                Session: {selectedClip.session} · Duration: {selectedClip.duration}<br/>
                {selectedClip.children.length > 0 && (
                  <>Children: {selectedClip.children.join(', ')} — these will lose their parent reference<br/></>
                )}
              </span>
            </div>
            <div className="po-btns">
              <button className="po-btn" onClick={hideOverlays}>CANCEL</button>
              <button className="po-btn" onClick={confirmDelete} style={{
                background: '#ff5555', borderColor: '#ff5555', color: 'var(--bg-base)'
              }}>DELETE FOREVER</button>
            </div>
          </div>
        )}

        {/* ======== EXPORT OVERLAY ======== */}
        {activeOverlay === 'export' && (
          <div className="panel-overlay vis">
            <div className="po-title">EXPORT FRAGMENT</div>
            <div className="po-text">Download this audio fragment as a .wav file.</div>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '10px 12px', marginBottom: '10px', fontFamily: 'var(--font-mono)', fontSize: '10px',
              color: 'var(--text-secondary)', lineHeight: '1.8'
            }}>
              <strong style={{color: 'var(--amber)'}}>📦 Exporting:</strong><br/>
              <span style={{color: 'var(--text-primary)', fontSize: '12px'}}>{selectedClip.name}</span><br/>
              <span style={{color: 'var(--text-muted)', fontSize: '9px'}}>
                ID: {selectedId} · {selectedClip.bpm} BPM · {selectedClip.key}<br/>
                Duration: {selectedClip.duration} · Format: WAV (lossless)
              </span>
            </div>
            <div className="po-btns">
              <button className="po-btn" onClick={hideOverlays}>CANCEL</button>
              <button className="po-btn primary" onClick={confirmExport}>DOWNLOAD .WAV</button>
            </div>
          </div>
        )}

        {/* ======== SUCCESS MESSAGE ======== */}
        {successMessage && (
          <div id="action-success" className="vis" style={{
            display: 'block', padding: '12px 14px', background: 'rgba(61,122,92,.1)',
            border: '1px solid rgba(61,122,92,.25)', borderRadius: 'var(--radius-sm)',
            margin: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '11px',
            color: 'var(--green)', lineHeight: '1.8', whiteSpace: 'pre-line'
          }}>
            {successMessage}
          </div>
        )}

        {/* PLAYBACK */}
        <div className="detail-section-label">
          <span className="dsl-text">PLAYBACK</span>
          <div className="dsl-line"></div>
        </div>
        <div className="detail-section">
          <div className="detail-waveform">
            {waveformBars.map((h, i) => (
              <div key={i} style={{
                width: '3px', borderRadius: '1px', background: 'var(--amber)',
                opacity: 0.6, height: `${Math.max(3, Math.round(h * 34))}px`, flexShrink: 0
              }}></div>
            ))}
          </div>
          <div className="detail-play-row">
            <button 
              className={`detail-play-btn ${state.playingId === selectedId ? 'playing' : ''}`} 
              onClick={() => toggleDetailPlay(selectedId)}
            >
              {state.playingId === selectedId ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              )}
            </button>
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span className="detail-duration">{selectedClip.duration}</span>
                <span style={{fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--amber)'}}>
                  {state.playbackRate}x
                </span>
              </div>
              <input 
                type="range" min="0.5" max="2.0" step="0.1" 
                value={state.playbackRate} 
                onChange={(e) => changeRate(parseFloat(e.target.value))}
                style={{width: '100%', accentColor: 'var(--amber)', height: '2px', cursor: 'pointer'}}
              />
            </div>
          </div>
        </div>

        {/* METADATA */}
        <div className="detail-section-label">
          <span className="dsl-text">METADATA</span>
          <div className="dsl-line"></div>
        </div>
        <div className="detail-section">
          <div className="meta-grid">
            <div className="meta-cell">
              <div className="meta-cell-label">BPM</div>
              <div className="meta-cell-value">{selectedClip.bpm}</div>
            </div>
            <div className="meta-cell">
              <div className="meta-cell-label" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span>KEY</span>
                <button 
                  onClick={() => setShowAllNotes(!showAllNotes)}
                  style={{
                    background: 'transparent', border: 'none', 
                    fontSize: '8px', fontFamily: 'var(--font-mono)', 
                    color: showAllNotes ? 'var(--amber)' : 'var(--text-muted)', cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {showAllNotes ? 'HIDE' : 'VIEW ALL'}
                </button>
              </div>
              <div className="meta-cell-value">{selectedClip.key}</div>
            </div>
            <div className="meta-cell">
              <div className="meta-cell-label">MOOD</div>
              <div className="meta-cell-value">{selectedClip.mood}</div>
            </div>
            <div className="meta-cell">
              <div className="meta-cell-label">TYPE</div>
              <div className="meta-cell-value">{selectedClip.type.toUpperCase()}</div>
            </div>
          </div>
        </div>

        {/* HARMONIC TIMELINE */}
        {showAllNotes && (
          <>
            <div className="detail-section-label">
              <span className="dsl-text">COMPUTED NOTES TIMELINE</span>
              <div className="dsl-line"></div>
            </div>
            <div className="detail-section">
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '4px'}}>
                {(selectedClip.keyTimeline && selectedClip.keyTimeline.length > 0 
                  ? selectedClip.keyTimeline 
                  : Array.from({length: 6}, (_, i) => ({
                      start: i * 10,
                      end: (i + 1) * 10,
                      key: ["C maj", "A min", "G maj", "F maj", "D min"][Math.floor(Math.random() * 5)]
                    }))
                ).map((kt: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontFamily: 'var(--font-mono)', fontSize: '9px',
                    background: 'var(--bg-elevated)', padding: '4px 8px',
                    borderRadius: '2px', border: '1px solid var(--border)'
                  }}>
                    <span style={{color: 'var(--text-muted)'}}>{kt.start}-{kt.end}s</span>
                    <span style={{color: 'var(--amber)'}}>{kt.key}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* INSTRUMENT */}
        <div className="detail-section-label">
          <span className="dsl-text">INSTRUMENT</span>
          <div className="dsl-line"></div>
        </div>
        <div className="detail-section">
          <div className="detail-field-value">{selectedClip.instrument}</div>
        </div>



        {/* ACTIONS */}
        <div className="detail-section-label">
          <span className="dsl-text">ACTIONS</span>
          <div className="dsl-line"></div>
        </div>
        <div className="detail-section">
          <div className="actions-grid">

            <button 
              className={`action-btn ${activeOverlay === 'fork' ? 'active-m' : ''}`}
              onClick={() => handleAction('fork')} 
              title="Duplicate fragment to another session"
            >
              FORK
            </button>
            <button 
              className={`action-btn ${state.mergeMode ? 'active-m' : ''}`}
              onClick={() => handleAction('merge')} 
              title="Combine this fragment with another"
            >
              MERGE
            </button>
            <button 
              className={`action-btn ${activeOverlay === 'export' ? 'active-m' : ''}`}
              onClick={() => handleAction('export')} 
              title="Download as .wav file"
            >
              EXPORT
            </button>
            <button 
              className={`action-btn ${activeOverlay === 'delete' ? 'active-m' : ''}`}
              onClick={() => handleAction('delete')} 
              title="Delete this fragment forever" 
              style={{gridColumn: 'span 2', color: '#ff5555', borderColor: 'rgba(255,85,85,0.2)'}}
            >
              DELETE FRAGMENT
            </button>
          </div>
        </div>

        {/* LINEAGE */}
        <div className="detail-section-label">
          <span className="dsl-text">LINEAGE</span>
          <div className="dsl-line"></div>
        </div>
        <div className="lineage-section">
          <LineageSVG clip={selectedClip} onSelectClip={onSelectClip} />
        </div>
      </div>
    </div>
  );
}

/* Lineage SVG sub-component */
function LineageSVG({ clip, onSelectClip }: { clip: any; onSelectClip: (id: string) => void }) {
  const W = 294, H = 80, CX = W / 2, CY = H / 2, RC = 17, R = 12;
  const pids = clip.parent ? String(clip.parent).split(' + ').map((s: string) => s.trim()) : [];
  const kids = (clip.children || []).slice(0, 3);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" style={{width: '100%', height: '80px'}}>
      <defs>
        <marker id="la" markerWidth="5" markerHeight="5" refX="4" refY="2" orient="auto">
          <path d="M0,0 L0,4 L5,2 z" fill="rgba(255,255,255,0.18)"/>
        </marker>
      </defs>
      {/* Current node */}
      <circle cx={CX} cy={CY} r={RC} fill="rgba(212,136,58,.18)" stroke="#D4883A" strokeWidth="1.5"/>
      <text x={CX} y={CY + 1} textAnchor="middle" dominantBaseline="middle" 
        fontFamily="DM Mono,monospace" fontSize="9" fontWeight="500" fill="rgba(255,255,255,.88)">{clip.id}</text>
      
      {/* Parents */}
      {pids.length > 0 ? pids.map((pid: string, i: number) => {
        const px = pids.length === 1 ? W * 0.18 : (i === 0 ? W * 0.12 : W * 0.28);
        return (
          <g key={pid} style={{cursor: 'pointer'}} onClick={() => onSelectClip(pid)}>
            <line x1={px + R} y1={CY} x2={CX - RC} y2={CY} stroke="rgba(255,255,255,.1)" strokeWidth="1" markerEnd="url(#la)"/>
            <circle cx={px} cy={CY} r={R} fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.18)" strokeWidth="1"/>
            <text x={px} y={CY + 1} textAnchor="middle" dominantBaseline="middle" 
              fontFamily="DM Mono,monospace" fontSize="8" fill="rgba(255,255,255,.5)">{pid}</text>
          </g>
        );
      }) : (
        <text x={W * 0.18} y={CY + 1} textAnchor="middle" dominantBaseline="middle" 
          fontFamily="DM Mono,monospace" fontSize="8" fill="rgba(255,255,255,.18)" fontStyle="italic">root</text>
      )}
      
      {/* Children */}
      {kids.length > 0 ? kids.map((cid: string, i: number) => {
        const yOff = (i - (kids.length - 1) / 2) * 22;
        const cx2 = W * 0.8, cy2 = CY + yOff;
        return (
          <g key={cid} style={{cursor: 'pointer'}} onClick={() => onSelectClip(cid)}>
            <line x1={CX + RC} y1={CY} x2={cx2 - R} y2={cy2} stroke="rgba(255,255,255,.1)" strokeWidth="1" markerEnd="url(#la)"/>
            <circle cx={cx2} cy={cy2} r={R} fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.18)" strokeWidth="1"/>
            <text x={cx2} y={cy2 + 1} textAnchor="middle" dominantBaseline="middle" 
              fontFamily="DM Mono,monospace" fontSize="8" fill="rgba(255,255,255,.5)">{cid}</text>
          </g>
        );
      }) : (
        <text x={W * 0.82} y={CY + 1} textAnchor="middle" dominantBaseline="middle" 
          fontFamily="DM Mono,monospace" fontSize="8" fill="rgba(255,255,255,.18)" fontStyle="italic">none</text>
      )}
    </svg>
  );
}
