import type { MetadataRoute } from "next";

// Lets the library be added to a phone's home screen and open full-screen,
// without browser chrome. Icons are app/icon.svg rendered square.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bookplate",
    short_name: "Bookplate",
    description: "A personal library of every book read, reading, and awaiting.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f2ec",
    theme_color: "#f4f2ec",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
