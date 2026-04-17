'use client';

import { useGoodwinsun } from '@/context/GoodwinsunContext';

export default function ShortcutsOverlay() {
  const { shortcutsVisible, toggleShortcuts } = useGoodwinsun();

  if (!shortcutsVisible) return null;

  return (
    <div id="shortcuts-overlay" className="vis">
      <div id="shortcuts-box">
        <div className="sc-title">KEYBOARD SHORTCUTS</div>
        <div className="sc-row">
          <span className="sc-key">C</span>
          <span className="sc-desc">Capture last 30s</span>
        </div>
        <div className="sc-row">
          <span className="sc-key">/</span>
          <span className="sc-desc">Focus search</span>
        </div>
        <div className="sc-row">
          <span className="sc-key">ESC</span>
          <span className="sc-desc">Close panel / cancel action</span>
        </div>
        <div className="sc-row">
          <span className="sc-key">?</span>
          <span className="sc-desc">Toggle this panel</span>
        </div>
        <div className="sc-close">
          <button onClick={toggleShortcuts}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}
