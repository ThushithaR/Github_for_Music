'use client';

import { useGoodwinsun } from '@/context/GoodwinsunContext';
import { Clip } from '@/types';

export default function TimelineView() {
  const { state, setView, selectClip } = useGoodwinsun();

  if (!state.clips || state.clips.length === 0) {
    return (
      <div className="view active" id="view-timeline" style={{ background: 'var(--bg-base)', overflowY: 'auto', display: state.currentView === 'timeline' ? 'flex' : 'none' }}>
        <div id="timeline-container" style={{ maxWidth: '740px', margin: '0 auto', padding: '28px 24px 60px', width: '100%' }}>
          <div className="tl-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
            <div className="tl-title" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-muted)' }}>SESSION TIMELINE</div>
          </div>
          <div className="tl-empty" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
            No sessions yet. Capture your first idea to begin.
          </div>
        </div>
      </div>
    );
  }

  // Build sessions object
  const sessOrder: string[] = [];
  const sessMap: Record<string, Clip[]> = {};
  state.clips.forEach(c => {
    const s = c.session || 'Unsorted';
    if (!sessMap[s]) {
      sessMap[s] = [];
      sessOrder.push(s);
    }
    sessMap[s].push(c);
  });

  const agoScore = (s: string) => {
    if (!s) return 9999;
    if (s.includes('just now')) return 0;
    if (s.includes('m ago')) return parseInt(s) || 99;
    if (s.includes('h ago')) return (parseInt(s) || 99) * 60;
    return 9999;
  };
  
  sessOrder.sort((a, b) => agoScore(sessMap[a][0].ago) - agoScore(sessMap[b][0].ago));

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
    <div className="view active" id="view-timeline" style={{ background: 'var(--bg-base)', overflowY: 'auto', display: state.currentView === 'timeline' ? 'flex' : 'none' }}>
      <div id="timeline-container" style={{ maxWidth: '740px', margin: '0 auto', padding: '28px 24px 60px', width: '100%' }}>
        <div className="tl-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
          <div className="tl-title" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-muted)' }}>SESSION TIMELINE</div>
        </div>
        <div className="tl-sessions" id="tl-sessions" style={{ display: 'flex', flexDirection: 'column' }}>
          {sessOrder.map((sess) => {
            const clips = sessMap[sess];
            const ago = clips[0]?.ago || '';
            
            // Build tree order
            const roots = clips.filter(c => !c.parent || !clips.find(x => x.id === c.parent));
            const ordered: Clip[] = [];
            const seen = new Set<string>();
            
            const add = (c: Clip) => {
              if (!c || seen.has(c.id)) return;
              seen.add(c.id);
              ordered.push(c);
              (c.children || []).forEach(cid => {
                const nc = clips.find(x => x.id === cid);
                if (nc) add(nc);
              });
            };
            
            roots.forEach(r => add(r));
            clips.forEach(c => {
              if (!seen.has(c.id)) add(c);
            });

            return (
              <div key={sess} className="tl-row" style={{ display: 'flex', gap: 0 }}>
                <div className="tl-left" style={{ width: '130px', minWidth: '130px', paddingTop: '6px', paddingRight: '20px', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                  <div className="tl-sess-name" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em' }}>{sess}</div>
                  <div className="tl-sess-ago" style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)' }}>{ago}</div>
                </div>
                <div className="tl-spine" style={{ width: '1px', background: 'var(--border-mid)', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="tl-spine-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--amber)', position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)' }}></div>
                </div>
                <div className="tl-right" style={{ flex: 1, padding: '0 0 28px 20px', minWidth: 0 }}>
                  <div className="tl-track" style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '6px' }}>
                    {ordered.map((c, i) => {
                      const nName = c.name || c.id || '';
                      const isLast = i === ordered.length - 1;
                      
                      return (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center' }}>
                          <div 
                            className="tl-node" 
                            onClick={() => goToClip(c.id)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                          >
                            <div 
                              className={`tl-dot ${c.type}`} 
                              title={`${c.id} · ${c.bpm} BPM · ${c.mood}`}
                              style={{ width: '34px', height: '34px', borderRadius: '50%', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 500, background: 'var(--bg-base)', transition: 'transform 0.15s' }}
                            >
                              {String(nName).substring(0, 3)}
                            </div>
                            <div className="tl-node-lbl" style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60px', textAlign: 'center' }}>
                              {String(nName).substring(0, 10)}
                            </div>
                          </div>
                          {!isLast && (
                            <div className="tl-edge" style={{ width: '20px', height: '2px', background: 'var(--border-mid)', alignSelf: 'center', flexShrink: 0, marginBottom: '20px' }}></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
