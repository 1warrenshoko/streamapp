# Sports Streamer v3 — Twitch-Style Browse & Watch Wall

## 1. Architecture

**Two modes, one iframe pool (max 6 concurrent iframes):**

- **Browse Mode** — Scrollable card grid. Cards in viewport get live iframes. Cards off-screen show poster thumbnails.
- **Watch Wall Mode** — 2x3 fixed grid. All 6 slots are live iframes. Click a slot to pick which stream fills it.

Header toggles between modes: `[Browse] [Watch Wall]`.

## 2. Iframe Pool

- 6 iframe slots stored in state as `[{ matchId, stream, domKey }]`
- `IntersectionObserver` tracks which MatchCards are visible
- On scroll: compute visible set, assign iframes to most recently visible cards with a 200ms debounce
- Iframes persist for 2 seconds after leaving viewport before reassignment (avoids thrash)
- Watch Wall mode bypasses the pool — all 6 slots are pinned

## 3. Performance

| Concern | Fix |
|---------|-----|
| 222+ `setInterval` from CountdownBadge | One global `currentTime` state updated via single 1s interval in App. Cards read time prop, no local interval. |
| DOM weight of 200+ cards | CSS `content-visibility: auto` on card rows. Browsers skip layout/paint for off-screen rows. |
| Iframe pool churn on scroll | 200ms debounce + 2s keepalive on recently-visible iframes. |
| Poster images blocking render | `loading="lazy"`, explicit `width`/`height`, CSS blur-up placeholder while loading. |
| Unnecessary re-renders | `React.memo` on MatchCard with shallow comparison. Only changed match IDs re-render. |
| Large initial payload | API fetch returns immediately; results batched into state as they arrive. |

## 4. Components

### App (container)
- State: `mode` ('browse' | 'wall'), `sports[]`, `matches[]`, `selectedSport`, `viewMode`, `currentTime`, `iframeSlots[]`
- Passes `currentTime` as prop to all time-displaying children
- Owns IntersectionObserver logic and iframe pool management

### BrowseGrid
- Renders MatchCards in responsive grid (1/2/3/4 columns)
- Each card registers/unregisters with IntersectionObserver
- Calls back when visible cards change

### MatchCard (React.memo)
- Props: `match`, `currentTime`, `isVisible`, `iframeSlot`, `onClick`
- Shows poster as background with dark overlay + match info
- If `isVisible && iframeSlot`, embeds live mini-iframe
- If not visible, shows static poster thumbnail
- Poster fallback: gradient placeholder if no poster URL

### WatchWall
- 2x3 fixed grid (responsive: 1x2 on mobile, 2x2 on tablet)
- Each slot: dropdown to pick a match → loads iframe
- Renders 6 iframes (fixed pool consumption)

### VideoPlayer (full-size, from v2)
- Kept for single-stream focused viewing
- Triggers when clicking a card in Browse mode (replace card iframe with full player)
- "Back" button returns to browse with that stream in its card slot

## 5. Data Flow

```
API → proxy → [sports[], matches[]]
                     ↓
              BrowseGrid / WatchWall
                     ↓
           IntersectionObserver → visible set
                     ↓
           iframeSlots[] (max 6, LRU assignment)
                     ↓
              MatchCard receives slot
```

## 6. Edge Cases

- **No poster image:** Gradient placeholder + sport category badge
- **API returns 0 matches:** Empty state with "No events" message
- **Iframe fails to load:** Reload button on the card slot, "Next source" cycling
- **Network offline:** Error banner, cached matches (if any) shown as posters
- **Watch Wall with <6 matches available:** Empty slots show dashed border + "Pick a match" prompt

## 7. Mobile Considerations

- Browse: 1 column, larger cards, easy tap targets
- Watch Wall: 1x2 grid (2 streams), swipe between pairs
- IntersectionObserver throttled to 400ms debounce on mobile (battery)
- Iframes auto-pause when not visible (via `IntersectionObserver` isVisible=false → unmount)
