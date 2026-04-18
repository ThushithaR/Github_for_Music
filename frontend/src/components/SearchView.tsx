'use client';

import { useGoodwinsun } from '@/context/GoodwinsunContext';
import { Clip } from '@/types';

export default function SearchView() {
  const { state, handleSemanticSearch, triggerSuggestion, selectClip, setView } = useGoodwinsun();

  const suggestions = [
    { label: 'melancholic', value: 'melancholic' },
    { label: 'lofi', value: 'lofi' },
    { label: 'Session A', value: 'Session A' },
    { label: '120 BPM', value: '120' },
    { label: 'branches', value: 'branch' },
    { label: 'merges', value: 'merge' },
    { label: 'E minor', value: 'E min' },
    { label: 'synth', value: 'synth' },
  ];

  const query = state.topbarQuery.trim().toLowerCase();

  const getMatchedClips = () => {
    if (!query) return [];
    return state.clips.filter((c: Clip) => 
      (c.name && c.name.toLowerCase().includes(query)) ||
      c.id.toLowerCase().includes(query) ||
      (c.mood || '').toLowerCase().includes(query) ||
      (c.key || '').toLowerCase().includes(query) ||
      String(c.bpm || '').includes(query) ||
      (c.instrument || '').toLowerCase().includes(query) ||
      (c.session || '').toLowerCase().includes(query) ||
      (c.type || '').toLowerCase().includes(query)
    );
  };

  const matched = getMatchedClips();

  const goToClip = (id: string) => {
    setView('vault');
    setTimeout(() => {
      selectClip(id);
      const card = document.getElementById('card-' + id);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 80);
  };

  return (
    <div className="view active" id="view-search" style={{ background: 'var(--bg-base)', overflowY: 'auto', display: state.currentView === 'search' ? 'flex' : 'none' }}>
      <div id="search-container" style={{ maxWidth: '560px', margin: '0 auto', padding: '56px 24px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
        <div id="search-view-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.18em', color: 'var(--text-muted)', marginBottom: '14px' }}>SEMANTIC SEARCH</div>
        <div id="search-input-wrap" style={{ width: '100%', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <svg style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            type="text" 
            id="search-main-input" 
            placeholder="Search by mood, key, BPM, tag, instrument..."
            value={state.topbarQuery}
            onChange={(e) => handleSemanticSearch(e.target.value)}
            style={{ width: '100%', height: '44px', background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', borderRadius: 'var(--radius-sm)', padding: '0 14px 0 40px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)', transition: 'border-color var(--transition-fast)' }}
          />
        </div>
        <div id="search-helper" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '0.04em' }}>
          TRY: chill &nbsp;·&nbsp; vocal &nbsp;·&nbsp; 90 bpm &nbsp;·&nbsp; C major &nbsp;·&nbsp; energetic
        </div>
        
        {!query && (
          <div className="search-suggestions" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '10px' }}>
            <div className="search-explain" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.7', marginTop: '4px' }}>
              Search works across mood, key, BPM, tags, instrument, and session name.<br/>
              Click any suggestion to try it instantly.
            </div>
            <div className="search-sugg-label" style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: '6px' }}>TRY SEARCHING</div>
            <div className="search-sugg-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {suggestions.map((sugg) => (
                <div 
                  key={sugg.value} 
                  className="sugg-chip"
                  onClick={() => triggerSuggestion(sugg.value)}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '2px', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all var(--transition-fast)' }}
                >
                  {sugg.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {query && matched.length > 0 && (
          <div id="search-results" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '14px' }}>
            {matched.map(c => {
              const mCls = `chip-mood-${c.mood}`;
              return (
                <div 
                  key={c.id} 
                  className="search-card" 
                  onClick={() => goToClip(c.id)}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all var(--transition-fast)' }}
                >
                  <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '2px'}}>
                    <span className="search-card-id" style={{fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 500}}>{c.name || c.id}</span>
                    <span style={{fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)'}}>{c.id}</span>
                  </div>
                  <div className="search-card-meta" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="meta-chip chip-bpm">{c.bpm} BPM</div>
                    <div className="meta-chip chip-key">{c.key}</div>
                    <div className={`meta-chip ${mCls}`}>{c.mood}</div>
                  </div>
                  <span className={`type-badge ${c.type}`}>{c.type.toUpperCase()}</span>
                </div>
              );
            })}
          </div>
        )}

        {query && matched.length === 0 && (
          <div id="search-empty" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0', lineHeight: '1.7', width: '100%' }}>
            NO FRAGMENTS MATCH "<span style={{color: 'var(--amber)'}}>{state.topbarQuery}</span>"<br/>
            <span style={{fontSize: '10px', opacity: 0.6}}>Try "chill", "guitar", or a BPM value</span>
          </div>
        )}
      </div>
    </div>
  );
}
