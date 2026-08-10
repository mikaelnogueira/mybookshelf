import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyBookshelf",
    short_name: "Bookshelf",
    description: "Sua biblioteca e sua história de leitura, sempre com você.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0d0d",
    theme_color: "#c7f36b",
    lang: "pt-BR",
    categories: ["books", "lifestyle", "productivity"],
  };
}
