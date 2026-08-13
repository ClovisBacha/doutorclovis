/**
 * O TOCADOR DA HISTÓRIA PARA DORMIR.
 *
 * ─── COMO ELE TOCA ──────────────────────────────────────────────────────────
 *
 * Bloco, silêncio, bloco, silêncio — e o silêncio CRESCE (ver `pausaDepoisDo`).
 * É isso que faz a voz ir se afastando, e é a diferença entre uma história para
 * dormir e um audiolivro lido devagar. O arquivo de cada bloco é buscado
 * enquanto o anterior ainda toca, então a rede nunca aparece como espera.
 *
 * ─── A TELA APAGA SOZINHA ───────────────────────────────────────────────────
 *
 * Vinte segundos sem toque e a tela escurece até quase o preto. É recurso do
 * Calm e é o certo: a coisa mais acordadora do quarto é a luz do celular na
 * cara de quem está tentando dormir. Qualquer toque traz de volta.
 *
 * ─── E ELA NÃO TERMINA EM SILÊNCIO ──────────────────────────────────────────
 *
 * Quando o último bloco acaba, o som contínuo entra no lugar da voz (chuva, por
 * padrão) com o temporizador que ela escolheu. Uma história de onze minutos que
 * simplesmente PARA deixa o quarto mudo de repente — e quem ainda estava
 * acordada aos dez acorda de vez aos onze.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { pausaDepoisDo, type Historia } from "@/lib/historias-para-dormir";
import { faixaDoBloco } from "@/lib/voz-da-noite";
import { anunciarMidia, estadoDaMidia } from "@/lib/media-session";

/**
 * ⚠️ A NARRAÇÃO TOCA A 0,92×.
 *
 * A Isabella lê a ~150 palavras por minuto, que é o ritmo certo para uma deixa
 * de meditação e rápido demais para uma história de dormir — o gênero vive
 * entre 100 e 130. `preservesPitch` mantém a voz dela; sem isso ela desceria de
 * tom e viraria outra pessoa.
 */
const RITMO = 0.92;

/** Estrelas fixas, com posição determinística — `Math.random()` daria
 *  desencontro de hidratação no SSR, o mesmo motivo do céu da home. */
const ESTRELAS = (() => {
  let s = 20260813;
  const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  return Array.from({ length: 40 }, () => ({
    x: +(r() * 100).toFixed(2),
    y: +(r() * 60).toFixed(2),
    o: +(0.15 + r() * 0.5).toFixed(2),
    d: +(r() * 4).toFixed(2),
  }));
})();

