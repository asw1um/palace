'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Film, Sparkles, Tv, User } from '@/lib/icons';
import { discover } from '@/data/api';
import type { PersonDetails } from '@/data/types';
import { useGridColumns } from '@/lib/hooks';
import { useAppData } from '@/components/AppData';
import { Poster } from '@/components/Poster';
import { Button } from '@/components/ui/Button';
import { Segmented, Select } from '@/components/ui/Field';
import { Chip, Empty, Skeleton } from '@/components/ui/Bits';

type Kind = 'all' | 'movie' | 'tv';
type Sort = 'popular' | 'newest' | 'rating' | 'az';

const PAGE = 24;
const BIO_CLAMP = 480;

export default function PersonDetail() {
  const { id: idParam } = useParams();
  const id = typeof idParam === 'string' ? Number(idParam) : NaN;
  const router = useRouter();
  const { progressFor } = useAppData();
  const [person, setPerson] = useState<PersonDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Kind>('all');
  const [sort, setSort] = useState<Sort>('popular');
  const [pages, setPages] = useState(1);
  const [gridRef, cols] = useGridColumns();
  const [bioOpen, setBioOpen] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setPerson(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setBioOpen(false);
    discover
      .person(id)
      .then((p) => alive && setPerson(p))
      .catch(() => alive && setPerson(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  const shown = useMemo(() => {
    const rows = (person?.credits ?? []).filter((c) => (kind === 'all' ? true : c.media_type === kind));
    const sorted = [...rows];
    if (sort === 'newest') sorted.sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''));
    if (sort === 'rating') sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (sort === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }, [person, kind, sort]);

  useEffect(() => {
    setPages(1);
  }, [id, kind, sort]);

  // Whole rows per page; the last page shows whatever is left.
  const perPage = Math.max(1, Math.round(PAGE / cols)) * cols;
  const limit = Math.min(perPage * pages, shown.length);

  if (loading) {
    return (
      <div className="stack gap-4">
        <Skeleton h={180} r="var(--r-md)" />
        <div className="grid grid--posters">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} h="auto" r="var(--r-md)" />
          ))}
        </div>
      </div>
    );
  }

  if (!person) {
    return (
      <Empty
        icon={<User size={22} />}
        title="Person not found"
        action={<Button icon={<ArrowLeft size={15} />} onClick={() => router.back()}>Go back</Button>}
      >
        We couldn&apos;t load this person from TMDB.
      </Empty>
    );
  }

  const bio = person.biography?.trim() ?? '';
  const longBio = bio.length > BIO_CLAMP;
  const films = person.credits.filter((c) => c.media_type === 'movie').length;
  const series = person.credits.length - films;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{person.name}</h1>
          <p className="page-head__sub">
            {films} film{films === 1 ? '' : 's'} · {series} series
          </p>
        </div>
        <div className="page-head__actions">
          <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => router.back()}>
            Back
          </Button>
        </div>
      </header>

      <div className="person-head">
        <div className="person-head__photo">
          {person.profile_url ? (
            <Image
              src={person.profile_url}
              alt={person.name}
              width={140}
              height={210}
              priority
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <User size={40} className="faint" />
          )}
        </div>
        <div className="stack gap-3 grow">
          {person.department && (
            <div className="row gap-2 wrap">
              <Chip tone="accent">{person.department}</Chip>
            </div>
          )}
          <p className="muted" style={{ maxWidth: '76ch', whiteSpace: 'pre-line' }}>
            {bio
              ? longBio && !bioOpen
                ? `${bio.slice(0, BIO_CLAMP).trimEnd()}…`
                : bio
              : 'No biography yet.'}
          </p>
          {longBio && (
            <div>
              <Button variant="ghost" size="sm" onClick={() => setBioOpen((o) => !o)}>
                {bioOpen ? 'Show less' : 'Read more'}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="row gap-3 wrap between">
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
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ width: 150 }}>
          <option value="popular">Most popular</option>
          <option value="newest">Newest first</option>
          <option value="rating">Highest rated</option>
          <option value="az">A – Z</option>
        </Select>
      </div>

      {shown.length === 0 ? (
        <Empty icon={<Film size={22} />} title="No credits here">
          Nothing matches this filter.
        </Empty>
      ) : (
        <>
          <div className="grid grid--posters" ref={gridRef}>
            {shown.slice(0, limit).map((c) => {
              const ref = {
                tmdb_id: c.id,
                media_type: c.media_type,
                title: c.title,
                poster_url: c.poster_url,
                release_date: c.release_date,
                rating: c.rating ?? undefined,
              };
              const p = progressFor(ref);
              return (
                <Poster
                  key={`${c.media_type}-${c.id}`}
                  item={ref}
                  watched={p.watched}
                  progress={p.pct}
                  footer={
                    <div className="stack gap-1">
                      <div className="truncate" style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                        {c.title}
                      </div>
                      <div className="truncate faint" style={{ fontSize: 'var(--text-xs)' }}>
                        {[(c.release_date ?? '').slice(0, 4), c.role].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  }
                />
              );
            })}
          </div>

          {limit < shown.length && (
            <div className="row center">
              <Button variant="soft" icon={<Sparkles size={15} />} onClick={() => setPages((p) => p + 1)}>
                Show {Math.min(perPage, shown.length - limit)} more
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
