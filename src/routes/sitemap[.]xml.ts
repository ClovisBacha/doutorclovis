import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "";
const entries = [
  { path: "/", priority: "1.0" },
  { path: "/sobre", priority: "0.8" },
  { path: "/bastidores", priority: "0.8" },
  { path: "/depoimentos", priority: "0.7" },
  { path: "/agendamento", priority: "0.9" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = entries
          .map((e) => `  <url>\n    <loc>${BASE_URL}${e.path}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`)
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml" } });
      },
    },
  },
});