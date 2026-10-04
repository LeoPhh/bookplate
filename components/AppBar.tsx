import AppNav from "./AppNav";
import LogoMark from "./LogoMark";
import UserMenu from "./UserMenu";

// The bar across the top of every page: the mark, and when signed in the
// app's sections and the account menu. The mark isn't a link: everything here
// stays inside the app.
export default function AppBar({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="appbar">
      <div className="appbar-inner">
        <span className="appbar-logo" role="img" aria-label="Bookplate">
          <LogoMark />
        </span>
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
