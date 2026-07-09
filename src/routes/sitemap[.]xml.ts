import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = process.env.VITE_PUBLIC_URL ?? "https://obstetrica.com.br";

const entries = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/sobre", priority: "0.9", changefreq: "monthly" },
  { path: "/agendamento", priority: "0.9", changefreq: "weekly" },
  { path: "/empresas", priority: "0.8", changefreq: "monthly" },
  { path: "/gestacao", priority: "0.8", changefreq: "monthly" },
  { path: "/calculadora", priority: "0.8", changefreq: "monthly" },
  { path: "/dpp", priority: "0.8", changefreq: "monthly" },
  { path: "/batimentos", priority: "0.7", changefreq: "monthly" },
  { path: "/hospitais", priority: "0.7", changefreq: "monthly" },
  { path: "/lives", priority: "0.7", changefreq: "weekly" },
  { path: "/bastidores", priority: "0.7", changefreq: "monthly" },
  { path: "/depoimentos", priority: "0.7", changefreq: "monthly" },
  { path: "/mural", priority: "0.6", changefreq: "weekly" },
  { path: "/mitos", priority: "0.6", changefreq: "monthly" },
  { path: "/modo-acompanhante", priority: "0.6", changefreq: "monthly" },
  { path: "/primeira-consulta", priority: "0.6", changefreq: "monthly" },
  { path: "/tamanho-real", priority: "0.5", changefreq: "monthly" },
  { path: "/cards", priority: "0.5", changefreq: "monthly" },
  { path: "/auth", priority: "0.5", changefreq: "yearly" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date().toISOString().split("T")[0];
        const urls = entries
          .map(
            (e) =>
              `  <url>\n    <loc>${BASE_URL}${e.path}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
          )
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
