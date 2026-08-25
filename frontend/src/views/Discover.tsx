import { useEffect, useMemo, useRef, useState } from 'react';
import { Compass, Film, Search, SlidersHorizontal, Sparkles, Tv, Wand2 } from '@/lib/icons';
import { discover } from '@/data/api';
import type { TMDBResult } from '@/data/types';
import { useAppData } from '@/components/AppData';
import { Poster } from '@/components/Poster';
import { Button } from '@/components/ui/Button';
import { SearchInput, Segmented, Select } from '@/components/ui/Field';
import { Empty, Skeleton } from '@/components/ui/Bits';
import { useDebounced } from '@/lib/hooks';
import { suggest } from '@/lib/fuzzy';
type Kind = 'all' | 'movie' | 'tv';
type Sort = 'popular' | 'rating' | 'newest' | 'az';

const PAGE = 24;

export default function Discover() {
  const { progressFor } = useAppData();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [sort, setSort] = useState<Sort>('popular');
  const [genre, setGenre] = useState('all');
  const [trending, setTrending] = useState<TMDBResult[]>([]);
  const [results, setResults] = useState<TMDBResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const debounced = useDebounced(query, 260);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    discover
      .trending()
      .then(setTrending)
      .catch(() => setTrending([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!debounced.trim()) {
      setResults(null);
      return;
    }
    let alive = true;
    setLoading(true);
    discover
      .search(debounced)
      .then((r) => alive && setResults(r))
      .catch(() => alive && setResults([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [debounced]);

  const source = results ?? trending;

  const genres = useMemo(() => {
    const set = new Set<string>();
    trending.forEach((t) => t.genres?.forEach((g) => set.add(g)));
    return ['all', ...[...set].sort()];
  }, [trending]);

  const shown = useMemo(() => {
    let rows = source.filter((r) => (kind === 'all' ? true : r.media_type === kind));
    if (genre !== 'all') rows = rows.filter((r) => r.genres?.includes(genre));
    const sorted = [...rows];
    if (sort === 'rating') sorted.sort((a, b) => b.rating - a.rating);
    if (sort === 'newest') sorted.sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''));
    if (sort === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'popular' && !results) sorted.sort((a, b) => b.popularity - a.popularity);
    return sorted;
  }, [source, kind, genre, sort, results]);

  const visible = shown.slice(0, limit);

  useEffect(() => {
    setLimit(PAGE);
  }, [debounced, kind, genre, sort]);


  // "Did you mean" when a search comes back empty. — issues #51, #52
  const didYouMean =
    results && results.length === 0 && debounced.trim()
      ? suggest(debounced, discover.corpus())
      : null;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Discover</h1>
          <p className="page-head__sub">
            {results ? `${shown.length} results for “${debounced}”` : 'Trending right now'}
          </p>
        </div>
        <div className="page-head__actions">
          <Segmented<Kind>
            ariaLabel="Media type"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'all', label: 'All' },
              { value: 'movie', label: 'Films', icon: <Film /> },
              { value: 'tv', label: 'Series', icon: <Tv /> },
            ]}
          />
        </div>
      </header>

      <div className="row gap-3 wrap">
        <div style={{ flex: '1 1 320px' }}>
          <SearchInput
            icon={<Search />}
            value={query}
            placeholder="Search films and series…"
            onChange={(e) => setQuery(e.target.value)}
            trailing={
              query ? (
                <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                  Clear
                </Button>
              ) : undefined
            }
          />
        </div>
        <div className="row gap-2">
          <SlidersHorizontal size={16} className="faint" />
          <Select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ width: 150 }}>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g === 'all' ? 'All genres' : g}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ width: 150 }}>
            <option value="popular">Most popular</option>
            <option value="rating">Highest rated</option>
            <option value="newest">Newest first</option>
            <option value="az">A – Z</option>
          </Select>
        </div>
      </div>

      {didYouMean && (
        <div className="panel panel--inset row gap-2" style={{ padding: 'var(--space-3)' }}>
          <Wand2 size={16} style={{ color: 'var(--accent)' }} />
          <span className="muted">
            No matches. Did you mean{' '}
            <button className="chip chip--accent" onClick={() => setQuery(didYouMean)}>
              {didYouMean}
            </button>
            ?
          </span>
        </div>
      )}

      {loading ? (
        <div className="grid grid--posters">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} h="auto" r="var(--r-md)" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Empty icon={<Compass size={22} />} title="Nothing here">
          Try a different search, or clear the filters.
        </Empty>
      ) : (
        <>
          <div className="grid grid--posters" ref={gridRef}>
            {visible.map((r, i) => {
              const ref = {
                tmdb_id: r.id,
                media_type: r.media_type,
                title: r.title,
                poster_url: r.poster_url,
                release_date: r.release_date,
                rating: r.rating,
              };
              const p = progressFor(ref);
              return (
                <Poster
                  key={`${r.media_type}-${r.id}`}
                  item={ref}
                  watched={p.watched}
                  progress={p.pct}
                  priority={i === 0}
                  footer={
                    <div className="stack gap-1">
                      <div className="truncate" style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                        {r.title}
                      </div>
                      <div className="row gap-2 faint" style={{ fontSize: 'var(--text-xs)' }}>
                        <span>{(r.release_date ?? '').slice(0, 4)}</span>
                        {r.genres?.[0] && <span>· {r.genres[0]}</span>}
                      </div>
                    </div>
                  }
                />
              );
            })}
          </div>

          {/* Trending used to stop at ~20 titles. — issue #49 */}
          {limit < shown.length && (
            <div className="row center">
              <Button variant="soft" icon={<Sparkles size={15} />} onClick={() => setLimit((l) => l + PAGE)}>
                Show {Math.min(PAGE, shown.length - limit)} more
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
