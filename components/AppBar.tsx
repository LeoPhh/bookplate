import Link from "next/link";
import AppNav from "./AppNav";
import LogoMark from "./LogoMark";
import UserMenu from "./UserMenu";

// The bar across the top of every page: the mark, and when signed in the
// app's sections and the account menu. The mark links to the Library.
export default function AppBar({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="appbar">
      <div className="appbar-inner">
        <Link href="/" className="appbar-logo" aria-label="Bookplate: Library">
          <LogoMark />
        </Link>
        {signedIn && (
          <>
            <AppNav />
            <UserMenu />
          </>
        )}
      </div>
    </header>
  );
}
