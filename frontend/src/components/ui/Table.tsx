import type { ReactNode } from 'react';
import Image from 'next/image';

export interface ColDef {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
}

export interface TableProps<R> {
  columns: ColDef[];
  rows: R[];
  renderCell: (row: R, key: string) => ReactNode;
  onRowClick?: (row: R) => void;
  keyField: keyof R & string;
  /** Optional 32×48 (2:3) thumbnail at the start of every row. */
  renderThumb?: (row: R) => string | null | undefined;
  /** Optional right-aligned slot at the end of every row. */
  renderActions?: (row: R) => ReactNode;
}

export function Table<R>({
  columns, rows, renderCell, onRowClick, keyField, renderThumb, renderActions,
}: TableProps<R>) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {renderThumb && <th className="table__thumb-col" aria-hidden="true" />}
            {columns.map((col, i) => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  textAlign: col.align ?? (i === columns.length - 1 && !renderActions ? 'right' : 'left'),
                }}
              >
                {col.label}
              </th>
            ))}
            {renderActions && <th className="table__actions-col" aria-hidden="true" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={String(row[keyField])}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); }
              } : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {renderThumb && (
                <td className="table__thumb-col">
                  {(() => {
                    const src = renderThumb(row);
                    return src ? (
                      <Image
                        src={src}
                        alt=""
                        width={32}
                        height={48}
                        sizes="32px"
                        className="table__thumb"
                        style={{ objectFit: 'cover' }}
                        unoptimized={src.startsWith('data:')}
                      />
                    ) : (
                      <div className="table__thumb table__thumb--empty" />
                    );
                  })()}
                </td>
              )}
              {columns.map((col, i) => (
                <td
                  key={col.key}
                  style={{
                    textAlign: col.align ?? (i === columns.length - 1 && !renderActions ? 'right' : 'left'),
                  }}
                >
                  {renderCell(row, col.key)}
                </td>
              ))}
              {renderActions && (
                <td className="table__actions-col" style={{ textAlign: 'right' }}>
                  {renderActions(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
