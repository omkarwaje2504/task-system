import type { MetadataRoute } from "next";

// "Add to Home Screen": opens full-screen like an app, dark like the theme.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Task System",
    short_name: "Task System",
    description: "Projects, tasks and design assets for the studio team.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
