import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import { Search } from '@/lib/icons';
import { Chip } from './ui/Bits';

export interface SearchResult {
  id: number;
  title: string;
  type: 'Film' | 'Series' | 'Person';
  thumb?: string | null;
}

export function SearchBar({
  results = [],
  onSearch,
  onOpen,
}: {
  results?: SearchResult[];
  onSearch: (q: string) => void;
  onOpen?: (result: SearchResult) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced 250ms call to onSearch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, onSearch]);

  useEffect(() => {
    setOpen(query.trim().length > 0 && results.length > 0);
    setCursor(0);
  }, [results, query]);

  const select = (r: SearchResult) => {
    onOpen?.(r);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[cursor]) select(results[cursor]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="searchbar-wrap">
      <div className="searchbar-field">
        <Search size={14} className="searchbar-field__icon" aria-hidden="true" />
        <input
          ref={inputRef}
          className="searchbar-field__input"
          placeholder="Search films, series, people..."
          value={query}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          role="combobox"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim() && results.length) setOpen(true); }}
          onBlur={() => { setTimeout(() => setOpen(false), 150); }}
          onKeyDown={onKeyDown}
        />
      </div>

      {open && (
        <div className="searchbar-results" role="listbox" aria-label="Search results">
          {results.slice(0, 10).map((r, i) => (
            <button
              key={r.id}
              role="option"
              aria-selected={i === cursor}
              className="searchbar-result"
              data-active={i === cursor || undefined}
              onMouseEnter={() => setCursor(i)}
              onMouseDown={(e) => { e.preventDefault(); select(r); }}
            >
              {r.thumb ? (
                <Image
                  src={r.thumb}
                  alt=""
                  width={28}
                  height={42}
                  sizes="28px"
                  className="searchbar-result__thumb"
                  unoptimized={r.thumb.startsWith('data:')}
                />
              ) : (
                <div className="searchbar-result__avatar" aria-hidden="true">
                  {r.title.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="searchbar-result__title truncate">{r.title}</span>
              <Chip>{r.type}</Chip>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
