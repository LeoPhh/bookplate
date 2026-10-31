// The friends page's tabs, for the page to open the one a link asks for.
export const FRIENDS_TABS = ["friends", "requests", "recommendations"] as const;
export type FriendsTab = (typeof FRIENDS_TABS)[number];
