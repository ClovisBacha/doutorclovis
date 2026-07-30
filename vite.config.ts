// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Build for Vercel (Nitro vercel preset). Override the Lovable defaults so the
  // output matches Vercel's Build Output API layout (.vercel/output), which Vercel
  // auto-detects: config.json + static/ + functions/__server.func/.
  nitro: {
    preset: "vercel",
    output: {
      dir: ".vercel/output",
      publicDir: ".vercel/output/static",
      serverDir: ".vercel/output/functions/__server.func",
    },
    /* Teto de execução da função de servidor.
    
       Precisa ser AQUI e não em `vercel.json`: com a Build Output API a Vercel
       lê `functions/__server.func/.vc-config.json`, e a chave `functions` do
       vercel.json não casa com nada — o deploy falha com erro de padrão que não
       corresponde a nenhuma função. (Foi o que aconteceu: build local verde,
       deploy vermelho.) O preset vercel do Nitro escreve este valor no
       .vc-config.json.
    
       30s porque o disparo do SOS é sequencial e pode falar com cinco serviços
       externos (push, e-mail do médico, e-mail do contato, WhatsApp Cloud e um
       webhook de SMS configurado pelo usuário). No teto padrão de 10s a função
       era cortada no meio: o médico já tinha recebido push e e-mail, e a tela
       dizia "não consegui avisar — ligue 192". */
    vercel: {
      functions: {
        maxDuration: 30,
      },
    },
  },
});
