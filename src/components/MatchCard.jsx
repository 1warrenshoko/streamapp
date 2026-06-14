import React, { useState } from 'react';

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

  if (hours < 1) return <span className="text-gray-400 dark:text-ufc-text text-xs font-medium">{minutes}m</span>;
  if (hours < 24) return <span className="text-gray-400 dark:text-ufc-text text-xs font-medium">{hours}h {minutes}m</span>;

  return (
    <span className="text-gray-400 dark:text-ufc-text text-xs font-medium">
      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      <span className="text-gray-500 dark:text-ufc-muted ml-1">
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

const MatchCard = React.memo(function MatchCard({ match, currentTime, isVisible, miniStream, onSelect, onCardRef, onMiniFail }) {
  const isLive = new Date(match.date) <= currentTime;
  const posterUrl = match.poster ? `https://streamed.pk${match.poster}` : null;
  const [iframeFailed, setIframeFailed] = useState(false);

  const showIframe = isVisible && miniStream && !miniStream.loading && !iframeFailed;

  return (
    <div
      ref={onCardRef}
      data-match-id={match.id}
      className="match-card group relative bg-white dark:bg-ufc-card border border-gray-200 dark:border-ufc-border rounded-sm overflow-hidden transition-colors"
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 280px' }}
    >
      {/* Poster or mini-iframe */}
      <div className="relative aspect-video bg-gray-100 dark:bg-ufc-darker overflow-hidden">
        {isVisible && miniStream?.loading && (
          <div className="absolute inset-0 skeleton" />
        )}
        {showIframe ? (
          <iframe
            src={miniStream.embedUrl}
            className="absolute inset-0 w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            onLoad={(e) => {
              try {
                const meta = e.target.contentDocument?.querySelector('meta[name="embed-status"]');
                if (meta?.content === 'dead') {
                  setIframeFailed(true);
                  if (onMiniFail) onMiniFail(match.id);
                }
              } catch {}
            }}
            onError={() => { setIframeFailed(true); if (onMiniFail) onMiniFail(match.id); }}
          />
        ) : posterUrl && !iframeFailed ? (
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

        <div className="absolute inset-0 bg-gradient-to-t from-ufc-black via-transparent to-transparent pointer-events-none" />

        {isLive && (
          <div className="absolute top-0 left-0 w-full h-0.5 bg-ufc-red" />
        )}
      </div>

      <button
        onClick={() => onSelect(match)}
        className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-[#1e1e1e] transition-colors focus:outline-none focus:bg-gray-50 dark:focus:bg-[#1e1e1e]"
      >
        <div className="flex items-center justify-between mb-2">
          <CountdownBadge timestamp={match.date} currentTime={currentTime} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-ufc-muted px-1.5 py-0.5 border border-gray-200 dark:border-ufc-border rounded-sm">
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
                <span className="font-oswald font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-wide truncate">
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
                <span className="font-oswald font-semibold text-gray-900 dark:text-white text-xs uppercase tracking-wide truncate">
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

        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-ufc-border">
          <span className="text-[10px] text-gray-400 dark:text-ufc-muted font-medium uppercase tracking-wider">
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
    <div className="bg-white dark:bg-ufc-card border border-gray-200 dark:border-ufc-border rounded-sm overflow-hidden">
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
