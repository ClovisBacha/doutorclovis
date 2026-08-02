import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * Régua do aparelho — o que o iOS realmente reporta dentro do app instalado.
 *
 * Existe porque as metas estarem certas não garante o resultado. O app declara
 * `viewport-fit=cover` e `apple-mobile-web-app-status-bar-style:
 * black-translucent`, e mesmo assim o app instalado mostra uma faixa clara
 * acima do céu e os ícones do topo caem baixo demais — enquanto no Safari, com
 * as MESMAS metas, está certo.
 *
 * A diferença mora em números que só existem naquele aparelho, naquele modo:
 * `env(safe-area-inset-*)`, `display-mode`, `navigator.standalone`, e a altura
 * que o navegador considera "a tela". Sem eles, qualquer conserto é chute — e
 * chute em layout costuma consertar num aparelho e quebrar em três.
 *
 * O `noindex` acompanha o `Disallow: /preview-` do robots.txt.
 */
export const Route = createFileRoute("/preview-regua")({
  component: Regua,
  head: () => ({
    meta: [{ title: "Régua do aparelho" }, { name: "robots", content: "noindex" }],
  }),
});

type Linha = { rotulo: string; valor: string; alerta?: boolean };

function Regua() {
  const [linhas, setLinhas] = useState<Linha[]>([]);

  useEffect(() => {
    const medir = () => {
      const sonda = document.createElement("div");
      sonda.style.cssText = [
        "position:fixed",
        "top:0",
        "left:0",
        "visibility:hidden",
        "padding-top:env(safe-area-inset-top,0px)",
        "padding-bottom:env(safe-area-inset-bottom,0px)",
        "padding-left:env(safe-area-inset-left,0px)",
        "padding-right:env(safe-area-inset-right,0px)",
      ].join(";");
      document.body.append(sonda);
      const cs = getComputedStyle(sonda);
      const insets = {
        topo: cs.paddingTop,
        base: cs.paddingBottom,
        esq: cs.paddingLeft,
        dir: cs.paddingRight,
      };
      sonda.remove();

      const modo =
        (["standalone", "fullscreen", "minimal-ui", "browser"] as const).find(
          (m) => window.matchMedia(`(display-mode: ${m})`).matches,
        ) ?? "?";
      const nav = navigator as unknown as { standalone?: boolean };

      /* `100svh` contra `innerHeight` é o que revela se a página desenha sob a
         barra de status ou se o iOS a recuou para baixo dela. */
      const svh = document.createElement("div");
      svh.style.cssText = "position:fixed;top:0;height:100svh;visibility:hidden";
      document.body.append(svh);
      const alturaSvh = svh.getBoundingClientRect().height;
      svh.remove();

      const fundoRaiz = getComputedStyle(document.documentElement).backgroundColor;
      const fundoCorpo = getComputedStyle(document.body).backgroundColor;

      setLinhas([
        { rotulo: "display-mode", valor: modo, alerta: modo !== "standalone" },
        { rotulo: "navigator.standalone", valor: String(nav.standalone ?? "—") },
        {
          rotulo: "safe-area TOPO",
          valor: insets.topo,
          alerta: insets.topo === "0px",
        },
        { rotulo: "safe-area BASE", valor: insets.base, alerta: insets.base === "0px" },
        { rotulo: "safe-area esq/dir", valor: `${insets.esq} / ${insets.dir}` },
        { rotulo: "innerHeight", valor: `${window.innerHeight}px` },
        { rotulo: "100svh", valor: `${Math.round(alturaSvh)}px` },
        {
          rotulo: "svh − innerHeight",
          valor: `${Math.round(alturaSvh - window.innerHeight)}px`,
          alerta: Math.abs(alturaSvh - window.innerHeight) > 1,
        },
        { rotulo: "screen.height", valor: `${window.screen.height}px` },
        { rotulo: "devicePixelRatio", valor: String(window.devicePixelRatio) },
        { rotulo: "fundo do <html>", valor: fundoRaiz },
        { rotulo: "fundo do <body>", valor: fundoCorpo },
        { rotulo: "visualViewport.offsetTop", valor: `${window.visualViewport?.offsetTop ?? "—"}` },
      ]);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Faixa de referência: pintada em MAGENTA no topo absoluto da página,
          com a altura exata do inset. Se aparecer faixa clara ACIMA dela, a
          página não está desenhando sob a barra de status. Se o magenta ficar
          escondido atrás do relógio, está. */}
      <div
        className="fixed left-0 right-0 top-0 z-50 bg-fuchsia-500"
        style={{ height: "env(safe-area-inset-top, 0px)" }}
      />
      <div
        className="px-5 py-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top,0px) + 1rem)" }}
      >
        <h1 className="text-lg font-bold">Régua do aparelho</h1>
        <p className="mt-1 text-xs text-slate-400">
          A faixa magenta no topo tem a altura do <code>safe-area-inset-top</code>. Tire um print
          desta tela DENTRO do app instalado.
        </p>
        <dl className="mt-5 divide-y divide-slate-700 rounded-2xl bg-slate-800/70">
          {linhas.map((l) => (
            <div key={l.rotulo} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
              <dt className="text-xs text-slate-400">{l.rotulo}</dt>
              <dd
                className={`font-mono text-sm tabular-nums ${l.alerta ? "text-amber-400" : "text-slate-100"}`}
              >
                {l.valor}
              </dd>
            </div>
          ))}
        </dl>
        {/* Régua de 10 em 10px a partir do topo REAL da página, para medir no
            print onde cada coisa caiu sem depender de eu adivinhar a escala. */}
        <div className="relative mt-6 h-48 rounded-2xl bg-slate-800/70">
          <p className="px-4 pt-3 text-xs text-slate-400">Régua a partir do topo desta caixa</p>
          {Array.from({ length: 9 }, (_, i) => (i + 1) * 20).map((y) => (
            <div
              key={y}
              className="absolute left-0 right-0 flex items-center gap-2"
              style={{ top: y }}
            >
              <span className="h-px flex-1 bg-slate-600" />
              <span className="pr-3 font-mono text-[10px] text-slate-500">{y}px</span>
            </div>
          ))}
        </div>
      </div>
      <div
        className="fixed bottom-0 left-0 right-0 bg-cyan-500"
        style={{ height: "env(safe-area-inset-bottom, 0px)" }}
      />
    </div>
  );
}
