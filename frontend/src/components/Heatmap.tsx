import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isoDay, plural } from '@/lib/format';
import type { WatchEvent } from '@/data/types';

/**
 * GitHub-style contribution grid for watch activity. — issue #44
 *
 * The tooltip is portalled and fixed-positioned: the grid itself scrolls
 * horizontally, and anything absolutely positioned inside a scroll container
 * gets clipped by it.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

interface Day {
  date: string;
  count: number;
  minutes: number;
  month: number;
  dayOfMonth: number;
  future: boolean;
}

interface Tip {
  x: number;
  y: number;
  text: string;
  sub: string;
}

export function Heatmap({ events, weeks = 26 }: { events: WatchEvent[]; weeks?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const { columns, max, total, monthLabels } = useMemo(() => {
    const byDay = new Map(events.map((e) => [e.date, e]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start on the Sunday `weeks` weeks back so every column is a full week.
    const start = new Date(today);
    start.setDate(start.getDate() - weeks * 7 - today.getDay());

    const cols: Day[][] = [];
    const cursor = new Date(start);
    for (let w = 0; w <= weeks; w++) {
      const week: Day[] = [];
      for (let d = 0; d < 7; d++) {
        const key = isoDay(cursor);
        const hit = byDay.get(key);
        week.push({
          date: key,
          count: hit?.count ?? 0,
          minutes: hit?.minutes ?? 0,
          month: cursor.getMonth(),
          dayOfMonth: cursor.getDate(),
          future: cursor.getTime() > today.getTime(),
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      cols.push(week);
    }

    // A month label sits above the first week that contains that month's 1st.
    const labels: { col: number; label: string }[] = [];
    cols.forEach((week, i) => {
      const first = week.find((d) => d.dayOfMonth <= 7);
      if (first && !labels.some((l) => l.label === MONTHS[first.month])) {
        labels.push({ col: i, label: MONTHS[first.month] });
      }
    });

    const flat = cols.flat();
    return {
      columns: cols,
      max: Math.max(1, ...flat.map((d) => d.count)),
      total: flat.reduce((a, d) => a + d.count, 0),
      monthLabels: labels,
    };
  }, [events, weeks]);

  // Newest activity is on the right — start the view there.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [columns]);

  // Staggered entrance removed — "calm motion" keeps gsap/animejs out of the bundle.

  const level = (count: number) => {
    if (!count) return 0;
    const ratio = count / max;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
  };

  const showTip = (el: HTMLElement, day: Day) => {
    const r = el.getBoundingClientRect();
    setTip({
      x: r.left + r.width / 2,
      y: r.top,
      text: new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      }),
      sub: day.count
        ? `${plural(day.count, 'title')} · ${Math.round(day.minutes / 60)}h ${day.minutes % 60}m`
        : 'Nothing watched',
    });
  };

  return (
    <div className="stack gap-3">
      <div className="heatmap">
        <div className="heatmap__weekdays" aria-hidden="true">
          {WEEKDAYS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        <div className="heatmap__scroll no-scrollbar" ref={scrollRef}>
          <div
            className="heatmap__months"
            style={{ gridTemplateColumns: `repeat(${columns.length}, var(--cell))` }}
            aria-hidden="true"
          >
            {monthLabels.map((m) => (
              <span key={m.label} style={{ gridColumn: m.col + 1 }}>
                {m.label}
              </span>
            ))}
          </div>

          <div
            className="heatmap__grid"
            ref={ref}
            style={{ gridTemplateColumns: `repeat(${columns.length}, var(--cell))` }}
            onMouseLeave={() => setTip(null)}
          >
            {columns.flat().map((day) =>
              day.future ? (
                <span key={day.date} className="heat-cell heat-cell--empty" />
              ) : (
                <span
                  key={day.date}
                  className="heat-cell"
                  data-level={level(day.count)}
                  tabIndex={-1}
                  onMouseEnter={(e) => showTip(e.currentTarget, day)}
                  onFocus={(e) => showTip(e.currentTarget, day)}
                />
              ),
            )}
          </div>
        </div>
      </div>

      <div className="row gap-3 between heatmap__legend" style={{ fontSize: 'var(--fs-11)' }}>
        <span>
          {plural(total, 'title')} in the last {weeks} weeks
        </span>
        <span className="row gap-1">
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="heat-cell" data-level={l} style={{ opacity: 1 }} />
          ))}
          More
        </span>
      </div>

      {tip &&
        createPortal(
          <div
            className="heat-tip"
            style={{ left: tip.x, top: tip.y }}
            role="tooltip"
          >
            <strong>{tip.text}</strong>
            <span>{tip.sub}</span>
          </div>,
          document.body,
        )}
    </div>
  );
}
