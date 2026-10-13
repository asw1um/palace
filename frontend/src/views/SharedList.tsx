'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Film, ListVideo, Tv } from '@/lib/icons';
import { lists as listsApi } from '@/data/api';
import type { SharedList as SharedListData } from '@/data/types';
import { titleCase } from '@/lib/format';
import { Empty, Skeleton } from '@/components/ui/Bits';

/** Read-only view of a list behind a share link. Works without an account. */
export default function SharedList() {
  const { token: tokenParam } = useParams();
  const token = typeof tokenParam === 'string' ? tokenParam : '';
  const [list, setList] = useState<SharedListData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listsApi
      .shared(token)
      .then(setList)
      .catch(() => setList(null))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="shared-page">
      <header className="row between gap-3 wrap">
        <Link href="/" className="brand" aria-label="Palace home">
          <div className="brand__mark">
            <svg width="16" height="16" viewBox="0 0 64 64" fill="none">
              <path d="M14 44V26l9 7 9-13 9 13 9-7v18a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3Z" fill="currentColor" />
            </svg>
          </div>
          <span className="brand__word">Palace</span>
        </Link>
        <Link href="/login" className="btn btn--primary btn--sm">
          Make your own lists
        </Link>
      </header>

      {loading ? (
        <div className="grid grid--posters">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} h="auto" r="var(--r-md)" />
          ))}
        </div>
      ) : !list ? (
        <Empty icon={<ListVideo size={22} />} title="This list isn’t shared any more">
          The link may have been turned off, or the list was deleted.
        </Empty>
      ) : (
        <>
          <div className="page-head">
            <div>
              <h1>{titleCase(list.name)}</h1>
              <p className="page-head__sub">
                {list.is_club ? 'A club list from' : 'A list by'} {list.owner} · {list.items.length} title
                {list.items.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {list.items.length === 0 ? (
            <Empty icon={<Film size={22} />} title="Nothing in this list yet" />
          ) : (
            <div className="grid grid--posters">
              {list.items.map((item) => (
                <a
                  key={`${item.media_type}-${item.tmdb_id}`}
                  className="stack gap-2 shared-tile"
                  href={`https://www.themoviedb.org/${item.media_type}/${item.tmdb_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={item.title}
                >
                  <div className="shared-tile__poster">
                    {item.poster_url ? (
                      <Image src={item.poster_url} alt="" fill sizes="(max-width: 600px) 45vw, 180px" style={{ objectFit: 'cover' }} />
                    ) : item.media_type === 'tv' ? (
                      <Tv size={28} className="faint" />
                    ) : (
                      <Film size={28} className="faint" />
                    )}
                  </div>
                  <div className="truncate" style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                    {item.title}
                  </div>
                </a>
              ))}
            </div>
          )}
        </>
      )}

      <footer className="faint" style={{ fontSize: 'var(--text-xs)' }}>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </footer>
    </div>
  );
}
