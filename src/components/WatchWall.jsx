import React, { useState } from 'react';

function WatchWall({ matches }) {
  const [slots, setSlots] = useState(Array(6).fill(null));
  const [slotStreams, setSlotStreams] = useState({});

  const assignMatch = async (slotIndex, match) => {
    const newSlots = [...slots];
    newSlots[slotIndex] = match;
    setSlots(newSlots);

    if (!match || !match.sources?.length) return;

    try {
      const source = match.sources[0];
      const res = await fetch(`/api/stream/${source.source}/${source.id}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      if (list.length > 0) {
        setSlotStreams((prev) => ({ ...prev, [slotIndex]: list[0] }));
      }
    } catch {}
  };

  const clearSlot = (slotIndex) => {
    const newSlots = [...slots];
    newSlots[slotIndex] = null;
    setSlots(newSlots);
    setSlotStreams((prev) => { const n = { ...prev }; delete n[slotIndex]; return n; });
  };

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
                  src={slotStreams[i].embedUrl}
                  className="absolute inset-0 w-full h-full border-0"
                  allowFullScreen
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                />
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
                const m = matches.find((x) => x.id === id);
                if (m) assignMatch(i, m);
              }}
              className="w-full bg-gray-50 dark:bg-ufc-surface border border-gray-300 dark:border-ufc-border text-gray-900 dark:text-white text-[10px] font-bold uppercase p-1.5 focus:outline-none focus:border-ufc-red"
            >
              <option value="">— Select —</option>
              {matches.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title || m.teams?.home?.name || m.category}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

export default WatchWall;
