import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trade82",
    short_name: "Trade82",
    description:
      "Trade82 connects Korean sellers with trusted American buyers and trade-ready product information.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8faf9",
    theme_color: "#f8faf9",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
