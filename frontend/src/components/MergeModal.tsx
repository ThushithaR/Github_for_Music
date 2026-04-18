'use client';

import { useGoodwinsun } from '@/context/GoodwinsunContext';

export default function MergeModal() {
  const { 
    state,
    confirmMerge,
    cancelMergeModal
  } = useGoodwinsun();

  if (!state.isMergeModalOpen || !state.mergeSourceId || !state.mergeTargetId) return null;

  const sourceClip = state.clips.find(c => c.id === state.mergeSourceId);
  const targetClip = state.clips.find(c => c.id === state.mergeTargetId);

  return (
    <div id="capture-modal-bg" className="vis" onClick={(e) => { if (e.target === e.currentTarget) cancelMergeModal(); }}>
      <div id="capture-modal" style={{ maxWidth: '400px' }}>
        <div className="cm-header">
          <span className="cm-title">MERGE STRATEGY</span>
          <button className="cm-close" onClick={cancelMergeModal}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="cm-subtitle">How should these fragments be combined?</div>
        
        <div className="cm-body">
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            padding: '12px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>ROOT</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '11px' }}>{sourceClip?.name || state.mergeSourceId}</span>
            </div>
            <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>TARGET</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '11px' }}>{targetClip?.name || state.mergeTargetId}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              className="cm-btn" 
              onClick={() => confirmMerge('sequential')}
              style={{ padding: '15px', height: 'auto', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
              <span style={{ color: 'var(--amber)', fontSize: '11px', fontWeight: '600' }}>CONTINUE AFTER ROOT</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '9px', textTransform: 'none', letterSpacing: '0' }}>
                Plays the root fragment first, followed immediately by the target.
              </span>
            </button>

            <button 
              className="cm-btn" 
              onClick={() => confirmMerge('overlap')}
              style={{ padding: '15px', height: 'auto', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
              <span style={{ color: 'var(--amber)', fontSize: '11px', fontWeight: '600' }}>OVERLAP AUDIO</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '9px', textTransform: 'none', letterSpacing: '0' }}>
                Plays both fragments simultaneously at the same time.
              </span>
            </button>
          </div>
        </div>

        <div className="cm-footer" style={{ marginTop: '10px' }}>
          <button className="cm-btn cm-btn-discard" onClick={cancelMergeModal}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}
