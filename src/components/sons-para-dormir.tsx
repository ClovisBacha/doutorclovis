/**
 * SONS PARA DORMIR.
 *
 * ─── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * Chuva, mar, coração e pad já existiam há meses — e só tocavam DENTRO de uma
 * sessão de meditação. Quem acordava às três da manhã não tinha como pedir só o
 * som. No Calm isso é tela própria, e é o produto principal deles à noite;
 * aqui era um recurso pronto, escondido atrás de uma sessão de dez minutos que
 * ninguém quer começar de madrugada.
 *
 * O "Coração" é o que nenhum concorrente tem: o batimento a 140 bpm com o
 * "shhh" grave por cima é o som que o bebê ouve lá dentro.
 *
 * ─── E POR QUE ELE NÃO É O SOM DA MEDITAÇÃO ─────────────────────────────────
 *
 * É o mesmo som, gerado pela mesma receita — mas renderizado num arquivo e
 * tocado num `<audio loop>` (ver `som-continuo.ts`). Web Audio ao vivo é
 * SUSPENSO pelo iOS quando o aparelho bloqueia: um player de dormir feito
 * assim pararia no instante em que ela apoia o celular na mesa de cabeceira.
 *
 * ⚠️ ESTA TELA NÃO PAUSA QUANDO O APP SAI DA FRENTE — e é o contrário da
 * meditação de propósito. Lá, sumir da tela significa "ela foi fazer outra
 * coisa, guarde o lugar". Aqui significa "ela vai dormir": pausar seria
 * desligar exatamente no momento para o qual a tela existe.
 *
 * E não há `manterTelaAcesa` aqui, pelo mesmo motivo — a tela deve apagar.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  criarTocador,
  faltando,
  quandoDesligar,
  rotuloDoTempo,
  FAMILIAS,
  FAMILIA_DO_SOM,
  ROTULO_DO_SOM,
  SONS_CONTINUOS,
  TEMPOS,
  type SomKey,
  type Tempo,
  type Tocador,
} from "@/lib/som-continuo";
import { anunciarMidia, estadoDaMidia } from "@/lib/media-session";
import { HISTORIAS, duracaoAproximada, type Historia } from "@/lib/historias-para-dormir";
import { HistoriaDaNoite } from "@/components/historia-da-noite";

/**
 * ⚠️ O CATÁLOGO SAI DO MÓDULO, e não de uma cópia aqui.
 *
 * Eram quatro sons escritos à mão nesta tela. Com vinte, uma segunda lista
 * seria garantia de divergir no primeiro som novo — e a divergência apareceria
 * como um som que existe no motor e não tem nome na tela, ou pior, um botão
 * que promete um som que ninguém montou.
 */
const ROTULO = ROTULO_DO_SOM;

/** Os sons de cada família, na ordem em que o módulo os declara. */
const POR_FAMILIA = FAMILIAS.map((f) => ({
  familia: f,
  sons: SONS_CONTINUOS.filter((k) => FAMILIA_DO_SOM[k] === f),
})).filter((g) => g.sons.length > 0);

