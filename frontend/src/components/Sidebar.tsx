'use client';

import { ViewType } from '@/types';

interface SidebarProps {
  currentView: ViewType;
  setView: (view: ViewType) => void;
}

export default function Sidebar({ currentView, setView }: SidebarProps) {
  return (
    <aside id="sidebar">
      <div id="sidebar-logo" title="GOODWINSUN">
        <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
          <path 
            d="M1 10 Q3 2 5 7 Q7 12 9 5 Q11 -1 13 7 Q15 12 17 4 Q19 0 19 4" 
            stroke="#D4883A" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </div>
      
      <button 
        className={`nav-btn ${currentView === 'vault' ? 'active' : ''}`} 
        onClick={() => setView('vault')} 
        title="The Vault"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span className="vault-dot"></span>
      </button>
      
      <button 
        className={`nav-btn ${currentView === 'map' ? 'active' : ''}`} 
        onClick={() => setView('map')} 
        title="Evolution Map"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="2"/>
          <circle cx="5" cy="19" r="2"/>
          <circle cx="19" cy="19" r="2"/>
          <line x1="12" y1="7" x2="5" y2="17"/>
          <line x1="12" y1="7" x2="19" y2="17"/>
        </svg>
      </button>
      
      <button 
        className={`nav-btn ${currentView === 'search' ? 'active' : ''}`} 
        onClick={() => setView('search')} 
        title="Semantic Search"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>
      
      <button 
        className={`nav-btn ${currentView === 'timeline' ? 'active' : ''}`} 
        onClick={() => setView('timeline')} 
        title="Session Timeline"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
          <circle cx="7" cy="6" r="2" fill="currentColor" stroke="none"/>
          <circle cx="14" cy="12" r="2" fill="currentColor" stroke="none"/>
          <circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/>
        </svg>
      </button>
    </aside>
  );
}
