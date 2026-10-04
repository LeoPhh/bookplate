// The Bookplate mark (the book stack with the orange book leaning on the "b"),
// as in the landing page's top bar. Styled by the .sitebar-* rules.
export default function LogoMark() {
  return (
    <svg className="sitebar-mark" viewBox="2 3.8 27.5 25.8" aria-hidden="true">
      <rect className="sitebar-ink" x="2" y="26.4" width="27.5" height="3.2" />
      <rect className="sitebar-ink" x="5.2" y="23.55" width="21" height="2.3" />
      <rect
        className="sitebar-ink"
        x="3.4"
        y="20.2"
        width="24.4"
        height="2.8"
      />
      <rect
        className="sitebar-title"
        x="5.3"
        y="27.7"
        width="9.35"
        height="0.6"
      />
      <rect
        className="sitebar-title"
        x="15.7"
        y="24.4"
        width="6.3"
        height="0.6"
      />
      <rect
        className="sitebar-title"
        x="8.768"
        y="21.3"
        width="9.76"
        height="0.6"
      />
      <g transform="rotate(17 10.481 20.2)">
        <rect
          fill="#ff3b1f"
          className="sitebar-outline"
          strokeWidth="1.5"
          x="5.631"
          y="6.35"
          width="4.1"
          height="13.1"
        />
      </g>
      <path
        className="sitebar-ink"
        transform="translate(14.6 20.2) scale(0.226)"
        d="M19.90-47.90Q25.60-54 34.70-54L34.70-54Q45.40-54 51.20-47.05Q57-40.10 57-26.50L57-26.50Q57-12.80 51.20-5.80Q45.40 1.20 34.70 1.20L34.70 1.20Q23.70 1.20 17.90-7.50L17.90-7.50L16.20 0L0 0L0-72.50L19.90-72.50L19.90-47.90ZM28.50-39.30Q24.10-39.30 21.90-36.15Q19.70-33 19.70-28L19.70-28L19.70-24.70Q19.70-19.70 21.90-16.60Q24.10-13.50 28.50-13.50L28.50-13.50Q37.10-13.50 37.10-23.70L37.10-23.70L37.10-29Q37.10-39.30 28.50-39.30L28.50-39.30Z"
      />
    </svg>
  );
}
