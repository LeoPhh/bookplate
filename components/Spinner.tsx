// The loading animation: three small squares blinking in turn, in the colour
// of the text around it (so white on a dark button). Decorative: whatever it
// sits beside says what's happening ("Saving…"). Shown still to people who
// ask their system for less motion.
export default function Spinner({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? "spinner spinner--lg" : "spinner"} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