export function SonsParaDormir({ aoFechar }: { aoFechar: () => void }) {
  const [som, setSom] = useState<SomKey | null>(null);
  const [carregando, setCarregando] = useState<SomKey | null>(null);
  const [tempo, setTempo] = useState<Tempo>(30);
  const [alvo, setAlvo] = useState<number | null>(null);
  const [restante, setRestante] = useState<number>(0);
  const [falhou, setFalhou] = useState(false);
  /* A história tocando agora — ela toma a tela inteira. */
  const [historia, setHistoria] = useState<Historia | null>(null);
  /**
   * Quem manda no rótulo é o ELEMENTO, não o nosso estado: a pausa pode vir do
   * card do sistema, do botão do fone, ou de uma chamada entrando.
   *
   * E o temporizador para junto. Ele conta pelo relógio, então sem isto uma
   * pausa de dez minutos faria o som desligar dez minutos antes da hora que ela
   * pediu — o tipo de coisa que ninguém consegue nomear, só sente que o app
   * não faz o que promete.
   */
  const [pausado, setPausado] = useState(false);
  const alvoRef = useRef<number | null>(null);
  const guardadoRef = useRef<number | null>(null);
  alvoRef.current = alvo;
  const tocador = useRef<Tocador | null>(null);

  /* Um tocador só para a tela inteira: trocar de som troca a faixa DO MESMO
     elemento, que é o que mantém o destravamento do iOS válido. Um elemento
     por som exigiria um gesto novo a cada troca. */
  if (typeof window !== "undefined" && !tocador.current) tocador.current = criarTocador();

  const parar = useCallback(() => {
    tocador.current?.parar();
    setSom(null);
    setAlvo(null);
    estadoDaMidia("none");
  }, []);

  useEffect(() => () => tocador.current?.parar(), []);

  /**
   * ⚠️ ABRIR A HISTÓRIA DESTRAVA O SOM, no mesmo toque.
   *
   * Quando a história acaba, o som contínuo entra sozinho no lugar da voz — e
   * "sozinho" quer dizer SEM gesto nenhum, onze minutos depois. No iOS aquilo
   * seria recusado. O destravamento tem de acontecer aqui, no toque em que ela
   * escolhe a história, que é o último gesto que vai existir nesta noite.
   */
  function abrirHistoria(h: Historia) {
    tocador.current?.destravar();
    setHistoria(h);
  }

  /** A voz acabou: a chuva assume, com o mesmo temporizador que ela escolheu. */
  const entregarAoSom = useCallback(async () => {
    setHistoria(null);
    const ok = await tocador.current?.tocar("chuva");
    if (!ok) return;
    setSom("chuva");
    setAlvo(quandoDesligar(tempo, Date.now()));
  }, [tempo]);

  async function escolher(k: SomKey) {
    if (carregando) return;
    /* O ladrilho aceso é play/pausa; quem desliga de vez é "Parar agora". Sem
       isto, tocar no som pausado o DESLIGAVA — e o rótulo dizia para tocar nele
       justamente para voltar. */
    if (som === k) {
      const a = tocador.current?.elemento;
      if (pausado && a) {
        void a.play().catch(() => {});
        return;
      }
      a?.pause();
      return;
    }
    /* ⚠️ DENTRO DO TOQUE, antes de qualquer `await`: é o que destrava o áudio
       no iOS. Depois do primeiro `await` o gesto já passou e o `play()` volta
       recusado, sem erro visível — o player ficaria mudo. */
    tocador.current?.destravar();
    setFalhou(false);
    setCarregando(k);
    const ok = await tocador.current?.tocar(k);
    setCarregando(null);
    if (!ok) {
      setFalhou(true);
      return;
    }
    setSom(k);
    setAlvo(quandoDesligar(tempo, Date.now()));
  }

  function trocarTempo(t: Tempo) {
    setTempo(t);
    setAlvo(som ? quandoDesligar(t, Date.now()) : null);
  }

  const desligarSuave = useCallback(async () => {
    const k = som;
    setAlvo(null);
    if (!k) return;
    setSom(null);
    await tocador.current?.desligarComFade(k);
    estadoDaMidia("none");
  }, [som]);

  /**
   * O relógio do temporizador.
   *
   * Conta pelo RELÓGIO (`Date.now()`), nunca somando ticks: com a tela apagada
   * o navegador espaça os intervalos, e um contador de batidas terminaria
   * minutos depois da hora. Assim o atraso possível é o de uma volta, não o
   * acumulado da noite.
   */
  useEffect(() => {
    if (!alvo || !som) return;
    const passo = setInterval(() => {
      const falta = alvo - Date.now();
      setRestante(falta);
      if (falta <= 0) void desligarSuave();
    }, 1000);
    setRestante(alvo - Date.now());
    return () => clearInterval(passo);
  }, [alvo, som, desligarSuave]);

  /**
   * O card do sistema: é por ele que ela pausa sem desbloquear o aparelho.
   *
   * ⚠️ Pausar aqui é PAUSAR, não parar. A primeira versão desligava tudo no ⏸
   * da tela bloqueada — e aí o ▶︎ ao lado não tinha o que retomar: o arquivo
   * havia sido descartado. Um botão de play que não toca, na tela de bloqueio,
   * às três da manhã.
   */
  useEffect(() => {
    if (!som) return;
    estadoDaMidia("playing");
    return anunciarMidia({
      titulo: `${ROTULO[som].label} · Sons para dormir`,
      aoPausar: () => {
        tocador.current?.elemento.pause();
        estadoDaMidia("paused");
      },
      aoTocar: () => {
        void tocador.current?.elemento.play().catch(() => {});
        estadoDaMidia("playing");
      },
      aoParar: parar,
    });
  }, [som, parar]);

  useEffect(() => {
    const a = tocador.current?.elemento;
    if (!a) return;
    const tocou = () => {
      setPausado(false);
      if (guardadoRef.current != null) {
        setAlvo(Date.now() + guardadoRef.current);
        guardadoRef.current = null;
      }
    };
    const parou = () => {
      setPausado(true);
      if (alvoRef.current) guardadoRef.current = Math.max(0, alvoRef.current - Date.now());
    };
    a.addEventListener("play", tocou);
    a.addEventListener("pause", parou);
    return () => {
      a.removeEventListener("play", tocou);
      a.removeEventListener("pause", parou);
    };
  }, []);

  if (historia) {
    return (
      <HistoriaDaNoite
        historia={historia}
        aoTerminar={() => void entregarAoSom()}
        aoSair={() => setHistoria(null)}
      />
    );
  }

  return (
    <div
      className="dc-quiz-in fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#141a34] via-[#1b2140] to-[#0e1226] text-white"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      <div className="flex items-center px-4 py-3">
        <button
          onClick={() => {
            parar();
            aoFechar();
          }}
          aria-label="Fechar"
          className="press text-2xl leading-none text-white/45"
        >
          ✕
        </button>
        <span className="flex-1" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-10">
        <h3 className="font-serif text-[26px] font-semibold">Para dormir</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-white/60">
          Pode apagar a tela e deixar o celular de lado — o som continua tocando.
        </p>

        {/* ── HISTÓRIAS ────────────────────────────────────────────────────
            Vêm ANTES dos sons porque é o que se procura acordada às três da
            manhã: som ambiente acalma quem já está quase dormindo, história
            ocupa a cabeça de quem está com a cabeça a mil. */}
        <p className="mt-7 text-[11px] font-bold uppercase tracking-wider text-white/40">
          Histórias
        </p>
        <div className="mt-2 grid gap-2">
          {HISTORIAS.map((h) => (
            <button
              key={h.chave}
              onClick={() => abrirHistoria(h)}
              className="press flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.06] px-4 py-3 text-left"
            >
              <span className="text-2xl leading-none" aria-hidden>
                {h.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold">{h.titulo}</span>
                <span className="block text-[11px] leading-snug text-white/50">
                  {h.sub} · {duracaoAproximada(h)} min
                </span>
              </span>
              <span className="shrink-0 text-white/30" aria-hidden>
                ›
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-white/35">
          Quando a história acaba, a chuva continua sozinha — o quarto não fica mudo de repente.
        </p>

        {/* ⚠️ AGRUPADOS POR FAMÍLIA, e não numa lista de vinte.
            Uma lista lisa de vinte é um catálogo que ninguém percorre: ela toca
            nos dois primeiros e desiste. Agrupada, ela procura pelo que quer
            ("hoje eu quero água") em vez de ler vinte rótulos seguidos. */}
        {POR_FAMILIA.map(({ familia, sons }) => (
          <div key={familia}>
            <p className="mt-7 text-[11px] font-bold uppercase tracking-wider text-white/40">
              {familia}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {sons.map((k) => {
                const ativo = som === k;
                return (
                  <button
                    key={k}
                    onClick={() => void escolher(k)}
                    aria-pressed={ativo}
                    className={`press rounded-3xl border p-4 text-left transition-colors ${
                      ativo
                        ? "border-indigo-300/60 bg-indigo-400/25"
                        : "border-white/10 bg-white/[0.06]"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-2xl leading-none">
                      <span aria-hidden>{ROTULO[k].emoji}</span>
                      {ativo && (
                        <span className="flex items-end gap-[3px]" aria-hidden>
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className="dc-onda w-[3px] rounded-full bg-indigo-200"
                              style={{ animationDelay: `${i * 0.18}s` }}
                            />
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="mt-2 block text-sm font-extrabold">{ROTULO[k].label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-white/50">
                      {carregando === k ? "preparando…" : ROTULO[k].sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <p className="mt-7 text-[11px] font-bold uppercase tracking-wider text-white/40">
          Desligar sozinho em
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TEMPOS.map((t) => (
            <button
              key={t}
              onClick={() => trocarTempo(t)}
              className={`press rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                tempo === t
                  ? "bg-indigo-400/90 text-[#141a34]"
                  : "border border-white/15 bg-white/[0.06] text-white/70"
              }`}
            >
              {rotuloDoTempo(t)}
            </button>
          ))}
        </div>

        <p className="mt-6 min-h-[20px] text-[13px] text-white/60">
          {falhou
            ? "Não consegui tocar aqui. Toque de novo, ou confira se o aparelho está no silencioso."
            : !som
              ? "Escolha um som."
              : pausado
                ? "Pausado — toque no som para voltar"
                : alvo
                  ? `Tocando · desliga em ${faltando(restante)}`
                  : "Tocando · sem limite"}
        </p>

        {som && (
          <button
            onClick={parar}
            className="press mt-5 w-full rounded-full border border-white/15 bg-white/[0.06] py-3 text-sm font-extrabold text-white/80"
          >
            Parar agora
          </button>
        )}

        {/* O volume é o do aparelho, e isto precisa estar dito: no iPhone a
            página não controla volume nenhum, e uma paciente procurando um
            controle que não existe acha que o app está quebrado. */}
        <p className="mt-8 text-[11px] leading-relaxed text-white/35">
          O volume é o do próprio celular — use os botões da lateral. Com fone, o som fica mais
          fechado e costuma incomodar menos quem dorme do lado.
        </p>
      </div>
    </div>
  );
}
