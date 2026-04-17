'use client';

import { useGoodwinsun } from '@/context/GoodwinsunContext';

export default function SearchView() {
  const { handleSemanticSearch, triggerSuggestion } = useGoodwinsun();

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

  return (
    <div className="view" id="view-search">
      <div id="search-container">
        <div id="search-view-label">SEMANTIC SEARCH</div>
        <div id="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            type="text" 
            id="search-main-input" 
            placeholder="Search by mood, key, BPM, tag, instrument..."
            onChange={(e) => handleSemanticSearch(e.target.value)}
          />
        </div>
        <div id="search-helper">TRY: chill &nbsp;·&nbsp; vocal &nbsp;·&nbsp; 90 bpm &nbsp;·&nbsp; C major &nbsp;·&nbsp; energetic</div>
        <div className="search-suggestions">
          <div className="search-explain">
            Search works across mood, key, BPM, tags, instrument, and session name.<br/>
            Click any suggestion to try it instantly.
          </div>
          <div className="search-sugg-label" style={{marginTop: '6px'}}>TRY SEARCHING</div>
          <div className="search-sugg-chips">
            {suggestions.map((sugg) => (
              <div 
                key={sugg.value} 
                className="sugg-chip"
                onClick={() => triggerSuggestion(sugg.value)}
              >
                {sugg.label}
              </div>
            ))}
          </div>
        </div>
        <div id="search-results"></div>
        <div id="search-empty"></div>
      </div>
    </div>
  );
}
