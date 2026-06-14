import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MatchCard, SkeletonCard } from './components/MatchCard';
import WatchWall from './components/WatchWall';

const API_BASE = '/api/proxy';

const TABS = [
  { id: 'live', label: 'LIVE NOW' },
  { id: 'today', label: 'SCHEDULE' },
  { id: 'all', label: 'ALL EVENTS' }
];

export default function App() {
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState('all');
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [mode, setMode] = useState('browse');
  const [viewMode, setViewMode] = useState('live');
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [visibleCards, setVisibleCards] = useState(new Set());
  const [miniStreams, setMiniStreams] = useState({});
  const [reloadKey, setReloadKey] = useState(0);
  const [deadMatches, setDeadMatches] = useState(new Set());
  const cardRefs = useRef({});
  const observerRef = useRef(null);

  const embedProxy = (url) => {
    if (!url) return url;
    const match = url.match(/(?:embed\.st|embedsports\.top)\/(.+)$/);
    if (match) {
      return `${API_BASE}?embed=${encodeURIComponent(match[1])}`;
    }
    return url;
  };
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        setVisibleCards((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            const id = entry.target.dataset.matchId;
            if (!id) return;
            if (entry.isIntersecting) {
              next.add(id);
            } else {
              next.delete(id);
            }
          });
          return next;
        });
      },
      { rootMargin: '100px', threshold: 0.0 }
    );

    return () => observerRef.current?.disconnect();
  }, []);

  const fetchApi = useCallback(async (endpoint) => {
    const path = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const res = await fetch(`${API_BASE}?__path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }, []);

  useEffect(() => {
    fetchApi('/sports')
      .then((data) => setSports(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error('Init error:', err);
        setError('Could not connect to the server. Make sure the proxy is running on port 3001.');
      })
      .finally(() => setInitializing(false));
  }, [fetchApi]);

  useEffect(() => {
    if (initializing) return;
    setLoading(true);
    setError(null);
    setSelectedMatch(null);
    setStreams([]);
    setSelectedStream(null);

    let endpoint;
    if (viewMode === 'live') endpoint = '/matches/live';
    else if (viewMode === 'today') endpoint = '/matches/all-today';
    else endpoint = '/matches/all';

    fetchApi(endpoint)
      .then((data) => {
        let results = Array.isArray(data) ? data : [];
        if (selectedSport !== 'all') {
          const sportId = selectedSport.toLowerCase();
          results = results.filter((m) =>
            (m.category || '').toLowerCase() === sportId
          );
        }
        setMatches(results);
      })
      .catch((err) => { setError(err.message); setMatches([]); })
      .finally(() => setLoading(false));
  }, [viewMode, selectedSport, initializing, fetchApi]);

  useEffect(() => {
    const obs = observerRef.current;
    if (!obs) return;
    Object.values(cardRefs.current).forEach((el) => {
      if (el) obs.observe(el);
    });
    return () => {
      Object.values(cardRefs.current).forEach((el) => {
        if (el) obs?.unobserve(el);
      });
    };
  }, [matches]);

  const miniTimerRef = useRef(null);

  useEffect(() => {
    if (miniTimerRef.current) clearTimeout(miniTimerRef.current);
    miniTimerRef.current = setTimeout(() => {
      setMiniStreams((prev) => {
        const next = {};
        const visibleArr = Array.from(visibleCards).slice(0, 6);
        visibleArr.forEach((id) => {
          if (prev[id]) {
            next[id] = prev[id];
          } else {
            const match = matches.find((m) => m.id === id);
            if (match && match.sources?.length > 0) {
              next[id] = { embedUrl: null, loading: true };
              const source = match.sources[0];
              fetchApi(`/stream/${source.source}/${source.id}`)
                .then((data) => {
                  const list = Array.isArray(data) ? data : [];
                  if (list.length > 0) {
                    const url = embedProxy(list[0].embedUrl);
                    setMiniStreams((p) => ({ ...p, [id]: { embedUrl: url, loading: false } }));
                  } else {
                    setMiniStreams((p) => {
                      const n = { ...p }; delete n[id]; return n;
                    });
                    setDeadMatches((prev) => { const s = new Set(prev); s.add(id); return s; });
                  }
                })
                .catch(() => {
                  setMiniStreams((p) => {
                    const n = { ...p }; delete n[id]; return n;
                  });
                  setDeadMatches((prev) => { const s = new Set(prev); s.add(id); return s; });
                });
            }
          }
        });
        return next;
      });
    }, 300);

    return () => clearTimeout(miniTimerRef.current);
  }, [visibleCards, matches, fetchApi]);

  const fetchStreams = async (match) => {
    setSelectedMatch(match);
    setStreams([]);
    setSelectedStream(null);
    setLoading(true);
    setError(null);

    try {
      if (!match.sources || match.sources.length === 0) {
        throw new Error('No stream sources available');
      }

      let streamList = [];
      for (const source of match.sources) {
        try {
          const data = await fetchApi(`/stream/${source.source}/${source.id}`);
          const list = Array.isArray(data) ? data : [];
          streamList = streamList.concat(list);
        } catch {
          continue;
        }
      }

      if (streamList.length === 0) {
        setDeadMatches((prev) => { const s = new Set(prev); s.add(match.id); return s; });
        throw new Error('No streams available');
      }

      const streamsWithAp = streamList.map((s) => ({ ...s, embedUrl: embedProxy(s.embedUrl) }));
      setStreams(streamsWithAp);
      const hd = streamsWithAp.find((s) => s.hd);
      setSelectedStream(hd || streamsWithAp[0]);
    } catch (err) {
      setDeadMatches((prev) => { const s = new Set(prev); s.add(match.id); return s; });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMiniFail = useCallback((matchId) => {
    setDeadMatches((prev) => { const s = new Set(prev); s.add(matchId); return s; });
    setMiniStreams((prev) => { const n = { ...prev }; delete n[matchId]; return n; });
  }, []);

  const closePlayer = () => {
    setSelectedMatch(null);
    setStreams([]);
    setSelectedStream(null);
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-white dark:bg-ufc-black flex items-center justify-center transition-colors">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-ufc-border border-t-ufc-red animate-spin mx-auto mb-4" />
          <p className="font-oswald text-gray-400 dark:text-ufc-text uppercase tracking-widest text-sm">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-ufc-black text-gray-900 dark:text-white transition-colors">
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-ufc-black/95 backdrop-blur-md border-b border-gray-200 dark:border-ufc-border transition-colors">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <h1 className="font-oswald text-2xl font-bold uppercase tracking-tighter text-white">
                STREAM<span className="text-ufc-red">.</span>
              </h1>

              <nav className="hidden sm:flex items-center gap-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setViewMode(tab.id)}
                    className={`relative px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                      viewMode === tab.id
                        ? 'text-white'
                        : 'text-ufc-muted hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                    {viewMode === tab.id && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-ufc-red" />
                    )}
                  </button>
                ))}
              </nav>
              <div className="hidden sm:flex items-center gap-1 border-l border-ufc-border pl-4 ml-2">
                <button
                  onClick={() => setMode('browse')}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    mode === 'browse' ? 'text-white' : 'text-ufc-muted hover:text-gray-300'
                  }`}
                >
                  Browse
                </button>
                <button
                  onClick={() => setMode('wall')}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    mode === 'wall' ? 'text-white' : 'text-ufc-muted hover:text-gray-300'
                  }`}
                >
                  WALL
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-1.5 text-ufc-muted hover:text-white transition-colors"
                title="Toggle theme"
              >
                {theme === 'dark' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                  </svg>
                )}
              </button>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-ufc-text text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ufc-red opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-ufc-red" />
                </span>
                LIVE
              </span>
            </div>
          </div>

          {/* Mobile tabs */}
          <div className="sm:hidden flex items-center gap-1 pb-3 -mx-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={`flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                  viewMode === tab.id
                    ? 'border-ufc-red text-white bg-ufc-red/10'
                    : 'border-ufc-border text-ufc-muted'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sports filter */}
          {sports.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-3 scrollbar-none -mx-1 px-1">
              <button
                onClick={() => setSelectedSport('all')}
                className={`shrink-0 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                  selectedSport === 'all'
                    ? 'border-ufc-red text-white bg-ufc-red/10'
                    : 'border-ufc-border text-ufc-muted hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                ALL
              </button>
              {sports.map((sport) => (
                <button
                  key={sport.id || sport.name}
                  onClick={() => setSelectedSport(sport.id || sport.slug)}
                  className={`shrink-0 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                    selectedSport === (sport.id || sport.slug)
                      ? 'border-ufc-red text-white bg-ufc-red/10'
                      : 'border-ufc-border text-ufc-muted hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {sport.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {mode === 'wall' ? (
          <WatchWall />
        ) : (
          <>
            {/* Video Player */}
        {selectedStream && selectedMatch && (
          <section className="mb-8 animate-fade-in">
            <div className="bg-ufc-darker border border-ufc-border rounded-sm overflow-hidden">
              <div className="relative bg-black" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  key={`${selectedStream.embedUrl}-${reloadKey}`}
                  src={selectedStream.embedUrl}
                  className="absolute inset-0 w-full h-full border-0"
                  allowFullScreen
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                />

                <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
                  <button
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="px-2 py-1 bg-black/80 border border-ufc-border/50 text-white hover:border-ufc-red/50 text-[10px] font-bold uppercase tracking-widest transition-colors"
                  >
                    Reload
                  </button>
                  <span className="px-1.5 py-1 text-[10px] font-mono text-ufc-text bg-black/80">
                    {streams.indexOf(selectedStream) + 1}/{streams.length}
                  </span>
                  <button
                    onClick={() => {
                      const idx = streams.findIndex(
                        (s) => (s.id || s.streamNo) === (selectedStream.id || selectedStream.streamNo)
                      );
                      const next = streams[(idx + 1) % streams.length];
                      if (next) setSelectedStream(next);
                    }}
                    className="px-2 py-1 bg-black/80 border border-ufc-border/50 text-white hover:border-ufc-red/50 text-[10px] font-bold uppercase tracking-widest transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-oswald text-lg font-bold text-white uppercase tracking-wide leading-tight">
                    {selectedMatch.title || 'Live Event'}
                  </h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-ufc-text font-mono">#{selectedStream.streamNo}</span>
                    <span className="px-1 py-0 text-[10px] font-bold uppercase text-ufc-muted border border-ufc-border rounded-sm">{selectedStream.source}</span>
                    <span className="text-xs text-ufc-muted">{selectedStream.language || 'EN'}</span>
                    {selectedStream.hd && (
                      <span className="px-1.5 py-0.5 bg-ufc-red text-white text-[10px] font-bold uppercase tracking-wider">
                        HD
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={closePlayer}
                  className="self-start px-3 py-1.5 border border-ufc-border text-ufc-text hover:text-white hover:border-ufc-red/50 text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  Close
                </button>
              </div>

              {streams.length > 1 && (
                <div className="px-4 pb-4 flex flex-wrap gap-1.5 border-t border-ufc-border pt-3">
                  {streams.map((stream) => (
                    <button
                      key={stream.id || stream.streamNo}
                      onClick={() => setSelectedStream(stream)}
                      className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border transition-all ${
                        (selectedStream.id || selectedStream.streamNo) === (stream.id || stream.streamNo)
                          ? 'border-ufc-red text-white bg-ufc-red/10'
                          : 'border-ufc-border text-ufc-text hover:text-white hover:border-gray-600'
                      }`}
                    >
                      #{stream.streamNo} <span className="text-ufc-muted">{stream.source}</span> {stream.language || ''} {stream.hd ? 'HD' : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-950/30 border border-red-900/50 rounded-sm p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <div>
              <p className="text-red-400 text-sm font-medium">{error}</p>
              <button
                onClick={() => { setError(null); fetchApi('/matches/live').then(d => setMatches(Array.isArray(d) ? d : [])).catch(() => {}); }}
                className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !selectedStream && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && matches.length === 0 && !error && (
          <div className="text-center py-20">
            <svg className="w-16 h-16 text-ufc-border mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <p className="font-oswald text-xl text-gray-900 dark:text-white uppercase tracking-wider mb-1">No events found</p>
            <p className="text-ufc-text text-sm">Try a different category or check back later</p>
          </div>
        )}

        {/* Matches grid */}
        {!loading && matches.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {matches.filter((m) => !deadMatches.has(m.id)).map((match) => (
              <div key={match.id} className="animate-fade-in">
                <MatchCard
                  match={match}
                  currentTime={currentTime}
                  isVisible={visibleCards.has(match.id)}
                  miniStream={miniStreams[match.id]}
                  onSelect={fetchStreams}
                  onMiniFail={handleMiniFail}
                  onCardRef={(el) => { cardRefs.current[match.id] = el; }}
                />
              </div>
            ))}
          </div>
        )}
        </>
        )}
      </main>

      <footer className="border-t border-gray-200 dark:border-ufc-border py-6 px-4 transition-colors">
        <div className="max-w-[1400px] mx-auto text-center">
          <p className="text-[10px] text-gray-400 dark:text-ufc-muted uppercase tracking-widest">
            Streams sourced from third-party providers. Availability may vary.
          </p>
        </div>
      </footer>
    </div>
  );
}
