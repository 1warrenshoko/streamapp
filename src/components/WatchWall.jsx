import React, { useState, useEffect } from 'react';

const API_BASE = '/api/proxy';

function WatchWall() {
  const [slots, setSlots] = useState(Array(6).fill(null));
  const [slotStreams, setSlotStreams] = useState({});
  const [slotStreamIdx, setSlotStreamIdx] = useState({});
  const [allMatches, setAllMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}?__path=matches%2Flive`)
      .then((res) => res.json())
      .then((data) => setAllMatches(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingMatches(false));
  }, []);

  const assignMatch = async (slotIndex, match) => {
    const newSlots = [...slots];
    newSlots[slotIndex] = match;
    setSlots(newSlots);

    if (!match || !match.sources?.length) return;

    let allStreams = [];
    for (const source of match.sources) {
      try {
        const res = await fetch(`${API_BASE}?__path=${encodeURIComponent(`stream/${source.source}/${source.id}`)}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        allStreams = allStreams.concat(list);
      } catch {}
    }

    if (allStreams.length > 0) {
      const embedProxy = (url) => {
        if (!url) return url;
        const match = url.match(/(?:embed\.st|embedsports\.top)\/(.+)$/);
        if (match) return `${API_BASE}?embed=${encodeURIComponent(match[1])}`;
        return url;
      };
      const streamsWithAp = allStreams.map((s) => ({ ...s, embedUrl: embedProxy(s.embedUrl) }));
      setSlotStreams((prev) => ({ ...prev, [slotIndex]: streamsWithAp }));
      setSlotStreamIdx((prev) => ({ ...prev, [slotIndex]: 0 }));
    }
  };

  const clearSlot = (slotIndex) => {
    const newSlots = [...slots];
    newSlots[slotIndex] = null;
    setSlots(newSlots);
    setSlotStreams((prev) => { const n = { ...prev }; delete n[slotIndex]; return n; });
    setSlotStreamIdx((prev) => { const n = { ...prev }; delete n[slotIndex]; return n; });
  };

  const cycleStream = (slotIndex, direction) => {
    const streams = slotStreams[slotIndex];
    if (!streams || streams.length <= 1) return;
    setSlotStreamIdx((prev) => {
      const current = prev[slotIndex] || 0;
      const next = (current + direction + streams.length) % streams.length;
      return { ...prev, [slotIndex]: next };
    });
  };

  if (loadingMatches) {
    return (
      <div className="text-center py-20">
        <div className="w-10 h-10 rounded-full border-2 border-ufc-border border-t-ufc-red animate-spin mx-auto mb-3" />
        <p className="font-oswald text-ufc-text uppercase tracking-widest text-xs">Loading streams</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {slots.map((match, i) => (
        <div
          key={i}
          className="bg-white dark:bg-ufc-card border border-gray-200 dark:border-ufc-border rounded-sm overflow-hidden transition-colors"
        >
          {match && slotStreams[i] ? (
            <div className="relative">
              <div className="relative aspect-video bg-black">
                <iframe
                  key={`${match.id}-${slotStreamIdx[i] || 0}`}
                  src={slotStreams[i][slotStreamIdx[i] || 0]?.embedUrl}
                  className="absolute inset-0 w-full h-full border-0"
                  allowFullScreen
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                />
                {slotStreams[i].length > 1 && (
                  <div className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1">
                    <button
                      onClick={() => cycleStream(i, -1)}
                      className="px-1.5 py-0.5 bg-black/80 border border-ufc-border/50 text-white hover:border-ufc-red/50 text-[9px] font-bold uppercase tracking-wider transition-colors"
                    >
                      Prev
                    </button>
                    <span className="px-1 text-[9px] font-mono text-ufc-text bg-black/80">
                      {(slotStreamIdx[i] || 0) + 1}/{slotStreams[i].length}
                    </span>
                    <button
                      onClick={() => cycleStream(i, 1)}
                      className="px-1.5 py-0.5 bg-black/80 border border-ufc-border/50 text-white hover:border-ufc-red/50 text-[9px] font-bold uppercase tracking-wider transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
              <div className="p-2 flex items-center justify-between">
                <span className="text-[10px] font-oswald font-bold uppercase text-white truncate">
                  {match.title || match.teams?.home?.name || 'Stream'}
                </span>
                <button
                  onClick={() => clearSlot(i)}
                  className="px-2 py-0.5 text-[9px] font-bold uppercase text-ufc-muted hover:text-white border border-ufc-border transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="aspect-video bg-gray-100 dark:bg-ufc-darker flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-gray-300 dark:border-ufc-border">
              <span className="text-gray-400 dark:text-ufc-muted text-[10px] font-bold uppercase tracking-widest">
                {match ? 'Loading...' : 'Pick a stream'}
              </span>
              {match && (
                <button
                  onClick={() => clearSlot(i)}
                  className="px-2 py-0.5 text-[9px] font-bold uppercase text-ufc-muted hover:text-white border border-ufc-border transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          <div className="p-2 border-t border-gray-200 dark:border-ufc-border">
            <select
              value={match?.id || ''}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) { clearSlot(i); return; }
                const m = allMatches.find((x) => x.id === id);
                if (m) assignMatch(i, m);
              }}
              className="w-full bg-gray-50 dark:bg-ufc-surface border border-gray-300 dark:border-ufc-border text-gray-900 dark:text-white text-[10px] font-bold uppercase p-1.5 focus:outline-none focus:border-ufc-red max-h-48 overflow-y-auto"
            >
              <option value="">— {allMatches.length} streams —</option>
              {allMatches.map((m) => {
                const label = m.title || m.teams?.home?.name || m.category || 'Event';
                const sport = m.category ? ` [${m.category}]` : '';
                return (
                  <option key={m.id} value={m.id}>
                    {label}{sport} {m.sources?.length ? ` (${m.sources.length})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

export default WatchWall;
