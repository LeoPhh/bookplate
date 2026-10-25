"use client";

import { useRef, useState } from "react";
import { BookStatus } from "@/lib/types";
import FilterDialog from "./FilterDialog";

export type StatusFilter = BookStatus | "all";

interface Props {
  query: string;
  onQuery: (q: string) => void;
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  showNotes: boolean;
  onShowNotes: (v: boolean) => void;
  counts: Record<StatusFilter, number>;
  onAdd: () => void;
}

export default function Toolbar({ query, onQuery, status, onStatus, showNotes, onShowNotes, counts, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // How many filters are on, for the badge on the button.
  const active = Number(status !== "all") + Number(showNotes);

  // Focus goes back to the button the dialog was opened from.
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="toolbar">
      <div className="toolbar-row">
        <input
          type="search"
          className="search"
          placeholder="Search titles, authors, notes…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <button
          ref={buttonRef}
          type="button"
          className="filter-btn"
          aria-haspopup="dialog"
          aria-label={active ? `Filter, ${active} on` : "Filter"}
          onClick={() => setOpen(true)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1.5 2.5h13l-5 6v5l-3 1.5v-6.5z" />
          </svg>
          Filter
          {active > 0 && (
            <span className="filter-badge" aria-hidden="true">
              {active}
            </span>
          )}
        </button>
        <button type="button" className="btn btn--primary" onClick={onAdd}>
          + Add book
        </button>
      </div>
      {open && (
        <FilterDialog
          status={status}
          showNotes={showNotes}
          counts={counts}
          onApply={(s, notes) => {
            onStatus(s);
            onShowNotes(notes);
            close();
          }}
          onClose={close}
        />
      )}
    </div>
  );
}
