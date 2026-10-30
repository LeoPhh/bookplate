// Angular line icons on a 32px grid, before each card's title on a profile, as
// on the landing page's cards.
const ICONS = {
  // An open book.
  open: (
    <>
      <path d="M16 8 C12 4 7 4 3 5 V26 C7 25 12 25 16 29 C20 25 25 25 29 26 V5 C25 4 20 4 16 8 Z" />
      <path d="M16 8 V29" />
    </>
  ),
  // A target, square.
  target: (
    <>
      <path d="M4 4 H28 V28 H4 Z" />
      <path d="M10 10 H22 V22 H10 Z" />
      <path d="M15 15 H17 V17 H15 Z" />
    </>
  ),
  // A page with its corner turned, and lines of text.
  page: (
    <>
      <path d="M7 3 H20 L26 9 V29 H7 Z" />
      <path d="M20 3 V9 H26" />
      <path d="M11 15 H22" />
      <path d="M11 20 H22" />
      <path d="M11 25 H17" />
    </>
  ),
  // A five-pointed star.
  star: <path d="M16 3 L19.8 11.6 L29 12.4 L22 18.6 L24.1 27.8 L16 23 L7.9 27.8 L10 18.6 L3 12.4 L12.2 11.6 Z" />,
  // Books standing on a shelf.
  shelf: (
    <>
      <path d="M3 28 H29" />
      <path d="M6 28 V8 H11 V28" />
      <path d="M11 28 V4 H17 V28" />
      <path d="M20 28 L18 9 L23 8.5 L26 28" />
    </>
  ),
  // Two readers, side by side.
  friends: (
    <>
      <path d="M7 5 H14 V12 H7 Z" />
      <path d="M3 28 V20 L6 16 H15 L18 20 V28" />
      <path d="M19 8 H25 V14 H19 Z" />
      <path d="M21 18 H26 L29 22 V28 H22" />
    </>
  ),
  crown: (
    <>
      <path d="M4 25 L3 8 L10 14 L16 5 L22 14 L29 8 L28 25 Z" />
      <path d="M4 29 H28" />
    </>
  ),
  // A thick book.
  brick: (
    <>
      <path d="M5 6 H24 L27 9 V28 H8 L5 25 Z" />
      <path d="M8 28 V9 H27" />
      <path d="M5 6 L8 9" />
      <path d="M13 15 H22" />
    </>
  ),
  flame: (
    <>
      <path d="M16 3 L22 11 L25 8 L27 18 L23 27 L16 29 L9 27 L5 18 L9 11 L12 14 Z" />
      <path d="M16 17 L19 22 L16 26 L13 22 Z" />
    </>
  ),
  // A padlock.
  lock: (
    <>
      <path d="M6 14 H26 V29 H6 Z" />
      <path d="M10 14 V9 L13 4 H19 L22 9 V14" />
      <path d="M16 19 V24" />
    </>
  ),
  // Two shelves overlapping: what you have in common.
  taste: (
    <>
      <path d="M3 9 H19 V25 H3 Z" />
      <path d="M13 6 H29 V22 H13" />
    </>
  ),
};

export type ProfileIconName = keyof typeof ICONS;

export default function ProfileIcon({ name }: { name: ProfileIconName }) {
  return (
    <svg className="profile-icon" viewBox="0 0 32 32" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
