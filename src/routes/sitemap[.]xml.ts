import { createFileRoute } from "@tanstack/react-router";
import { DOCTOR } from "@/lib/doctor.config";

// Domínio canônico (www — o não-www faz 308 para cá). Fonte única: doctor.config.
const BASE_URL = process.env.VITE_PUBLIC_URL ?? DOCTOR.siteUrl;

// Só páginas PÚBLICAS e indexáveis. Fora: /auth, /painel, /minha-conta, /api,
// /medicos/cadastro e as rotas com token (links pessoais).
const entries = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/sobre", priority: "0.9", changefreq: "monthly" },
  { path: "/medicos", priority: "0.9", changefreq: "weekly" },
  { path: "/encontrar-medico", priority: "0.9", changefreq: "weekly" },
  { path: "/agendamento", priority: "0.8", changefreq: "weekly" },
  { path: "/experiencia", priority: "0.8", changefreq: "monthly" },
  { path: "/empresas", priority: "0.8", changefreq: "monthly" },
  { path: "/gestacao", priority: "0.8", changefreq: "monthly" },
  { path: "/calculadora", priority: "0.8", changefreq: "monthly" },
  { path: "/dpp", priority: "0.8", changefreq: "monthly" },
  { path: "/diabetes-gestacional", priority: "0.7", changefreq: "monthly" },
  { path: "/batimentos", priority: "0.7", changefreq: "monthly" },
  { path: "/epds", priority: "0.6", changefreq: "monthly" },
  { path: "/tamanho-real", priority: "0.6", changefreq: "monthly" },
  { path: "/hospitais", priority: "0.6", changefreq: "monthly" },
  { path: "/primeira-consulta", priority: "0.6", changefreq: "monthly" },
  { path: "/modo-acompanhante", priority: "0.6", changefreq: "monthly" },
  { path: "/acompanhante", priority: "0.5", changefreq: "monthly" },
  { path: "/lives", priority: "0.6", changefreq: "weekly" },
  { path: "/mural", priority: "0.6", changefreq: "weekly" },
  { path: "/depoimentos", priority: "0.6", changefreq: "monthly" },
  { path: "/mitos", priority: "0.6", changefreq: "monthly" },
  { path: "/bastidores", priority: "0.5", changefreq: "monthly" },
  { path: "/cards", priority: "0.5", changefreq: "monthly" },
  { path: "/privacidade", priority: "0.3", changefreq: "yearly" },
  { path: "/termos", priority: "0.3", changefreq: "yearly" },
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
