import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  GRUPOS_DE_SOM,
  ROTULO,
  createSoundscape,
  type Soundscape,
  type SoundscapeKey,
} from "@/lib/soundscapes";
import { DESENHOS, type EspecieDeSom } from "@/lib/som-da-interface";
import { gravarNivel, lerNivel, ouvirAmostraDeUI, type NivelDeSom } from "@/lib/tocar-som-de-ui";

/**
 * A BANCADA DE OUVIR — e ela é a única forma de conferir isto sem duas contas
 * e uma sessão de dez minutos.
 *
 * `scripts/ouvir.mjs` mede: crista, emenda, repetição, energia por banda. Mas
 * medida não é escuta, e quem escreve este código não ouve o resultado. Esta
 * tela é o outro lado: os vinte sons, a música e os sons de interface, todos
 * alcançáveis num toque, sem conta, sem banco, sem esperar a sessão chegar na
 * fase certa.
 *
 * Sem ela, ouvir o "vento na janela" exigiria abrir a meditação numa conta
 * real, entrar na folha de sons, rolar até a família certa e esperar o fade de
 * 1,5 s — para cada um dos vinte.
 */
export const Route = createFileRoute("/preview-som")({
  head: () => ({
    meta: [{ title: "Bancada de ouvir" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewSom,
});

const UI: { chave: EspecieDeSom; rotulo: string; nota: string }[] = [
  { chave: "compasso", rotulo: "Compasso", nota: "a deixa da respiração — olhos fechados" },
  { chave: "intervalo", rotulo: "Intervalo", nota: "fim de um intervalo de contração" },
  { chave: "fim", rotulo: "Fim", nota: "acabou a sessão — desce" },
  { chave: "conquista", rotulo: "Conquista", nota: "a festa, afinada em 432" },
  { chave: "sos", rotulo: "SOS enviado", nota: "⚠️ alarme — sobe, e ignora a preferência" },
  { chave: "sos-falhou", rotulo: "SOS falhou", nota: "⚠️ alarme — desce e repete" },
];

const NIVEIS: { chave: NivelDeSom; rotulo: string; nota: string }[] = [
  { chave: "desligado", rotulo: "Desligado", nota: "o padrão" },
  { chave: "essencial", rotulo: "Essencial", nota: "só onde os olhos não estão" },
  { chave: "completo", rotulo: "Completo", nota: "com a festa" },
];

function PreviewSom() {
  const [tocando, setTocando] = useState<SoundscapeKey | null>(null);
  const [nivel, setNivel] = useState<NivelDeSom>("desligado");
  const [minutos, setMinutos] = useState(1);
  const atual = useRef<Soundscape | null>(null);

  useEffect(() => setNivel(lerNivel()), []);
  useEffect(() => () => atual.current?.stop(), []);

  function tocar(k: SoundscapeKey) {
    atual.current?.stop();
    atual.current = null;
    if (tocando === k) {
      setTocando(null);
      return;
    }
    const s = createSoundscape(k, { minutos });
    s.start();
    atual.current = s;
    setTocando(k);
  }

  return (
    /* ⚠️ `fixed inset-0` porque a bancada vive numa rota PÚBLICA, e a rota
       pública traz cabeçalho e rodapé do site. Medido: a página saía com 3965px
       de altura, dos quais cerca de dois terços eram o rodapé institucional —
       numa tela cujo trabalho é ser folheada no celular, isso é ruído puro.
       É o mesmo motivo de `/preview-sons` renderizar um componente de tela
       cheia. */
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 px-5 py-8 text-slate-100">
      <div className="mx-auto max-w-md">
        <h1 className="text-lg font-extrabold">Bancada de ouvir</h1>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Vinte sons, a música e os sons de interface. Toque para ouvir; toque de novo para parar.
          Nada aqui lê conta nem banco.
        </p>

        <p className="mt-7 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Duração da música
        </p>
        <div className="mt-2 flex gap-2">
          {[1, 2, 5, 10].map((m) => (
            <button
              key={m}
              onClick={() => setMinutos(m)}
              className={`press rounded-full px-4 py-2 text-xs font-bold ${
                minutos === m ? "bg-violet-500 text-white" : "bg-white/10 text-slate-300"
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          A música é construída para a duração — o arco inteiro cabe no tempo pedido, e a última
          nota é composta, não cortada.
        </p>

        {GRUPOS_DE_SOM.map((g) => (
          <div key={g.familia || "especiais"} className="mt-6">
            {g.familia && (
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {g.familia}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {g.sons.map((k) => (
                <button
                  key={k}
                  onClick={() => tocar(k)}
                  aria-pressed={tocando === k}
                  className={`press rounded-2xl border p-3 text-left ${
                    tocando === k
                      ? "border-violet-300/60 bg-violet-500/25"
                      : "border-white/10 bg-white/[0.06]"
                  }`}
                >
                  <span className="text-xl leading-none" aria-hidden>
                    {ROTULO[k]?.emoji}
                  </span>
                  <span className="mt-1.5 block text-sm font-extrabold">{ROTULO[k]?.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
                    {ROTULO[k]?.sub ?? "—"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <p className="mt-8 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Som de interface
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Aqui eles tocam ignorando os portões — é a bancada, e ela existe para ouvir. No app, quem
          decide é <code className="text-slate-400">podeSoar</code>.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {UI.map((u) => (
            <button
              key={u.chave}
              onClick={() => ouvirAmostraDeUI(u.chave)}
              className="press rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-left"
            >
              <span className="block text-sm font-extrabold">{u.rotulo}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">{u.nota}</span>
              <span className="mt-1 block text-[10px] text-slate-500">
                {DESENHOS[u.chave].passos.map((p) => Math.round(p.hz)).join(" · ")} Hz
              </span>
            </button>
          ))}
        </div>

        <p className="mt-8 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          A preferência
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {NIVEIS.map((n) => (
            <button
              key={n.chave}
              onClick={() => {
                setNivel(n.chave);
                gravarNivel(n.chave);
              }}
              className={`press rounded-2xl px-4 py-3 text-left ${
                nivel === n.chave ? "bg-violet-500 text-white" : "bg-white/[0.06] text-slate-200"
              }`}
            >
              <span className="block text-sm font-extrabold">{n.rotulo}</span>
              <span
                className={`mt-0.5 block text-[11px] ${
                  nivel === n.chave ? "text-white/70" : "text-slate-400"
                }`}
              >
                {n.nota}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          O SOS não obedece a nenhuma destas escolhas — ele não é som de interface, é alarme.
        </p>
        <div className="h-16" />
      </div>
    </div>
  );
}
