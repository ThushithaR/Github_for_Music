'use client';

import { ViewType } from '@/types';
import { VIEW_NAMES } from '@/utils/constants';

interface TopbarProps {
  currentView: ViewType;
  topbarQuery: string;
  onSearch: (query: string) => void;
  onClearSearch: () => void;
  onToggleShortcuts: () => void;
}

export default function Topbar({ 
  currentView, 
  topbarQuery, 
  onSearch, 
  onClearSearch, 
  onToggleShortcuts 
}: TopbarProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  const showSearchClear = topbarQuery.length > 0;

  return (
    <header id="topbar">
      <span id="topbar-brand">FLOWSTATE</span>
      <div id="topbar-divider"></div>
      <span id="topbar-view">{VIEW_NAMES[currentView]}</span>
      <div id="topbar-spacer"></div>
      
      <div id="topbar-right">
        {currentView !== 'search' && (
          <div id="topbar-search-wrap">
            <svg className="ts-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              id="topbar-search"
              placeholder="Filter by mood, key, BPM, tag..."
              value={topbarQuery}
              onChange={handleInputChange}
            />
            <div
              id="topbar-search-clear"
              className={showSearchClear ? 'vis' : ''}
              onClick={onClearSearch}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
          </div>
        )}
        
        <button
          id="btn-shortcuts"
          onClick={onToggleShortcuts}
          title="Keyboard shortcuts (?)"
        >
          ?
        </button>
      </div>
    </header>
  );
}
