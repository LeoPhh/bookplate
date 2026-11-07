import Link from "next/link";
import AppNav, { AppMenu } from "./AppNav";
import LogoMark from "./LogoMark";
import NotificationBell from "./NotificationBell";
import UserMenu, { type AccountPicture } from "./UserMenu";

// The bar across the top of every page: the mark, and when signed in the
// app's sections, the notification bell (with social features) and the account
// menu. The mark links to the Library.
export default function AppBar({
  signedIn,
  social,
  me,
}: {
  signedIn: boolean;
  social: { unread: number } | null;
  me: AccountPicture | null;
}) {
  return (
    <header className="appbar">
      <div className="appbar-inner">
        <Link href="/" className="appbar-logo" aria-label="Bookplate: Library">
          <LogoMark />
        </Link>
        {signedIn && (
          <>
            <AppNav social={social !== null} />
            <div className="appbar-account">
              {social && <NotificationBell initial={social.unread} />}
              <AppMenu social={social !== null} />
              <UserMenu initial={me} social={social !== null} />
            </div>
          </>
        )}
      </div>
    </header>
  );
}
