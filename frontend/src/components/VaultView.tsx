'use client';

import { useGoodwinsun } from '@/context/GoodwinsunContext';
import { getWaveform } from '@/utils/helpers';

export default function VaultView() {
  const { 
    handleCapture, 
    capturing, 
    state, 
    getFilteredClips, 
    selectClip, 
    togglePlay,
    dismissBanner,
    setTab,
    toggleFilter,
    toggleTagFilter,
    clearAllFilters,
    getActiveFilters,
    getTabCounts,
    cancelMergeMode,
    audio
  } = useGoodwinsun();

  const filteredClips = getFilteredClips();
  const activeFilters = getActiveFilters();
  const tabCounts = getTabCounts();

  return (
    <div className="view active" id="view-vault">
      <div id="capture-bar">
        {/* MANUAL RECORD BUTTON */}
        <div className="capture-btn-wrap">
          <button 
            id="btn-record-manual" 
            className={audio.isRecording ? 'capturing' : ''}
            onClick={async () => {
              if (audio.isRecording) {
                 const blob = await audio.stopRecordingAndGetBlob();
                 if (blob) handleCapture(blob);
              } else {
                 audio.startRecording();
              }
            }}
            disabled={capturing}
            style={{ 
              height: '32px', padding: '0 12px', borderRadius: '3px',
              fontFamily: 'var(--font-mono)', fontSize: '10px', 
              backgroundColor: audio.isRecording ? '#E53E3E' : 'transparent', 
              border: '1px solid var(--border)', cursor: 'pointer',
              color: audio.isRecording ? '#fff' : 'var(--text-secondary)'
            }}
          >
            {audio.isRecording ? '🔴 STOP & SAVE' : '⏺ RECORD'}
          </button>
        </div>

        {/* UPLOAD BUTTON */}
        <div className="capture-btn-wrap">
          <input 
             type="file" 
             id="audio-upload" 
             accept="audio/*" 
             style={{ display: 'none' }} 
             onChange={(e) => {
               if (e.target.files && e.target.files.length > 0) {
                 handleCapture(e.target.files[0]);
               }
             }}
          />
          <button 
            onClick={() => document.getElementById('audio-upload')?.click()}
            disabled={capturing}
            style={{ 
              background: 'transparent', border: '1px solid var(--border)', 
              padding: '0 12px', height: '32px', borderRadius: '3px', 
              fontSize: '10px', fontFamily: 'var(--font-mono)', 
              color: 'var(--text-secondary)', cursor: 'pointer'
            }}
          >
            UPLOAD MP3
          </button>
        </div>

        <div className="capture-btn-wrap">
          <button 
            id="btn-capture" 
            className={capturing ? 'capturing' : ''}
            onClick={() => handleCapture()}
            disabled={capturing || (!audio.isListening && !audio.isRecording)}
          >
            <svg id="capture-icon" width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="8"/>
            </svg>
            <span id="capture-label">{capturing ? 'CAPTURING...' : 'CAPTURE 60s'}</span>
          </button>
          <div className="cbtt">Capture the last 60 seconds from buffer</div>
        </div>
        
        <div id="capture-waveform">
          {Array.from({length: 40}, (_, i) => (
            <div key={i} className="wv-bar" style={{height: `${Math.random() * 15 + 2}px`, background: audio.isRecording ? '#E53E3E' : (audio.isListening ? 'var(--amber)' : 'var(--text-muted)')}}></div>
          ))}
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          <div id="live-chip" onClick={() => !audio.isListening && audio.startListening()} style={{cursor: 'pointer'}}>
            <div className="live-dot" style={{ backgroundColor: audio.isListening ? 'var(--amber)' : 'var(--text-muted)' }}></div>
            {audio.isListening ? 'LIVE · BUFFERING 60s' : 'MIC OFF (CLICK TO ENABLE)'}
            <div className="lctt">Circular 60-second audio buffer. Always recording.<br/>Press Capture to save.</div>
          </div>
          {audio.isListening && (
            <div id="buffer-bar-wrap">
              <div id="buffer-bar-label">BUFFER</div>
              <div id="buffer-bar-track">
                <div id="buffer-bar-fill" style={{width: '100%'}}></div>
              </div>
            </div>
          )}
        </div>
      </div>

    {/* Merge Banner */}
    {state.mergeMode && (
      <div id="merge-banner" className="vis">
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <span id="merge-banner-text">MERGE MODE ACTIVE · SELECT A SECOND FRAGMENT TO COMBINE WITH {state.mergeSourceId}</span>
          <span style={{fontSize: '8px', opacity: '.7', textTransform: 'uppercase', marginTop: '2px'}}>
            Click on another fragment card below to merge it with the selected one.
          </span>
        </div>
        <button id="merge-banner-cancel" onClick={cancelMergeMode}>CANCEL ×</button>
      </div>
    )}

      <div id="welcome-banner" className={state.bannerDismissed ? '' : 'vis'}>
        <button id="wb-close" onClick={dismissBanner}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div className="wb-title">GOODWINSUN is always listening.</div>
        <div className="wb-steps">
          <div className="wb-step"><span>01.</span>Press <strong style={{color: 'var(--amber)'}}>CAPTURE</strong> or hit <strong style={{color: 'var(--amber)'}}>C</strong> to save the last 30 seconds</div>
          <div className="wb-step"><span>02.</span>Name your fragment and review the playback</div>
          <div className="wb-step"><span>03.</span>Branch or merge ideas to evolve them across sessions</div>
          <div className="wb-step"><span>04.</span>Search fragments by mood, key, BPM, or instrument</div>
        </div>
      </div>

    {/* Tabs */}
    <div id="tab-bar">
      <button 
        className={`tab-btn ${state.activeTab === 'all' ? 'active' : ''}`} 
        onClick={() => setTab('all')}
      >
        ALL <span className="tab-badge">{tabCounts.all || 10}</span>
      </button>
      <button 
        className={`tab-btn ${state.activeTab === 'recent' ? 'active' : ''}`} 
        onClick={() => setTab('recent')}
      >
        RECENT <span className="tab-badge">{tabCounts.recent || 4}</span>
      </button>
      <button 
        className={`tab-btn ${state.activeTab === 'roots' ? 'active' : ''}`} 
        onClick={() => setTab('roots')}
      >
        ROOTS <span className="tab-badge">{tabCounts.roots || 3}</span>
      </button>
      <button 
        className={`tab-btn ${state.activeTab === 'branches' ? 'active' : ''}`} 
        onClick={() => setTab('branches')}
      >
        BRANCHES <span className="tab-badge">{tabCounts.branches || 4}</span>
      </button>
      <button 
        className={`tab-btn ${state.activeTab === 'merges' ? 'active' : ''}`} 
        onClick={() => setTab('merges')}
      >
        MERGES <span className="tab-badge">{tabCounts.merges || 2}</span>
      </button>
    </div>

    {/* Filter Chips */}
    <div id="filter-chips-bar">
      <span id="fbar-label">FILTER:</span>
      <div id="fbar-chips-inner" style={{display: 'flex', gap: '5px', alignItems: 'center', flex: 1, overflowX: 'auto', scrollbarWidth: 'none'}}>
        {activeFilters.map((filter: any) => (
          <div key={filter.key} className="filter-chip" onClick={() => toggleFilter(filter.key)}>
            {filter.label}
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
        ))}
      </div>
      <button id="fbar-clearall" onClick={clearAllFilters}>CLEAR ALL</button>
    </div>

      <div id="vault-body">
        <div id="vault-grid-wrap" className={state.selectedId ? 'panel-open' : ''}>
          <div id="vault-grid">
            {/* Group clips by session */}
            {(() => {
              const sessOrder: string[] = [];
              const sessMap: Record<string, typeof filteredClips> = {};
              filteredClips.forEach(c => {
                const s = c.session || 'Unsorted';
                if (!sessMap[s]) { sessMap[s] = []; sessOrder.push(s); }
                sessMap[s].push(c);
              });
              return sessOrder.map(sess => (
                <div key={sess} className="session-group">
                  <div className="session-header">
                    <span className="session-name">{sess}</span>
                    <span className="session-count">{sessMap[sess].length} fragment{sessMap[sess].length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="session-grid">
                    {sessMap[sess].map((clip) => {
                      const isMergeSrc = state.mergeMode && clip.id === state.mergeSourceId;
                      const isMergeSel = state.mergeMode && clip.id !== state.mergeSourceId;
                      const isActive = state.selectedId === clip.id;
                      
                      let cardClasses = 'clip-card card-in';
                      if (isActive) cardClasses += ' active';
                      if (clip.isNew) cardClasses += ' card-new glow-linger';
                      if (isMergeSrc) cardClasses += ' merge-src';
                      if (isMergeSel) cardClasses += ' merge-sel merge-pos';

                      return (
                        <div 
                          key={clip.id} 
                          className={cardClasses}
                          onClick={() => selectClip(clip.id)}
                          style={isMergeSrc ? {pointerEvents: 'none'} : undefined}
                        >
                          {isMergeSel && (
                            <div className="merge-hover-hint">MERGE WITH<br/>{clip.id}?</div>
                          )}
                          <div className="clip-card-top">
                            <div className="clip-id-wrap">
                              <span className="clip-id">{clip.name}</span>
                              <span className="detail-session" style={{fontSize: '9px', opacity: '.5', marginLeft: '4px'}}>{clip.id}</span>
                            </div>
                            <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                              {clip.isNew && <span className="new-badge">NEW</span>}
                              <span className={`type-badge ${clip.type}`}>{clip.type.toUpperCase()}</span>
                            </div>
                          </div>
                          <div className="clip-waveform">
                            {getWaveform(clip.id, 38).map((h, i) => (
                              <div key={i} className="wv-bar" style={{height: `${Math.max(3, Math.round(h * 24))}px`}}></div>
                            ))}
                          </div>
                          <div className="meta-chips">
                            <span className="meta-chip chip-bpm">{clip.bpm} BPM</span>
                            <span className="meta-chip chip-key">{clip.key}</span>
                            <span className={`meta-chip chip-mood-${clip.mood}`}>{clip.mood}</span>
                          </div>
                          <div className="clip-relations">
                            {clip.type === 'merge' && clip.parent && (
                              <div className="rel-item rel-merge-in">⊕ merged from {clip.parent}</div>
                            )}
                            {clip.type !== 'merge' && clip.parent && (
                              <div className="rel-item rel-parent" onClick={(e) => { e.stopPropagation(); selectClip(String(clip.parent).split(' + ')[0]); }}>↑ {String(clip.parent).split(' + ')[0]}</div>
                            )}
                            {clip.children.length > 0 && (
                              <div className="rel-item rel-children">↓ {clip.children.length} child{clip.children.length !== 1 ? 'ren' : ''}</div>
                            )}
                            {!clip.parent && clip.children.length === 0 && clip.type !== 'merge' && (
                              <div className="rel-item rel-isolated">○ root idea</div>
                            )}
                          </div>
                          <div className="clip-footer">
                            <span className="clip-time">{clip.ago} · {clip.duration}</span>
                            <button className="clip-play-btn" onClick={(e) => { e.stopPropagation(); togglePlay(clip.id); }} style={{ zIndex: 10, position: 'relative' }}>
                              {state.playingId === clip.id ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                  <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                                </svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                  <polygon points="5 3 19 12 5 21 5 3"/>
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
          <div id="vault-footer">
            {state.clips.length} fragment{state.clips.length !== 1 ? 's' : ''} across {[...new Set(state.clips.map(c => c.session))].length} session{[...new Set(state.clips.map(c => c.session))].length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
