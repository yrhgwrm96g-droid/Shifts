export default function manifest() {
  return {
    name: "Shift Swap",
    short_name: "Shifts",
    description: "Give away and swap shifts with your colleagues",
    start_url: "/schedule",
    display: "standalone",
    background_color: "#10151f",
    theme_color: "#10151f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
