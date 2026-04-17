'use client';

import { useGoodwinsun } from '@/context/GoodwinsunContext';

export default function MapView() {
  const { state, selectClip, setView } = useGoodwinsun();

  // Calculate positions for nodes
  const getNodePositions = () => {
    const positions: any = {};
    const rootClips = state.clips.filter(c => c.type === 'root');
    const branchClips = state.clips.filter(c => c.type === 'branch');
    const mergeClips = state.clips.filter(c => c.type === 'merge');
    const versionClips = state.clips.filter(c => c.type === 'version');

    // Simple layout - arrange by type
    rootClips.forEach((clip, i) => {
      positions[clip.id] = { x: 100 + (i % 3) * 150, y: 50 + Math.floor(i / 3) * 100 };
    });

    branchClips.forEach((clip, i) => {
      positions[clip.id] = { x: 100 + (i % 3) * 150, y: 200 + Math.floor(i / 3) * 100 };
    });

    mergeClips.forEach((clip, i) => {
      positions[clip.id] = { x: 100 + (i % 2) * 200, y: 350 + Math.floor(i / 2) * 100 };
    });

    versionClips.forEach((clip, i) => {
      positions[clip.id] = { x: 100 + (i % 2) * 200, y: 450 + Math.floor(i / 2) * 100 };
    });

    return positions;
  };

  const positions = getNodePositions();

  const handleNodeClick = (clipId: string) => {
    selectClip(clipId);
    setView('vault');
  };

  return (
    <div className="view" id="view-map">
      <div id="map-container">
        <div id="map-legend">
          <span className="map-legend-label">NODE TYPE</span>
          <div className="legend-items">
            <div className="legend-item">
              <div className="legend-dot root"></div>
              ROOT
            </div>
            <div className="legend-item">
              <div className="legend-dot branch"></div>
              BRANCH
            </div>
            <div className="legend-item">
              <div className="legend-dot merge"></div>
              MERGE
            </div>
            <div className="legend-item">
              <div className="legend-dot version"></div>
              VERSION
            </div>
          </div>
        </div>
        <div id="map-svg-wrap">
          <svg id="map-svg" xmlns="http://www.w3.org/2000/svg" width="800" height="600">
            {/* Draw connections */}
            {state.clips.map(clip => {
              if (clip.parent && positions[clip.parent]) {
                return (
                  <line
                    key={`line-${clip.id}`}
                    x1={positions[clip.parent].x}
                    y1={positions[clip.parent].y}
                    x2={positions[clip.id].x}
                    y2={positions[clip.id].y}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="1"
                  />
                );
              }
              return null;
            })}
            
            {/* Draw nodes */}
            {state.clips.map(clip => (
              <g key={clip.id}>
                <circle
                  cx={positions[clip.id].x}
                  cy={positions[clip.id].y}
                  r="12"
                  fill={`var(--node-bg-${clip.type})`}
                  stroke="var(--border-mid)"
                  strokeWidth="1"
                  className="map-node"
                  onClick={() => handleNodeClick(clip.id)}
                  style={{ cursor: 'pointer' }}
                />
                <text
                  x={positions[clip.id].x}
                  y={positions[clip.id].y + 25}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--text-secondary)"
                >
                  {clip.id}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <div id="map-hint">HOVER NODES TO HIGHLIGHT &nbsp;·&nbsp; CLICK TO OPEN IN VAULT</div>
      </div>
    </div>
  );
}
