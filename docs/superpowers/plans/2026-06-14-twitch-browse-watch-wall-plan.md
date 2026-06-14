# Twitch-Style Browse & Watch Wall — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the sports streamer with YouTube-style poster cards, Twitch-style live mini-previews via smart iframe pool (max 6), and a Watch Wall multi-stream mode.

**Architecture:** App owns all state including a 6-slot iframe pool and an IntersectionObserver that tracks visible cards. BrowseGrid renders MatchCards — visible ones get live iframes, off-screen ones get poster thumbnails. WatchWall pins 6 iframes in a fixed grid. A single `currentTime` interval replaces 222+ per-card intervals.

**Tech Stack:** React 18, Vite, Tailwind CSS, no new dependencies.

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/App.jsx` | Container: state, IntersectionObserver, iframe pool, BrowseGrid, mode toggle |
| `src/components/MatchCard.jsx` | Memoized card: poster thumbnail + live mini-iframe when visible |
| `src/components/WatchWall.jsx` | 2x3 grid of pinned live streams |
| `src/index.css` | New styles: `content-visibility`, poster blur-up, iframe pool transitions |

No new files needed for VideoPlayer — full-size viewing reuses the existing player section within App.

---

### Task 1: Performance — single global timer replacing 222+ intervals

**Files:**
- Modify: `src/App.jsx` (add `currentTime` state + interval, remove per-card intervals)

- [ ] **Step 1: Add `currentTime` state and single interval to App**

In `src/App.jsx`, find the state declarations (around line 144) and add:

```jsx
const [currentTime, setCurrentTime] = useState(Date.now());

useEffect(() => {
  const id = setInterval(() => setCurrentTime(Date.now()), 1000);
  return () => clearInterval(id);
}, []);
```

- [ ] **Step 2: Pass `currentTime` as prop to every MatchCard render**

Find the matches grid rendering. Add `currentTime={currentTime}` to each `<MatchCard>`:

```jsx
<MatchCard match={match} currentTime={currentTime} onSelect={fetchStreams} />
```

- [ ] **Step 3: Delete the local interval from CountdownBadge**

Find the `CountdownBadge` component (around line 11). Replace its local `useState(Date.now())` + `useEffect(setInterval)` with a prop-based approach:

```jsx
function CountdownBadge({ timestamp, currentTime }) {
  const date = new Date(timestamp);
  const diff = date - currentTime;

  if (diff <= 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ufc-red opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ufc-red" />
        </span>
        <span className="text-ufc-red font-oswald font-bold text-xs tracking-widest uppercase animate-pulse-live">LIVE</span>
      </div>
    );
  }

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (hours < 1) return <span className="text-ufc-text text-xs font-medium">{minutes}m</span>;
  if (hours < 24) return <span className="text-ufc-text text-xs font-medium">{hours}h {minutes}m</span>;

  return (
    <span className="text-ufc-text text-xs font-medium">
      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      <span className="text-ufc-muted ml-1">
        {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </span>
  );
}
```

Remove the old `useState` and `useEffect` from CountdownBadge — the function now receives `currentTime` as a prop.

- [ ] **Step 4: Update MatchCard to pass `currentTime` to CountdownBadge**

Find `<CountdownBadge timestamp={match.date} />` and change to:

```jsx
<CountdownBadge timestamp={match.date} currentTime={currentTime} />
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "perf: replace 222+ per-card intervals with single global timer"
```

---

### Task 2: Extract MatchCard with poster images and React.memo

**Files:**
- Create: `src/components/MatchCard.jsx`
- Modify: `src/App.jsx` (import and use MatchCard, remove old inline component)

- [ ] **Step 1: Create src/components directory**

```bash
mkdir -p src/components
```

- [ ] **Step 2: Create src/components/MatchCard.jsx**

```jsx
import React from 'react';

function CountdownBadge({ timestamp, currentTime }) {
  const date = new Date(timestamp);
  const diff = date - currentTime;

  if (diff <= 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ufc-red opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-ufc-red" />
        </span>
        <span className="text-ufc-red font-oswald font-bold text-xs tracking-widest uppercase animate-pulse-live">LIVE</span>
      </div>
    );
  }

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (hours < 1) return <span className="text-ufc-text text-xs font-medium">{minutes}m</span>;
  if (hours < 24) return <span className="text-ufc-text text-xs font-medium">{hours}h {minutes}m</span>;

  return (
    <span className="text-ufc-text text-xs font-medium">
      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      <span className="text-ufc-muted ml-1">
        {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </span>
  );
}

