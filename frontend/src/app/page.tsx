'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import VaultView from '@/components/VaultView';
import MapView from '@/components/MapView';
import SearchView from '@/components/SearchView';
import TimelineView from '@/components/TimelineView';
import DetailPanel from '@/components/DetailPanel';
import CaptureModal from '@/components/CaptureModal';
import MergeModal from '@/components/MergeModal';
import ShortcutsOverlay from '@/components/ShortcutsOverlay';
import ToastContainer from '@/components/ToastContainer';
import { useGoodwinsun } from '@/context/GoodwinsunContext';
import { ViewType } from '@/types';

export default function Home() {
  const {
    state,
    toasts,
    setView,
    handleCapture,
    handleTopbarSearch,
    clearTopbarSearch,
    toggleShortcuts,
    selectClip,
    closeDetail,
  } = useGoodwinsun();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch(e.key) {
        case 'c':
        case 'C':
          e.preventDefault();
          handleCapture();
          break;
        case '/':
          e.preventDefault();
          const searchInput = document.getElementById('topbar-search') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
          }
          break;
        case '?':
          e.preventDefault();
          toggleShortcuts();
          break;
        case 'Escape':
          e.preventDefault();
          if (state.selectedId) {
            closeDetail();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCapture, toggleShortcuts, closeDetail, state.selectedId]);

  const renderView = () => {
    switch (state.currentView) {
      case 'vault':
        return <VaultView />;
      case 'map':
        return <MapView />;
      case 'search':
        return <SearchView />;
      case 'timeline':
        return <TimelineView />;
      default:
        return <VaultView />;
    }
  };

  return (
    <div id="app">
      {state.isAnalyzing && (
        <div id="analysis-banner" style={{ position: 'fixed', top: 0, left: 0, right: 0 }}>
          <div className="analysis-dot" />
          DOING SEMANTIC ANALYSIS · WILL SAVE SOON
        </div>
      )}
      <Sidebar currentView={state.currentView} setView={setView} />
      
      <div id="main">
        <Topbar
          currentView={state.currentView}
          topbarQuery={state.topbarQuery}
          onSearch={handleTopbarSearch}
          onClearSearch={clearTopbarSearch}
          onToggleShortcuts={toggleShortcuts}
        />
        
        {renderView()}
      </div>

      <DetailPanel
        selectedId={state.selectedId}
        onClose={closeDetail}
        onSelectClip={selectClip}
      />

      <CaptureModal />
      <MergeModal />
      <ShortcutsOverlay />
      <ToastContainer toasts={toasts} />
    </div>
  );
}
