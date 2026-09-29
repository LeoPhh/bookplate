import { createAuthClient } from "better-auth/react";

// Same-origin, so no baseURL is needed.
export const authClient = createAuthClient();
