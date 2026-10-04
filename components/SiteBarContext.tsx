"use client";

import { createContext, useContext, type ReactNode } from "react";

// Whether the site bar (components/SiteBar.tsx) is showing. When it is, the
// account menu lives in the bar, so pages leave it out of their masthead.
const SiteBarContext = createContext(false);

export function SiteBarProvider({ on, children }: { on: boolean; children: ReactNode }) {
  return <SiteBarContext.Provider value={on}>{children}</SiteBarContext.Provider>;
}

export const useSiteBar = () => useContext(SiteBarContext);
