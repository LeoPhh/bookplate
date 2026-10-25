"use client";

import { useEffect, useRef, useState } from "react";
import { STATUS_LABELS } from "@/lib/types";
import type { StatusFilter } from "./Toolbar";

interface Props {
  status: StatusFilter;
  showNotes: boolean;
  counts: Record<StatusFilter, number>; // books per status, within the current search
  onApply: (status: StatusFilter, showNotes: boolean) => void;
  onClose: () => void;
}

const STATUSES: StatusFilter[] = ["all", "read", "reading", "to-read", "dnf"];

// The Library's filters, laid out like a shop's filter panel: choices are
// made in the dialog and only take effect with Apply; closing it
// any other way leaves the shelf as it was.
export default function FilterDialog({ status, showNotes, counts, onApply, onClose }: Props) {
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftNotes, setDraftNotes] = useState(showNotes);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      // Keep Tab inside the dialog while it's open.
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled)"
      );
      // Radios share one tab stop: only the checked one is reachable.
      const stops = [...focusable].filter((el) => !(el instanceof HTMLInputElement && el.type === "radio" && !el.checked));
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const isDefault = draftStatus === "all" && !draftNotes;

  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="dialog dialog--filter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close without applying">
          ✕
        </button>
        <h2 id="filter-title" className="confirm-title">
          Filter
        </h2>

        <fieldset className="filter-group">
          <legend>Status</legend>
          {STATUSES.map((s) => (
            <label key={s} className="checkline filter-option">
              <input
                type="radio"
                className="square-radio"
                name="filter-status"
                value={s}
                checked={draftStatus === s}
                autoFocus={draftStatus === s}
                onChange={() => setDraftStatus(s)}
              />
              <span className="filter-option-label">{s === "all" ? "All books" : STATUS_LABELS[s]}</span>
              <span className="filter-option-count">{counts[s]}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="filter-group">
          <legend>Notes</legend>
          <label className="checkline checkline--wrap filter-option">
            <input
              type="checkbox"
              checked={draftNotes}
              onChange={(e) => setDraftNotes(e.target.checked)}
              aria-describedby="filter-notes-hint"
            />
            <span>
              Show notes
              <span id="filter-notes-hint" className="filter-option-hint">
                A ribbon marks every book you’ve written notes for.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="dialog-actions filter-actions">
          <button
            type="button"
            className="btn"
            disabled={isDefault}
            onClick={() => {
              setDraftStatus("all");
              setDraftNotes(false);
            }}
          >
            Clear all
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onApply(draftStatus, draftNotes)}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
