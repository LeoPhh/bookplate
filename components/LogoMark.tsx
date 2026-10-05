// The Bookplate mark (the book stack with the orange book leaning on the "b"),
// as in the landing page's top bar. Styled by the .appbar-* rules.
export default function LogoMark() {
  return (
    <svg className="appbar-mark" viewBox="2 3.8 27.5 25.8" aria-hidden="true">
      <rect
        rx="0.5"
        className="appbar-ink"
        x="2"
        y="26.3"
        width="27.5"
        height="3.3"
      />
      <rect
        rx="0.5"
        className="appbar-ink"
        x="5.2"
        y="23.4"
        width="21"
        height="2.5"
      />
      <rect
        rx="0.5"
        className="appbar-ink"
        x="3.4"
        y="20.2"
        width="24.4"
        height="2.8"
      />
      <rect
        className="appbar-title"
        x="5.3"
        y="27.65"
        width="9.35"
        height="0.45"
      />
      <rect
        className="appbar-title"
        x="15.7"
        y="24.35"
        width="6.3"
        height="0.4"
      />
      <rect
        className="appbar-title"
        x="8.768"
        y="21.3"
        width="9.76"
        height="0.4"
      />
      <g transform="rotate(17 11.921 20.51)">
        <rect
          rx="0.5"
          fill="#ff3b1f"
          className="appbar-outline"
          strokeWidth="1.5"
          x="7.07"
          y="7.46"
          width="4.1"
          height="12.3"
        />
      </g>
      <path
        className="appbar-ink"
        transform="translate(14.2 20.2) scale(0.0108 -0.0108)"
        d="M513.1 1422.2V81.5L356.7 15.1Q281.9 -10 251.8 -17.7Q221.7 -25.4 194.7 -25.4Q164.3 -25.4 145.3 -8.2Q126.4 9 126.4 42.7V1213.6Q126.4 1244.1 118 1256.5Q109.7 1269 92.6 1273.5L63 1279.9Q42.6 1286.2 33.9 1297.7Q25.3 1309.3 25.3 1328Q25.3 1349.2 37 1362.3Q48.8 1375.4 81.7 1387.5L297.7 1469.8Q347.3 1488.4 376 1496.3Q404.6 1504.2 426 1504.2Q469.6 1504.2 491.4 1481.1Q513.1 1457.9 513.1 1422.2ZM444.2 634.6 380.4 699.3Q464 833.5 569.3 910.1Q674.6 986.6 808.8 986.6Q927.6 986.6 1020.9 925.7Q1114.2 864.8 1168.5 758Q1222.8 651.2 1222.8 510.8Q1222.8 348.6 1157.1 227.8Q1091.3 107 977.5 39.9Q863.7 -27.2 720.3 -27.2Q600.6 -27.2 510.5 25Q420.4 77.3 356.7 181.9L454.1 250.2Q500.1 181.1 545.8 150.4Q591.5 119.6 645.3 119.6Q697.7 119.6 737.8 155.2Q777.9 190.8 800.2 268.5Q822.6 346.2 822.6 470.9Q822.6 586.3 799.6 658Q776.7 729.7 737.3 763.6Q698 797.5 647.6 797.5Q588.2 797.5 537.8 758.4Q487.4 719.4 444.2 634.6Z"
      />
    </svg>
  );
}