const PosterFallback = () => (
  <div className="absolute inset-0 bg-gradient-to-br from-ufc-surface to-ufc-card flex items-center justify-center">
    <span className="text-ufc-muted text-[10px] font-bold uppercase tracking-widest">EVENT</span>
  </div>
);

const MatchCard = React.memo(function MatchCard({ match, currentTime, isVisible, miniStream, onSelect, onCardRef }) {
  const isLive = new Date(match.date) <= currentTime;
  const posterUrl = match.poster ? `https://streamed.pk${match.poster}` : null;

  return (
    <div
      ref={onCardRef}
      data-match-id={match.id}
      className="match-card relative bg-ufc-card border border-ufc-border rounded-sm overflow-hidden"
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 280px' }}
    >
      {/* Poster or mini-iframe */}
      <div className="relative aspect-video bg-ufc-darker overflow-hidden">
        {isVisible && miniStream ? (
          <iframe
            src={miniStream.embedUrl}
            className="absolute inset-0 w-full h-full border-0 pointer-events-none"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            sandbox={undefined}
          />
        ) : posterUrl ? (
          <img
            src={posterUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-up"
            loading="lazy"
            width="320"
            height="180"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <PosterFallback />
        )}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-ufc-black via-transparent to-transparent pointer-events-none" />

        {/* Live indicator */}
        {isLive && (
          <div className="absolute top-0 left-0 w-full h-0.5 bg-ufc-red" />
        )}
      </div>

      {/* Info section */}
      <button
        onClick={() => onSelect(match)}
        className="w-full text-left p-3 hover:bg-[#1e1e1e] transition-colors focus:outline-none focus:bg-[#1e1e1e]"
      >
        <div className="flex items-center justify-between mb-2">
          <CountdownBadge timestamp={match.date} currentTime={currentTime} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-ufc-muted px-1.5 py-0.5 border border-ufc-border rounded-sm">
            {match.category || 'EVENT'}
          </span>
        </div>

        {match.teams ? (
          <div className="space-y-1.5 mb-2">
            {match.teams.home && (
              <div className="flex items-center gap-2">
                {match.teams.home.badge ? (
                  <img
                    src={`https://streamed.pk${match.teams.home.badge}`}
                    alt=""
                    className="w-5 h-5 object-contain"
                    loading="lazy"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-5 h-5 bg-ufc-surface border border-ufc-border rounded-sm flex items-center justify-center">
                    <span className="text-ufc-muted text-[8px] font-bold">VS</span>
                  </div>
                )}
                <span className="font-oswald font-semibold text-white text-xs uppercase tracking-wide truncate">
                  {match.teams.home.name}
                </span>
              </div>
            )}
            {match.teams.away && (
              <div className="flex items-center gap-2">
                {match.teams.away.badge ? (
                  <img
                    src={`https://streamed.pk${match.teams.away.badge}`}
                    alt=""
                    className="w-5 h-5 object-contain"
                    loading="lazy"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-5 h-5 bg-ufc-surface border border-ufc-border rounded-sm flex items-center justify-center">
                    <span className="text-ufc-muted text-[8px] font-bold">VS</span>
                  </div>
                )}
                <span className="font-oswald font-semibold text-white text-xs uppercase tracking-wide truncate">
                  {match.teams.away.name}
                </span>
              </div>
            )}
          </div>
        ) : (
          <h3 className="font-oswald font-semibold text-white text-xs uppercase tracking-wide mb-2 leading-snug">
            {match.title}
          </h3>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-ufc-border">
          <span className="text-[10px] text-ufc-muted font-medium uppercase tracking-wider">
            {match.sources?.length || 0} {match.sources?.length === 1 ? 'STREAM' : 'STREAMS'}
          </span>
          <div className="flex items-center gap-1 text-ufc-red group-hover:translate-x-0.5 transition-transform">
            <span className="text-[10px] font-bold uppercase tracking-widest">WATCH</span>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>
    </div>
  );
});

function SkeletonCard() {
  return (
    <div className="bg-ufc-card border border-ufc-border rounded-sm overflow-hidden">
      <div className="aspect-video skeleton" />
      <div className="p-3">
        <div className="skeleton h-3 w-16 rounded mb-2" />
        <div className="skeleton h-4 w-3/4 rounded mb-1.5" />
        <div className="skeleton h-4 w-1/2 rounded" />
      </div>
    </div>
  );
}

export { MatchCard, SkeletonCard };
```

- [ ] **Step 3: Update App.jsx to import and use MatchCard**

In `src/App.jsx`:
- Remove the old `CountdownBadge`, `SkeletonCard`, and `MatchCard` function definitions
- Add import: `import { MatchCard, SkeletonCard } from './components/MatchCard';`
- Update the matches grid render to pass `currentTime`:

```jsx
{matches.map((match, i) => (
  <div key={match.id || i} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
    <MatchCard match={match} currentTime={currentTime} onSelect={fetchStreams} />
  </div>
))}
```

- [ ] **Step 4: Remove CountdownBadge from App.jsx**

Delete the inline `CountdownBadge` function (now lives in MatchCard.jsx). Also delete the inline `SkeletonCard` function.

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add src/components/MatchCard.jsx src/App.jsx
git commit -m "feat: extract MatchCard with poster images and React.memo"
```

---

### Task 3: IntersectionObserver + iframe pool in App

**Files:**
- Modify: `src/App.jsx` (add IntersectionObserver, iframe pool state, visible card tracking)

- [ ] **Step 1: Add iframe pool state and IntersectionObserver to App**

Add state near other state declarations:

```jsx
const [visibleCards, setVisibleCards] = useState(new Set());
const [miniStreams, setMiniStreams] = useState({});
const cardRefs = useRef({});
const observerRef = useRef(null);
```

- [ ] **Step 2: Add IntersectionObserver useEffect**

Add after the `currentTime` useEffect:

```jsx
useEffect(() => {
  observerRef.current = new IntersectionObserver(
    (entries) => {
      const visible = new Set(visibleCards);
      entries.forEach((entry) => {
        const id = entry.target.dataset.matchId;
        if (!id) return;
        if (entry.isIntersecting) {
          visible.add(id);
        } else {
          visible.delete(id);
        }
      });
      setVisibleCards(visible);
    },
    { rootMargin: '100px', threshold: 0.0 }
  );

  return () => observerRef.current?.disconnect();
}, []);

useEffect(() => {
  if (!observerRef.current) return;
  Object.values(cardRefs.current).forEach((el) => {
    if (el) observerRef.current.observe(el);
  });
  return () => {
    Object.values(cardRefs.current).forEach((el) => {
      if (el) observerRef.current?.unobserve(el);
    });
  };
}, [matches]);
```

- [ ] **Step 3: Add miniStreams assignment logic (debounced)**

Add useEffect that assigns streams to visible cards:

```jsx
const miniTimerRef = useRef(null);

useEffect(() => {
  if (miniTimerRef.current) clearTimeout(miniTimerRef.current);
  miniTimerRef.current = setTimeout(() => {
    setMiniStreams((prev) => {
      const next = {};
      const visibleArr = Array.from(visibleCards).slice(0, 6);
      visibleArr.forEach((id, i) => {
        if (prev[id]) {
          next[id] = prev[id];
        } else {
          const match = matches.find((m) => m.id === id);
          if (match && match.sources?.length > 0) {
            next[id] = { embedUrl: null, loading: true };
            fetchApi(`/stream/${match.sources[0].source}/${match.sources[0].id}`)
              .then((data) => {
                const list = Array.isArray(data) ? data : [];
                if (list.length > 0) {
                  setMiniStreams((p) => ({ ...p, [id]: { embedUrl: list[0].embedUrl, loading: false } }));
                }
              })
              .catch(() => {});
          }
        }
      });
      return next;
    });
  }, 300);

  return () => clearTimeout(miniTimerRef.current);
}, [visibleCards, matches]);
```

- [ ] **Step 4: Pass `cardRef`, `isVisible`, `miniStream` to MatchCard**

Update the matches grid render:

```jsx
{matches.map((match) => (
  <div key={match.id} className="animate-fade-in">
    <MatchCard
      match={match}
      currentTime={currentTime}
      isVisible={visibleCards.has(match.id)}
      miniStream={miniStreams[match.id]}
      onSelect={fetchStreams}
      onCardRef={(el) => { cardRefs.current[match.id] = el; }}
    />
  </div>
))}
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add IntersectionObserver + iframe pool for mini-previews"
```

---

### Task 4: Watch Wall mode

**Files:**
- Create: `src/components/WatchWall.jsx`
- Modify: `src/App.jsx` (add mode toggle, render WatchWall)

- [ ] **Step 1: Create src/components/WatchWall.jsx**

```jsx
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
          className="bg-ufc-card border border-ufc-border rounded-sm overflow-hidden"
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
            <div className="aspect-video bg-ufc-darker flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-ufc-border">
              <span className="text-ufc-muted text-[10px] font-bold uppercase tracking-widest">
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

          {/* Match selector dropdown */}
          <div className="p-2 border-t border-ufc-border">
            <select
              value={match?.id || ''}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) { clearSlot(i); return; }
                const m = matches.find((x) => x.id === id);
                if (m) assignMatch(i, m);
              }}
              className="w-full bg-ufc-surface border border-ufc-border text-white text-[10px] font-bold uppercase p-1.5 focus:outline-none focus:border-ufc-red"
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
```

- [ ] **Step 2: Add mode toggle to App header**

In App.jsx, add state:

```jsx
const [mode, setMode] = useState('browse');
```

Add mode toggle buttons in the header, after the tab navigation:

```jsx
<div className="flex items-center gap-1 ml-4 border-l border-ufc-border pl-4">
  <button
    onClick={() => setMode('browse')}
    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${
      mode === 'browse'
        ? 'border-ufc-red text-white bg-ufc-red/10'
        : 'border-ufc-border text-ufc-muted hover:text-gray-300'
    }`}
  >
    Browse
  </button>
  <button
    onClick={() => setMode('wall')}
    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${
      mode === 'wall'
        ? 'border-ufc-red text-white bg-ufc-red/10'
        : 'border-ufc-border text-ufc-muted hover:text-gray-300'
    }`}
  >
    Watch Wall
  </button>
</div>
```

- [ ] **Step 3: Conditionally render BrowseGrid or WatchWall in main**

Replace the matches grid section with:

```jsx
{mode === 'wall' ? (
  <WatchWall matches={matches} />
) : (
  <>
    {loading && ...skeleton...}
    {!loading && matches.length === 0 && ...empty...}
    {!loading && matches.length > 0 && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {matches.map((match) => (
          <div key={match.id} className="animate-fade-in">
            <MatchCard ... />
          </div>
        ))}
      </div>
    )}
  </>
)}
```

- [ ] **Step 4: Import WatchWall**

```jsx
import WatchWall from './components/WatchWall';
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/WatchWall.jsx src/App.jsx
git commit -m "feat: add Watch Wall mode with 6-slot live grid"
```

---

### Task 5: CSS enhancements — content-visibility, poster blur-up, polish

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add card container optimizations and blur-up animation**

Add to `src/index.css` after the existing `.skeleton` rule:

```css
.match-card {
  contain: layout style paint;
}

@media (min-height: 600px) {
  .match-card {
    content-visibility: auto;
    contain-intrinsic-size: auto 280px;
  }
}

.blur-up {
  filter: blur(10px);
  transition: filter 0.4s ease-out;
}

.blur-up[src] {
  filter: blur(0);
}

@keyframes slot-pulse {
  0%, 100% { border-color: rgba(255,255,255,0.08); }
  50% { border-color: rgba(210,10,10,0.15); }
}

.watch-wall-slot-loading {
  animation: slot-pulse 2s ease-in-out infinite;
}
```

- [ ] **Step 2: Build and verify**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add content-visibility, blur-up poster animation, watch wall polish"
```

---

### Task 6: Final integration — wire everything, test full flow

**Files:**
- Modify: `src/App.jsx` (final wiring, verify all props pass through)

- [ ] **Step 1: Full build and review**

```bash
npm run build
```

Verify no console errors, all imports resolve, no dead code.

- [ ] **Step 2: Test locally**

```bash
npm run proxy
npm run dev
```

- Open `http://localhost:3000` — verify Browse mode shows poster cards
- Click a card — verify full player opens
- Toggle to Watch Wall — verify 2x3 grid with dropdown selectors
- Pick streams in Watch Wall — verify iframes load
- Scroll Browse — verify mini-iframes appear on visible cards

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: Twitch-style browse + Watch Wall integration complete"
```
