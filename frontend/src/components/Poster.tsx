import { useState, type DragEvent as ReactDragEvent, type ReactNode } from 'react';
import {
  Check, Eye, Film, FolderPlus, GripVertical, Info, ListPlus, Plus, Star, Trash2, Tv,
} from 'lucide-react';
import { Menu, MenuItem, MenuLabel, MenuSep, useContextMenu } from './ui/Menu';
import { IconButton } from './ui/Button';
import { useAppData } from './AppData';
import { pop } from '@/lib/motion';
import { year } from '@/lib/format';
import type { MediaType } from '@/data/types';

export interface PosterRef {
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  poster_url: string | null;
  release_date?: string;
  rating?: number;
}

export function Poster({
  item, progress, watched, onRemove, footer, className = '',
  selectable, selected, onSelect, draggable, onDragStart, onDragOver, onDrop,
}: {
  item: PosterRef;
  /** 0–100; draws the thin bar along the bottom. */
  progress?: number;
  watched?: boolean;
  onRemove?: () => void;
  footer?: ReactNode;
  className?: string;
  /** Edit mode: clicking picks the tile instead of opening it. */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: ReactDragEvent) => void;
  onDrop?: () => void;
}) {
  const { openMedia, openAddTo, quickAdd, markWatched, openCreateList } = useAppData();
  const menu = useContextMenu();
  const [failed, setFailed] = useState(false);

  const activate = () => (selectable ? onSelect?.() : openMedia(item));

  return (
    <div className={`stack gap-2 poster-tile ${className}`}>
      <div
        className={`poster ${selected ? 'is-selected' : ''} ${draggable ? 'is-draggable' : ''}`}
        role={selectable ? 'checkbox' : 'button'}
        aria-checked={selectable ? !!selected : undefined}
        tabIndex={0}
        aria-label={item.title}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
          }
        }}
        {...menu.triggerProps}
      >
        {item.poster_url && !failed ? (
          <img src={item.poster_url} alt="" loading="lazy" onError={() => setFailed(true)} />
        ) : (
          <div className="poster__fallback">{item.title}</div>
        )}

        {selectable ? (
          <div className="poster__check" aria-hidden="true">
            {selected && <Check size={14} />}
          </div>
        ) : (
          <div className="poster__badge">
            {item.media_type === 'tv' ? <Tv size={11} /> : <Film size={11} />}
            {item.rating ? item.rating.toFixed(1) : item.media_type === 'tv' ? 'Series' : 'Film'}
          </div>
        )}

        {draggable && (
          <div className="poster__grip" aria-hidden="true">
            <GripVertical size={14} />
          </div>
        )}

        {/* Hover actions get out of the way while picking tiles. */}
        {!selectable && (
          <div className="poster__actions">
            <IconButton
              label="Add to list"
              onClick={(e) => {
                e.stopPropagation();
                pop(e.currentTarget);
                openAddTo(item);
              }}
            >
              <Plus size={15} />
            </IconButton>
            <IconButton
              label={watched ? 'Watched' : 'Mark watched'}
              onClick={(e) => {
                e.stopPropagation();
                pop(e.currentTarget);
                markWatched(item, !watched);
              }}
            >
              {watched ? <Check size={15} /> : <Eye size={15} />}
            </IconButton>
          </div>
        )}

        <div className="poster__veil">
          <div className="poster__title">{item.title}</div>
          <div className="poster__row faint" style={{ fontSize: 11, color: 'rgba(255,255,255,.72)' }}>
            {year(item.release_date) && <span>{year(item.release_date)}</span>}
            {item.rating ? (
              <>
                <span>·</span>
                <Star size={11} /> {item.rating.toFixed(1)}
              </>
            ) : null}
          </div>
        </div>

        {progress !== undefined && progress > 0 && (
          <div className="poster__progress">
            <span style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        )}
      </div>

      {footer}

      <Menu open={menu.open} at={menu.at} onClose={menu.close}>
        <MenuLabel>{item.title}</MenuLabel>
        <MenuItem icon={<Info size={15} />} onClick={() => { menu.close(); openMedia(item); }}>
          View details
        </MenuItem>
        <MenuItem icon={<ListPlus size={15} />} onClick={() => { menu.close(); openAddTo(item); }}>
          Add to list…
        </MenuItem>
        <MenuItem icon={<Plus size={15} />} onClick={() => { menu.close(); quickAdd(item); }}>
          Quick add to Want to watch
        </MenuItem>
        {/* Create a brand new list straight from a poster — issue #116 */}
        <MenuItem icon={<FolderPlus size={15} />} onClick={() => { menu.close(); openCreateList(item); }}>
          New list with this title…
        </MenuItem>
        <MenuSep />
        <MenuItem
          icon={watched ? <Eye size={15} /> : <Check size={15} />}
          onClick={() => { menu.close(); markWatched(item, !watched); }}
        >
          {watched ? 'Mark as unwatched' : 'Mark as watched'}
        </MenuItem>
        {onRemove && (
          <>
            <MenuSep />
            <MenuItem icon={<Trash2 size={15} />} danger onClick={() => { menu.close(); onRemove(); }}>
              Remove from this list
            </MenuItem>
          </>
        )}
      </Menu>
    </div>
  );
}
