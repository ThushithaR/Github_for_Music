'use client';

import { useGoodwinsun } from '@/context/GoodwinsunContext';

export default function TimelineView() {
  const { state } = useGoodwinsun();

  // Group clips by session
  const sessions = state.clips.reduce((acc: any, clip) => {
    if (!acc[clip.session]) {
      acc[clip.session] = [];
    }
    acc[clip.session].push(clip);
    return acc;
  }, {});

  const sessionNames = Object.keys(sessions).sort();

  return (
    <div className="view" id="view-timeline">
      <div id="timeline-container">
        <div className="tl-header">
          <div className="tl-title">SESSION TIMELINE</div>
        </div>
        <div className="tl-sessions" id="tl-sessions">
          {sessionNames.map((sessionName, index) => (
            <div key={sessionName} className="tl-session">
              <div className="tl-session-header">
                <div className="tl-session-name">{sessionName}</div>
                <div className="tl-session-count">{sessions[sessionName].length} fragments</div>
              </div>
              <div className="tl-session-clips">
                {sessions[sessionName].map((clip: any) => (
                  <div key={clip.id} className="tl-clip">
                    <div className="tl-clip-id">{clip.id}</div>
                    <div className="tl-clip-name">{clip.name}</div>
                    <div className="tl-clip-meta">
                      {clip.bpm} BPM · {clip.key} · {clip.mood}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
