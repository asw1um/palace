import { useState, useRef } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/*
  Clean search bar with smooth focus transitions.
  No infinite animations — just calm, subtle state changes.
*/

export default function AnimatedSearchBar() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      navigate('/discover?q=' + encodeURIComponent(value.trim()));
    }
  };

  const isActive = focused || hovered;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => inputRef.current?.focus()}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 16px',
        borderRadius: '10px',
        cursor: 'text',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        background: focused
          ? 'rgba(0,0,0,0.5)'
          : 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(12px)',
        border: isActive
          ? '1px solid rgba(255,255,255,0.45)'
          : '1px solid rgba(255,255,255,0.25)',
        width: '100%',
        boxShadow: focused
          ? '0 0 12px var(--t-primary-20), 0 4px 12px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.2)'
          : hovered
            ? '0 0 8px var(--t-primary-10), 0 2px 6px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.12)'
            : '0 2px 6px rgba(0,0,0,0.1)',
      }}
    >
      {/* Search icon */}
      <div style={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
        <Search
          style={{
            width: '16px',
            height: '16px',
            color: focused ? 'rgba(160,220,255,1)' : 'rgba(255,255,255,0.75)',
            transition: 'color 0.3s ease',
          }}
        />
      </div>

      {/* Input field */}
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder="Search movies, shows, anime..."
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#fff',
          fontSize: '14px',
          fontFamily: 'inherit',
          width: '100%',
          position: 'relative',
          zIndex: 1,
          caretColor: 'var(--t-primary)',
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          transition: 'text-shadow 0.3s ease',
        }}
      />
    </div>
  );
}
