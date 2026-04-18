'use client';

import { useRef, useCallback, useState } from 'react';
import { useGoodwinsun } from '@/context/GoodwinsunContext';

export default function CaptureModal() {
  const { 
    captureModalVisible, 
    pendingCapture, 
    cmTags, 
    setCmTags, 
    closeCaptureModal, 
    saveCapture, 
    discardCapture 
  } = useGoodwinsun();

  const idRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const moodRef = useRef<HTMLSelectElement>(null);
  const instrumentRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<HTMLInputElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const handleTagInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const inp = e.currentTarget;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = inp.value.replace(',', '').trim();
      if (val && !cmTags.includes(val)) {
        setCmTags([...cmTags, val]);
      }
      inp.value = '';
    }
  }, [cmTags, setCmTags]);

  const removeTag = useCallback((tag: string) => {
    setCmTags(cmTags.filter(t => t !== tag));
  }, [cmTags, setCmTags]);

  const handleSave = useCallback(() => {
    // Pass form values to the saveCapture function via refs
    if (pendingCapture) {
      // Update pendingCapture with form values before saving
      pendingCapture.id = idRef.current?.value?.trim() || pendingCapture.id;
      pendingCapture.name = nameRef.current?.value?.trim() || '';
      pendingCapture.mood = moodRef.current?.value || pendingCapture.mood;
      pendingCapture.instrument = instrumentRef.current?.value || pendingCapture.instrument;
      pendingCapture.session = sessionRef.current?.value || pendingCapture.session;
      pendingCapture.duration = durationRef.current?.value || pendingCapture.duration;
    }
    saveCapture();
  }, [pendingCapture, saveCapture]);

  if (!captureModalVisible || !pendingCapture) return null;

  return (
    <div id="capture-modal-bg" className="vis" onClick={(e) => { if (e.target === e.currentTarget) discardCapture(); }}>
      <div id="capture-modal">
        <div className="cm-header">
          <span className="cm-title">REVIEW CAPTURE</span>
          <button className="cm-close" onClick={closeCaptureModal}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="cm-subtitle">AI detected the following. Edit before saving.</div>
        <div className="cm-body">
          <div className="cm-row2">
            <div className="cm-field">
              <div className="cm-label">FRAGMENT ID</div>
              <input className="cm-input" ref={idRef} type="text" maxLength={8} defaultValue={pendingCapture.id} />
            </div>
            <div className="cm-field">
              <div className="cm-label">BPM (detected)</div>
              <div className="cm-input-readonly">{pendingCapture.bpm}</div>
            </div>
          </div>
          <div className="cm-row2">
            <div className="cm-field">
              <div className="cm-label">KEY (detected)</div>
              <div className="cm-input-readonly">{pendingCapture.key}</div>
            </div>
            <div className="cm-field">
              <div className="cm-label">MOOD</div>
              <select className="cm-select" ref={moodRef} defaultValue={pendingCapture.mood}>
                <option>melancholic</option>
                <option>dark</option>
                <option>energetic</option>
                <option>bright</option>
                <option>chill</option>
                <option>upbeat</option>
                <option>tense</option>
              </select>
            </div>
          </div>
          <div className="cm-field">
            <div className="cm-label">INSTRUMENT</div>
            <input className="cm-input" ref={instrumentRef} type="text" defaultValue={pendingCapture.instrument} />
          </div>
          <div className="cm-field">
            <div className="cm-label">FRAGMENT NAME</div>
            <input className="cm-input" ref={nameRef} type="text" placeholder="e.g. Birds in the park..." defaultValue={pendingCapture.name || ''} />
          </div>
          <div className="cm-row2">
            <div className="cm-field">
              <div className="cm-label">SESSION</div>
              <input className="cm-input" ref={sessionRef} type="text" defaultValue={pendingCapture.session} />
            </div>
            <div className="cm-field">
              <div className="cm-label">DURATION</div>
              <input className="cm-input" ref={durationRef} type="text" placeholder="0:00" defaultValue={pendingCapture.duration} />
            </div>
          </div>
          <div className="cm-field">
            <div className="cm-label">NOTES (optional)</div>
            <textarea className="cm-textarea" ref={notesRef} placeholder="Any thoughts about this capture..."></textarea>
          </div>
        </div>
        <div className="cm-footer">
          <button className="cm-btn cm-btn-discard" onClick={discardCapture}>DISCARD</button>
          <button className="cm-btn cm-btn-save" onClick={handleSave}>SAVE FRAGMENT</button>
        </div>
      </div>
    </div>
  );
}
