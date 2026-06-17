import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, Star, Tv, LayoutGrid, List as ListIcon, Check, User, ArrowLeft, Film } from 'lucide-react';
import { getTrending, searchMedia, searchPeople, get_person_credits } from '@/api/search';
import type { PersonResult, PersonCredits } from '@/api/search';
import { get_lists_with_movies } from '@/api/lists';
import MediaDetailModal from '@/components/MediaDetailModal';
import ShowDetailModal from '@/components/ShowDetailModal';
import QuickAddButton from '@/components/QuickAddButton';
import Poster from '@/components/Poster';
import { GlassCard } from '@/components/GlassBox';
import type { TMDBResult, List as ListType } from '@/types/api';
import { useIsMobile } from '@/hooks/use-mobile';

type SearchMode = 'titles' | 'people';
const BIO_LIMIT = 300;

export default function Discover() {
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const initialQuery = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<SearchMode>('titles');
  const [selectedItem, setSelectedItem] = useState<TMDBResult | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [results, setResults] = useState<TMDBResult[]>([]);
  const [peopleResults, setPeopleResults] = useState<PersonResult[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<PersonCredits | null>(null);
  const [loadingPerson, setLoadingPerson] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userLists, setUserLists] = useState<ListType[]>([]);

  useEffect(() => {
    get_lists_with_movies().then(data => setUserLists(data)).catch(() => {});
  }, []);

  const inListIds = new Set<number>();
  userLists.forEach(list => {
    list.movies?.forEach(m => { if (m.tmdb_id) inListIds.add(m.tmdb_id); });
    list.shows?.forEach(s => { if (s.tmdb_id) inListIds.add(s.tmdb_id); });
  });

  useEffect(() => {
    const timer = setTimeout(() => setQuery(inputValue.trim()), 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q !== inputValue) { setInputValue(q); setQuery(q); }
  }, [searchParams]);

  // Title search
  useEffect(() => {
    if (mode !== 'titles') return;
    let cancelled = false;
    async function doSearch() {
      setLoading(true);
      try {
        const data = query ? await searchMedia(query) : await getTrending();
        if (!cancelled) setResults(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    doSearch();
    return () => { cancelled = true; };
  }, [query, mode]);

  // People search
  useEffect(() => {
    if (mode !== 'people') return;
    if (!query) { setPeopleResults([]); setLoading(false); return; }
    let cancelled = false;
    async function doSearch() {
      setLoading(true);
      try {
        const data = await searchPeople(query);
        if (!cancelled) setPeopleResults(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    doSearch();
    return () => { cancelled = true; };
  }, [query, mode]);

  const handlePersonClick = async (person: PersonResult) => {
    setLoadingPerson(true);
    const credits = await get_person_credits(person.id);
    setLoadingPerson(false);
    if (credits) { setSelectedPerson(credits); setBioExpanded(false); }
  };

  const switchMode = (m: SearchMode) => {
    setMode(m);
    setSelectedPerson(null);
    setPeopleResults([]);
  };

  return (
    <div style={{ height: isMobile ? 'auto' : '100%', overflowY: isMobile ? 'initial' : 'auto', paddingRight: isMobile ? '0px' : '8px', boxSizing: 'border-box', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: isMobile ? '24px' : '36px', fontWeight: 700, color: '#fff', letterSpacing: '3px', textTransform: 'uppercase', textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>Discover</h1>
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', overflow: 'hidden' }}>
          <button onClick={() => setViewMode('grid')} style={{ padding: '8px 12px', background: viewMode === 'grid' ? 'var(--t-primary-25)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}>
            <LayoutGrid style={{ width: '16px', color: viewMode === 'grid' ? 'var(--t-primary)' : 'rgba(255,255,255,0.4)' }} />
          </button>
          <button onClick={() => setViewMode('list')} style={{ padding: '8px 12px', background: viewMode === 'list' ? 'var(--t-primary-25)' : 'transparent', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}>
            <ListIcon style={{ width: '16px', color: viewMode === 'list' ? 'var(--t-primary)' : 'rgba(255,255,255,0.4)' }} />
          </button>
        </div>
      </div>

      {/* Search bar + mode toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', maxWidth: '500px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '10px', padding: '10px 16px', backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
          <SearchIcon style={{ width: '16px', color: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
          <input
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '14px', fontFamily: 'inherit', width: '100%', caretColor: 'var(--t-primary)', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
            placeholder={mode === 'titles' ? 'Search movies, shows, anime...' : 'Search actors, directors...'}
            value={inputValue}
            onChange={e => { setInputValue(e.target.value); setSelectedPerson(null); }}
          />
        </div>

        {/* Mode pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {([['titles', Film, 'Titles'], ['people', User, 'People']] as const).map(([m, Icon, label]) => (
            <button
              key={m}
              onClick={() => switchMode(m as SearchMode)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 14px', borderRadius: '20px', fontFamily: 'inherit',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                border: mode === m ? '1px solid var(--t-primary)' : '1px solid rgba(255,255,255,0.15)',
                background: mode === m ? 'var(--t-primary-22)' : 'rgba(255,255,255,0.05)',
                color: mode === m ? 'var(--t-primary)' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.15s',
              }}
            >
              <Icon style={{ width: '12px', height: '12px' }} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Person filmography drill-down */}
      {selectedPerson ? (
        <div>
          <button
            onClick={() => setSelectedPerson(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '16px', padding: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
          >
            <ArrowLeft style={{ width: '14px' }} /> Back to results
          </button>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '16px' : '28px', alignItems: isMobile ? 'center' : 'flex-start', textAlign: isMobile ? 'center' : 'left', marginBottom: '28px', padding: '20px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {selectedPerson.profile_url
              ? <img src={selectedPerson.profile_url} alt="" style={{ width: '110px', height: '110px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--t-primary-50)', flexShrink: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }} />
              : <div style={{ width: '110px', height: '110px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '3px solid var(--t-primary-40)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><User style={{ width: '36px', color: 'rgba(255,255,255,0.3)' }} /></div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>{selectedPerson.name}</div>
              <div style={{ fontSize: '13px', color: 'var(--t-primary)', fontWeight: 700, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>{selectedPerson.department}</div>
              {selectedPerson.biography && (() => {
                const isLong = selectedPerson.biography.length > BIO_LIMIT;
                const displayed = isLong && !bioExpanded
                  ? selectedPerson.biography.slice(0, BIO_LIMIT).trimEnd() + '…'
                  : selectedPerson.biography;
                return (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', lineHeight: 1.75 }}>{displayed}</div>
                    {isLong && (
                      <button
                        onClick={() => setBioExpanded(e => !e)}
                        style={{ marginTop: '6px', background: 'none', border: 'none', color: 'var(--t-primary)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                      >
                        {bioExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px' }}>
            Filmography · {selectedPerson.credits.length}
          </div>

          {viewMode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(130px, 1fr))' : 'repeat(auto-fill, 145px)', gap: '16px', justifyContent: isMobile ? 'stretch' : 'start', alignItems: 'start' }}>
              {selectedPerson.credits.map(item => {
                const asResult: TMDBResult = { id: item.id, media_type: item.media_type, title: item.title, poster_url: item.poster_url, rating: item.rating ?? 0, overview: '', backdrop_url: null, release_date: item.release_date ?? '', popularity: item.popularity ?? 0, genre_ids: [] };
                const isInList = inListIds.has(item.id);
                return (
                  <div key={`${item.id}-${item.media_type}`} style={{ cursor: 'pointer', transition: 'transform 0.15s', minHeight: 0, minWidth: 0 }} onClick={() => setSelectedItem(asResult)} onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')} onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
                    <div className="poster-wrap" style={{ position: 'relative', width: '100%' }}>
                      <Poster poster_url={item.poster_url} style={{ borderRadius: '10px', border: isInList ? '2px solid var(--t-primary)' : '1px solid rgba(255,255,255,0.15)' }} />
                      {isInList && <div style={{ position: 'absolute', top: '6px', right: '6px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--t-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}><Check style={{ width: '12px', color: '#fff' }} /></div>}
                      <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.72)', padding: '4px 8px', borderRadius: '7px', fontSize: '13px', fontWeight: 700, color: item.media_type === 'tv' ? 'var(--t-primary)' : '#ffd700', display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid rgba(255,255,255,0.15)', zIndex: 2 }}>
                        {item.media_type === 'tv' ? <Tv style={{ width: '13px', height: '13px' }} /> : <Star style={{ width: '13px', height: '13px' }} />}
                        {item.rating?.toFixed(1) || '—'}
                      </div>
                      <QuickAddButton item={asResult} />
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                      {item.role && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.role}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedPerson.credits.map(item => {
                const asResult: TMDBResult = { id: item.id, media_type: item.media_type, title: item.title, poster_url: item.poster_url, rating: item.rating ?? 0, overview: '', backdrop_url: null, release_date: item.release_date ?? '', popularity: item.popularity ?? 0, genre_ids: [] };
                return (
                  <GlassCard key={`${item.id}-${item.media_type}`} onClick={() => setSelectedItem(asResult)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {item.media_type === 'tv' ? <Tv style={{ width: '10px', color: 'var(--t-primary)' }} /> : <Star style={{ width: '10px', color: 'rgba(255,255,255,0.3)' }} />}
                          {item.media_type === 'tv' ? 'TV Show' : 'Movie'}
                          {item.role && <> · <span style={{ fontStyle: 'italic' }}>{item.role}</span></>}
                          {item.rating && <> · <Star style={{ width: '10px', color: '#ffd700' }} /> {item.rating.toFixed(1)}</>}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      ) : mode === 'people' ? (
        /* People results */
        loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Loading...</div>
        ) : loadingPerson ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Loading filmography...</div>
        ) : !query ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Search for an actor or director</div>
        ) : peopleResults.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>No people found</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(130px, 1fr))' : 'repeat(auto-fill, 145px)', gap: '16px', justifyContent: isMobile ? 'stretch' : 'start', alignItems: 'start' }}>
            {peopleResults.map(person => (
              <div
                key={person.id}
                onClick={() => handlePersonClick(person)}
                style={{ cursor: 'pointer', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor = 'var(--t-primary-30)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'none'; }}
              >
                {person.profile_url
                  ? <img src={person.profile_url} alt="" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.15)' }} />
                  : <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User style={{ width: '24px', color: 'rgba(255,255,255,0.3)' }} /></div>
                }
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{person.name}</div>
                  {person.department && <div style={{ fontSize: '11px', color: 'var(--t-primary)', fontWeight: 600, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{person.department}</div>}
                  {person.known_for.length > 0 && (
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                      {person.known_for.map(k => k.title).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Title results */
        loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Loading...</div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
            {query ? 'No results found' : 'No trending data available'}
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(130px, 1fr))' : 'repeat(auto-fill, 145px)', gap: '16px', justifyContent: isMobile ? 'stretch' : 'start', alignItems: 'start' }}>
            {results.map(item => {
              const isInList = inListIds.has(item.id);
              return (
                <div key={item.id} style={{ cursor: 'pointer', transition: 'transform 0.15s', minHeight: 0, minWidth: 0, maxWidth: isMobile ? 'none' : '160px', width: '100%' }} onClick={() => setSelectedItem(item)} onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')} onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
                  <div className="poster-wrap" style={{ position: 'relative', width: '100%' }}>
                    <Poster poster_url={item.poster_url} style={{ borderRadius: '10px', border: isInList ? '2px solid var(--t-primary)' : '1px solid rgba(255,255,255,0.15)', boxShadow: isInList ? '0 0 12px var(--t-primary-40)' : undefined, transition: 'box-shadow 0.2s' }} />
                    {isInList && <div style={{ position: 'absolute', top: '6px', right: '6px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--t-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', zIndex: 2 }}><Check style={{ width: '12px', color: '#fff' }} /></div>}
                    <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.72)', padding: '4px 8px', borderRadius: '7px', fontSize: '13px', fontWeight: 700, color: item.media_type === 'tv' ? 'var(--t-primary)' : '#ffd700', display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid rgba(255,255,255,0.15)', zIndex: 2, lineHeight: 1 }}>
                      {item.media_type === 'tv' ? <Tv style={{ width: '13px', height: '13px', display: 'block' }} /> : <Star style={{ width: '13px', height: '13px', display: 'block' }} />}
                      {item.rating?.toFixed(1) || '—'}
                    </div>
                    <QuickAddButton item={item} />
                  </div>
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>{item.title}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {results.map((item, i) => (
              <GlassCard key={item.id} onClick={() => setSelectedItem(item)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, minWidth: '24px' }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {item.media_type === 'tv' ? <Tv style={{ width: '10px', color: 'var(--t-primary)' }} /> : <Star style={{ width: '10px', color: 'rgba(255,255,255,0.3)' }} />}
                      {item.media_type === 'tv' ? 'TV Show' : 'Movie'} &middot; <Star style={{ width: '10px', color: '#ffd700' }} /> {item.rating?.toFixed(1) || '—'}
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )
      )}

      {selectedItem && selectedItem.media_type === 'tv' ? (
        <ShowDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      ) : selectedItem ? (
        <MediaDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      ) : null}
    </div>
  );
}
