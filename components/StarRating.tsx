"use client";

import { useState } from "react";

interface Props {
  value: number; // 0–5, in 0.5 steps
  onChange?: (value: number) => void; // omit for read-only display
  size?: "sm" | "md" | "lg";
}

const STARS = [1, 2, 3, 4, 5];

// Fill state for star position n given a rating value.
function fillFor(n: number, value: number): "full" | "half" | "empty" {
  if (n <= value) return "full";
  if (n - 0.5 === value) return "half";
  return "empty";
}

export default function StarRating({ value, onChange, size = "md" }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value;

  if (!onChange) {
    return (
      <span
        className={`stars stars--${size}`}
        aria-label={value ? `Rated ${value} of 5` : "Unrated"}
      >
        {STARS.map((n) => {
          const fill = fillFor(n, active);
          return (
            <span
              key={n}
              className={`star${fill === "full" ? " star--on" : ""}${fill === "half" ? " star--half" : ""}`}
            >
              <span className="star-glyph" aria-hidden="true">
                ★
              </span>
            </span>
          );
        })}
      </span>
    );
  }

  return (
    <span
      className={`stars stars--${size} stars--input`}
      role="radiogroup"
      aria-label="Rating"
      onPointerLeave={() => setHover(null)}
    >
      {STARS.map((n) => {
        const fill = fillFor(n, active);
        return (
          <span
            key={n}
            className={`star star--zone${fill === "full" ? " star--on" : ""}${fill === "half" ? " star--half" : ""}`}
          >
            <span className="star-glyph" aria-hidden="true">
              ★
            </span>
            <button
              type="button"
              role="radio"
              aria-checked={value === n - 0.5}
              aria-label={`${n - 0.5} star${n - 0.5 > 1 ? "s" : ""}`}
              className="star-half"
              onClick={() => onChange(value === n - 0.5 ? 0 : n - 0.5)}
              onPointerEnter={() => setHover(n - 0.5)}
            />
            <button
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              className="star-full"
              onClick={() => onChange(value === n ? 0 : n)}
              onPointerEnter={() => setHover(n)}
            />
          </span>
        );
      })}
    </span>
  );
}