export function HistoriaDaNoite({
  historia,
  aoTerminar,
  aoSair,
}: {
  historia: Historia;
  /** Chamado quando o último bloco acaba — a tela mãe entrega o som contínuo. */
  aoTerminar: () => void;
  aoSair: () => void;
}) {
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [escuro, setEscuro] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const proximoRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vivoRef = useRef(true);

  const total = historia.blocos.length;
  const bloco = historia.blocos[i];

  useEffect(() => {
    vivoRef.current = true;
    return () => {
      vivoRef.current = false;
    };
  }, []);

  const limpar = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
      a.remove();
    }
    audioRef.current = null;
    proximoRef.current = null;
  }, []);

  useEffect(() => () => limpar(), [limpar]);

  /* Toca o bloco atual e agenda o próximo. Um efeito só: o encadeamento é a
     coisa toda, e dividi-lo em dois faria a pausa e a fala terem relógios
     diferentes. */
  useEffect(() => {
    if (pausado) return;
    const faixa = faixaDoBloco(bloco.id);
    /* Sem arquivo, a história pula o trecho em silêncio em vez de travar. */
    const espera = faixa ? 0 : 1000;

    const seguir = () => {
      if (!vivoRef.current) return;
      const pausa = pausaDepoisDo(i, total) * 1000;
      timerRef.current = setTimeout(() => {
        if (!vivoRef.current) return;
        if (i + 1 >= total) aoTerminar();
        else setI(i + 1);
      }, pausa);
    };

    if (!faixa) {
      timerRef.current = setTimeout(seguir, espera);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    /* Reaproveita o elemento já criado pelo bloco anterior (ele foi buscado
       durante a fala anterior); só o primeiro nasce aqui. */
    const a = proximoRef.current ?? new Audio(faixa);
    proximoRef.current = null;
    a.src = faixa;
    a.playbackRate = RITMO;
    (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    a.setAttribute("playsinline", "");
    a.style.display = "none";
    if (typeof document !== "undefined" && !a.isConnected) document.body.appendChild(a);
    audioRef.current = a;
    a.addEventListener("ended", seguir, { once: true });
    void a.play().catch(() => seguir());

    /* O próximo bloco é buscado agora, enquanto este fala: assim a pausa é
       silêncio de propósito, e nunca espera de rede. */
    const prox = historia.blocos[i + 1];
    const faixaProx = prox ? faixaDoBloco(prox.id) : null;
    if (faixaProx) {
      const b = new Audio();
      b.preload = "auto";
      b.src = faixaProx;
      proximoRef.current = b;
    }

    return () => {
      a.removeEventListener("ended", seguir);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, pausado]);

  /**
   * A TELA ESCURECE SOZINHA, e qualquer toque acende de novo.
   *
   * O relógio mora num `ref` porque o toque precisa REARMÁ-LO: sem isso, o
   * primeiro toque acenderia a tela para sempre — e a luz do celular na cara é
   * a coisa mais acordadora que existe num quarto escuro.
   */
  const apagarRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acender = useCallback(() => {
    setEscuro(false);
    if (apagarRef.current) clearTimeout(apagarRef.current);
    apagarRef.current = setTimeout(() => setEscuro(true), 20_000);
  }, []);
  useEffect(() => {
    acender();
    return () => {
      if (apagarRef.current) clearTimeout(apagarRef.current);
    };
  }, [acender]);

  const acoes = useRef({ pausar: () => {}, tocar: () => {} });
  acoes.current = {
    pausar: () => {
      audioRef.current?.pause();
      setPausado(true);
      estadoDaMidia("paused");
    },
    tocar: () => {
      setPausado(false);
      void audioRef.current?.play().catch(() => {});
      estadoDaMidia("playing");
    },
  };
  useEffect(() => {
    estadoDaMidia("playing");
    return anunciarMidia({
      titulo: `${historia.titulo} · História para dormir`,
      aoPausar: () => acoes.current.pausar(),
      aoTocar: () => acoes.current.tocar(),
    });
  }, [historia.titulo]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[#0b0f21] text-white"
      style={{ paddingTop: "var(--safe-top)" }}
      onClick={acender}
      onTouchStart={acender}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {ESTRELAS.map((e, n) => (
          <circle
            key={n}
            cx={e.x}
            cy={e.y}
            r={0.18}
            fill="#dfe6ff"
            fillOpacity={e.o}
            className="dc-estrela"
            style={{ animationDelay: `${e.d}s` }}
          />
        ))}
      </svg>

      <div
        className="relative flex flex-1 flex-col transition-opacity duration-[2500ms]"
        style={{ opacity: escuro ? 0.09 : 1 }}
      >
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => {
              limpar();
              aoSair();
            }}
            aria-label="Fechar"
            className="press text-2xl leading-none text-white/40"
          >
            ✕
          </button>
          <span className="flex-1" />
          <button
            onClick={() => (pausado ? acoes.current.tocar() : acoes.current.pausar())}
            aria-label={pausado ? "Continuar" : "Pausar"}
            className="press grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/70"
          >
            <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="currentColor">
              {pausado ? (
                <path d="M8 5.2v13.6L19 12z" />
              ) : (
                <path d="M6.6 4.8h3.7v14.4H6.6zM13.7 4.8h3.7v14.4h-3.7z" />
              )}
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <span className="text-5xl" aria-hidden>
            {historia.emoji}
          </span>
          <h3 className="mt-5 font-serif text-[24px] font-semibold">{historia.titulo}</h3>
          {/* O texto NÃO aparece: ler acorda, e a tela existe para o contrário.
              O que se vê é só quanto já andou. */}
          <div className="mt-8 h-[3px] w-40 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/40 transition-[width] duration-1000"
              style={{ width: `${((i + 1) / total) * 100}%` }}
            />
          </div>
          <p className="mt-4 text-[11px] text-white/30">
            {pausado ? "Pausado" : "A tela vai escurecer sozinha"}
          </p>
        </div>
      </div>
    </div>
  );
}
