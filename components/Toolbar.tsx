"use client";

import { BookStatus, STATUS_LABELS } from "@/lib/types";

export type ViewMode = "covers" | "list";
export type StatusFilter = BookStatus | "all";

const VIEW_LABELS: Record<ViewMode, string> = {
  covers: "Covers",
  list: "Ledger",
};

interface Props {
  view: ViewMode;
  onView: (v: ViewMode) => void;
  query: string;
  onQuery: (q: string) => void;
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  showNotes: boolean;
  onShowNotes: (v: boolean) => void;
  onAdd: () => void;
}

export default function Toolbar({
  view,
  onView,
  query,
  onQuery,
  status,
  onStatus,
  showNotes,
  onShowNotes,
  onAdd,
}: Props) {
  const statuses: StatusFilter[] = ["all", "read", "reading", "to-read", "dnf"];

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
        <div className="view-toggle" role="tablist" aria-label="View">
          {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={view === v ? "view-btn view-btn--active" : "view-btn"}
              onClick={() => onView(v)}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn--primary" onClick={onAdd}>
          + Add book
        </button>
      </div>
      <div className="toolbar-row toolbar-row--chips">
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            className={status === s ? "chip chip--active" : "chip"}
            onClick={() => onStatus(s)}
          >
            {s === "all" ? "All" : STATUS_LABELS[s]}
          </button>
        ))}
        <button
          type="button"
          className={showNotes ? "chip chip--notes chip--notes-active" : "chip chip--notes"}
          aria-pressed={showNotes}
          onClick={() => onShowNotes(!showNotes)}
        >
          Show notes
        </button>
      </div>
    </div>
  );
}
