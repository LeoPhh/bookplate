"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string; // ISO yyyy-mm-dd, or "" for unset
  onChange: (value: string) => void;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseISO(value: string): { y: number; m: number; d: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return { y: Number(value.slice(0, 4)), m: Number(value.slice(5, 7)) - 1, d: Number(value.slice(8, 10)) };
}

export default function DatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const now = new Date();
  const [view, setView] = useState({
    y: selected?.y ?? now.getFullYear(),
    m: selected?.m ?? now.getMonth(),
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    // Capture phase + stopPropagation so Escape closes only the calendar,
    // not the surrounding form dialog (which listens on window).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      const s = parseISO(value);
      setView({ y: s?.y ?? now.getFullYear(), m: s?.m ?? now.getMonth() });
    }
    setOpen(!open);
  };

  const moveMonth = (delta: number) =>
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });

  const moveYear = (delta: number) => setView((v) => ({ ...v, y: v.y + delta }));

  const pick = (d: number) => {
    onChange(toISO(view.y, view.m, d));
    setOpen(false);
  };

  const firstWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const isToday = (d: number) =>
    view.y === now.getFullYear() && view.m === now.getMonth() && d === now.getDate();
  const isSelected = (d: number) => !!selected && view.y === selected.y && view.m === selected.m && d === selected.d;

  const label = value
    ? new Date(value + "T00:00:00").toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Not set";

  return (
    <div className="datepicker" ref={rootRef}>
      <button type="button" className="datepicker-toggle" onClick={toggle} aria-expanded={open}>
        <span className={value ? undefined : "datepicker-placeholder"}>{label}</span>
        <span className="datepicker-caret">▾</span>
      </button>
      {open && (
        <div className="datepicker-pop" role="dialog" aria-label="Choose a date">
          <div className="datepicker-head">
            <button type="button" className="datepicker-nav" onClick={() => moveYear(-1)} aria-label="Previous year">
              «
            </button>
            <button type="button" className="datepicker-nav" onClick={() => moveMonth(-1)} aria-label="Previous month">
              ‹
            </button>
            <span className="datepicker-month">
              {MONTHS[view.m]} {view.y}
            </span>
            <button type="button" className="datepicker-nav" onClick={() => moveMonth(1)} aria-label="Next month">
              ›
            </button>
            <button type="button" className="datepicker-nav" onClick={() => moveYear(1)} aria-label="Next year">
              »
            </button>
          </div>
          <div className="datepicker-grid">
            {WEEKDAYS.map((w) => (
              <span key={w} className="datepicker-wd">
                {w}
              </span>
            ))}
            {Array.from({ length: firstWeekday }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const cls = [
                "datepicker-day",
                isSelected(d) ? "datepicker-day--selected" : "",
                isToday(d) ? "datepicker-day--today" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button key={d} type="button" className={cls} onClick={() => pick(d)}>
                  {d}
                </button>
              );
            })}
          </div>
          <div className="datepicker-foot">
            <button
              type="button"
              className="datepicker-link"
              onClick={() => {
                onChange(toISO(now.getFullYear(), now.getMonth(), now.getDate()));
                setOpen(false);
              }}
            >
              Today
            </button>
            <button
              type="button"
              className="datepicker-link"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
