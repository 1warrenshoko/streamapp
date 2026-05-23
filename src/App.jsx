import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';

const TABS = [
  { id: 'live', label: 'LIVE NOW' },
  { id: 'today', label: 'SCHEDULE' },
  { id: 'all', label: 'ALL EVENTS' }
];

function CountdownBadge({ timestamp }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const date = new Date(timestamp);
  const diff = date - now;

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

function SkeletonCard() {
  return (
    <div className="bg-ufc-card border border-ufc-border rounded-sm p-4">
      <div className="skeleton h-4 w-16 rounded mb-3" />
      <div className="skeleton h-5 w-3/4 rounded mb-2" />
      <div className="skeleton h-5 w-1/2 rounded mb-3" />
      <div className="skeleton h-3 w-full rounded" />
    </div>
  );
}

function MatchCard({ match, onSelect }) {
  const isLive = new Date(match.date) <= Date.now();

  return (
    <button
      onClick={() => onSelect(match)}
      className="group relative bg-ufc-card border border-ufc-border hover:border-ufc-red/50 rounded-sm p-0 overflow-hidden text-left w-full transition-all duration-200 hover:bg-[#1e1e1e] focus:outline-none focus:border-ufc-red"
    >
      {isLive && (
        <div className="absolute top-0 left-0 w-full h-0.5 bg-ufc-red" />
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <CountdownBadge timestamp={match.date} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-ufc-muted px-2 py-0.5 border border-ufc-border rounded-sm">
            {match.category || 'EVENT'}
          </span>
        </div>

        {match.teams ? (
          <div className="space-y-2.5 mb-3">
            {match.teams.home && (
              <div className="flex items-center gap-3">
                {match.teams.home.badge ? (
                  <img
                    src={`https://streamed.pk${match.teams.home.badge}`}
                    alt=""
                    className="w-8 h-8 object-contain"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-8 h-8 bg-ufc-surface border border-ufc-border rounded-sm flex items-center justify-center">
                    <span className="text-ufc-muted text-[10px] font-bold">VS</span>
                  </div>
                )}
                <span className="font-oswald font-semibold text-white text-sm uppercase tracking-wide">
                  {match.teams.home.name}
                </span>
              </div>
            )}
            {match.teams.away && (
              <div className="flex items-center gap-3">
                {match.teams.away.badge ? (
                  <img
                    src={`https://streamed.pk${match.teams.away.badge}`}
                    alt=""
                    className="w-8 h-8 object-contain"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-8 h-8 bg-ufc-surface border border-ufc-border rounded-sm flex items-center justify-center">
                    <span className="text-ufc-muted text-[10px] font-bold">VS</span>
                  </div>
                )}
                <span className="font-oswald font-semibold text-white text-sm uppercase tracking-wide">
                  {match.teams.away.name}
                </span>
              </div>
            )}
          </div>
        ) : (
          <h3 className="font-oswald font-semibold text-white text-sm uppercase tracking-wide mb-3 leading-snug">
            {match.title}
          </h3>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-ufc-border">
          <span className="text-[11px] text-ufc-muted font-medium uppercase tracking-wider">
            {match.sources?.length || 0} {match.sources?.length === 1 ? 'STREAM' : 'STREAMS'}
          </span>
          <div className="flex items-center gap-1.5 text-ufc-red group-hover:translate-x-0.5 transition-transform">
            <span className="text-[11px] font-bold uppercase tracking-widest">WATCH</span>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function App() {
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState('all');
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [streams, setStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [viewMode, setViewMode] = useState('live');
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);
  const [redirectBlockCount, setRedirectBlockCount] = useState(0);
  const [sandboxEnabled, setSandboxEnabled] = useState(true);

  useEffect(() => {
    if (!selectedStream) return;
    const handler = (e) => {
      setRedirectBlockCount((c) => c + 1);
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [selectedStream]);

  const fetchApi = useCallback(async (endpoint) => {
    const res = await fetch(`${API_BASE}${endpoint}`);
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
          if (list.length > 0) {
            streamList = list;
            break;
          }
        } catch {
          continue;
        }
      }

      if (streamList.length === 0) {
        throw new Error('No streams available');
      }

      setStreams(streamList);
      const hd = streamList.find((s) => s.hd);
      setSelectedStream(hd || streamList[0]);
      setRedirectBlockCount(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const closePlayer = () => {
    setSelectedMatch(null);
    setStreams([]);
    setSelectedStream(null);
    setRedirectBlockCount(0);
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-ufc-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-ufc-border border-t-ufc-red animate-spin mx-auto mb-4" />
          <p className="font-oswald text-ufc-text uppercase tracking-widest text-sm">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ufc-black">
      <header className="sticky top-0 z-50 bg-ufc-black/95 backdrop-blur-md border-b border-ufc-border">
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
            </div>

            <div className="flex items-center gap-2">
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
        {/* Video Player */}
        {selectedStream && selectedMatch && (
          <section className="mb-8 animate-fade-in">
            <div className="bg-ufc-darker border border-ufc-border rounded-sm overflow-hidden">
              <div className="relative bg-black" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  key={selectedStream.embedUrl + (sandboxEnabled ? 'sb' : 'ns')}
                  src={selectedStream.embedUrl}
                  className="absolute inset-0 w-full h-full border-0"
                  allowFullScreen
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  referrerPolicy="no-referrer"
                  sandbox={sandboxEnabled ? 'allow-scripts allow-same-origin' : undefined}
                />
              </div>
              {sandboxEnabled && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 bg-black/80 border border-ufc-border/50 rounded-sm">
                  <svg className="w-3 h-3 text-ufc-gold" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                  </svg>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-ufc-gold">Ads Blocked</span>
                  {redirectBlockCount > 0 && (
                    <span className="text-[9px] text-ufc-text">{redirectBlockCount}</span>
                  )}
                </div>
              )}

              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-oswald text-lg font-bold text-white uppercase tracking-wide leading-tight">
                    {selectedMatch.title || 'Live Event'}
                  </h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-ufc-text font-mono">#{selectedStream.streamNo}</span>
                    <span className="text-xs text-ufc-muted">{selectedStream.language || 'EN'}</span>
                    {selectedStream.hd && (
                      <span className="px-1.5 py-0.5 bg-ufc-red text-white text-[10px] font-bold uppercase tracking-wider">
                        HD
                      </span>
                    )}
                    <button
                      onClick={() => setSandboxEnabled(!sandboxEnabled)}
                      className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                        sandboxEnabled
                          ? 'border-ufc-gold text-ufc-gold'
                          : 'border-red-500 text-red-400'
                      }`}
                      title={sandboxEnabled ? 'Click to disable ad blocking if stream fails to load' : 'Click to re-enable ad blocking'}
                    >
                      {sandboxEnabled ? 'AD-BLOCK ON' : 'AD-BLOCK OFF'}
                    </button>
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
                      #{stream.streamNo} {stream.language || ''} {stream.hd ? 'HD' : ''}
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
            <p className="font-oswald text-xl text-white uppercase tracking-wider mb-1">No events found</p>
            <p className="text-ufc-text text-sm">Try a different category or check back later</p>
          </div>
        )}

        {/* Matches grid */}
        {!loading && matches.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {matches.map((match, i) => (
              <div key={match.id || i} className="animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                <MatchCard match={match} onSelect={fetchStreams} />
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-ufc-border py-6 px-4">
        <div className="max-w-[1400px] mx-auto text-center">
          <p className="text-[10px] text-ufc-muted uppercase tracking-widest">
            Streams sourced from third-party providers. Availability may vary.
          </p>
        </div>
      </footer>
    </div>
  );
}
