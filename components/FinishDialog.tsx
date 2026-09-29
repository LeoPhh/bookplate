"use client";

import { useEffect, useState } from "react";
import { Book } from "@/lib/types";
import DatePicker from "./DatePicker";
import StarRating from "./StarRating";

interface Props {
  book: Book;
  onConfirm: (dateRead: string, rating: number) => void;
  onCancel: () => void;
}

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function FinishDialog({ book, onConfirm, onCancel }: Props) {
  const [dateRead, setDateRead] = useState<string>(book.dateRead ?? todayISO());
  const [rating, setRating] = useState<number>(book.rating ?? 0);

  useEffect(() => {
    // Capture phase + stopPropagation so Escape dismisses only this prompt,
    // not the book detail dialog underneath (which listens on window).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="overlay overlay--top" onClick={onCancel}>
      <div
        className="dialog dialog--confirm dialog--finish"
        role="dialog"
        aria-modal="true"
        aria-label="Finished reading"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="confirm-ornament">❦</p>
        <h2 className="confirm-title">Finished reading</h2>
        <p className="confirm-message">Mark “{book.title}” as read.</p>
        <div className="finish-fields">
          <div className="field">
            <span>Date finished</span>
            <DatePicker value={dateRead} onChange={setDateRead} />
          </div>
          <div className="field">
            <span>Rating</span>
            <StarRating value={rating} onChange={setRating} size="lg" />
          </div>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn--primary" onClick={() => onConfirm(dateRead, rating)} autoFocus>
            Mark as read
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
