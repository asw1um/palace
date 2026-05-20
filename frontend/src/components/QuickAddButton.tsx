import React, { useRef } from 'react';
import { Plus } from 'lucide-react';
import AddToListMenu from './AddToListMenu';
import type { TMDBResult } from '@/types/api';

interface Props {
  item?: TMDBResult;
  onAdd?: () => void;
}

export default function QuickAddButton({ item, onAdd }: Props) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  const movieData = item
    ? { tmdb_id: item.id, title: item.title, poster_url: item.poster_url, media_type: item.media_type }
    : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleClick}
        style={{
          position: 'absolute',
          top: '6px',
          right: '6px',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: menuOpen
            ? 'linear-gradient(180deg, #5cb85c 0%, #449d44 100%)'
            : 'linear-gradient(180deg, #4da6ff 0%, #3a7bd5 100%)',
          border: '2px solid rgba(255,255,255,0.25)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transition: 'opacity 0.2s ease, transform 0.15s ease',
          zIndex: 5,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          pointerEvents: 'auto',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        title="Add to list"
        className="quick-add-btn"
      >
        <Plus style={{ width: '14px', height: '14px', color: '#fff' }} />
      </button>
      {menuOpen && (
        <AddToListMenu
          onClose={() => { setMenuOpen(false); onAdd?.(); }}
          triggerRef={btnRef}
          movieTitle={item?.title}
          movieData={movieData}
          placement="below"
        />
      )}
    </>
  );
}
