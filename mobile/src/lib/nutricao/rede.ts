import { fetch as fetchDoExpo } from "expo/fetch";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { FOTO_BYTES_MAX, type AssuntoDaFoto } from "@/lib/foto-da-nutricao";
import { parParaGravar, TURNOS_DA_MEMORIA, turnosDaMemoria, type LinhaDaMemoria } from "@/lib/nutricao-memoria";
import { tabelaAusente } from "@/lib/postgrest";
import { SITE } from "~/config";
import { base64ParaBytes, montarMultipart, tamanhoReduzido } from "~/lib/nutricao/foto";
import type { MensagemDaApi, Turno } from "~/lib/nutricao/historico";
import { turnosDaTela } from "~/lib/nutricao/historico";
import {
  desfechoDaFoto,
  desfechoDoChat,
  recadoDaFoto,
  type Aviso,
  type DesfechoDaFoto,
  type RespostaDaFoto,
} from "~/lib/nutricao/respostas";
import { amostraDoCabecalho, criarLeitorDoStream, type EstadoDoStream } from "~/lib/nutricao/stream";
import { supabase, tokenAtual } from "~/servidor/supabase";
import type { MotivoDoBloqueio } from "@/lib/nutricao-premium";

/**
 * A NUTRICIONISTA NA REDE — conversa, foto e memória.
 *
 * Toda decisão de texto e de régua está nos módulos puros ao lado
 * (`historico`, `stream`, `respostas`, `foto`); aqui só há ida e volta.
 *
 * ⚠️ O `fetch` é o de `expo/fetch`, IMPORTADO, e não o global: é ele que
 * entrega `res.body` legível enquanto a resposta chega (o do React Native
 * entrega tudo no fim, e a paciente ficaria olhando "…" por vinte segundos).
 * No iPhone o global já é ele; importar deixa isso escrito.
 */

/**
 * O que o aparelho conta ao servidor sobre HOJE (água e suplementos).
 *
 * ⚠️ VAZIO de propósito: este app ainda não registra água nem suplemento, e
 * mandar `{agua: 0, meta: 8, tomados: []}` faria o servidor escrever no prompt
 * "Água hoje: 0 de 8 copos" e "nenhum suplemento tomado" — dois fatos
 * inventados sobre ela. `doAparelhoDe({})` devolve nada, e nada vai ao prompt.
 * Quando a frente de Saúde registrar a água, é aqui que ela entra.
 */
export type ContextoDoAparelho = { agua?: number; meta?: number; tomados?: string[] };
export const CONTEXTO_VAZIO: ContextoDoAparelho = {};

const TEMPO_DA_CONVERSA_MS = 60_000;
const TEMPO_DA_FOTO_MS = 35_000;

export type ResultadoDoChat =
  | { tipo: "ok"; texto: string; assinatura: string | null }
  | { tipo: "bloqueio"; motivo: MotivoDoBloqueio }
  | { tipo: "aviso"; aviso: Aviso }
  /** O fluxo abriu e falhou no meio; `parcial` é o que chegou antes. */
  | { tipo: "quebrou"; parcial: string; erro: string | null };

function relogio(ms: number, externo?: AbortSignal) {
  const controle = new AbortController();
  const t = setTimeout(() => controle.abort(), ms);
  const abortar = () => controle.abort();
  externo?.addEventListener("abort", abortar);
  return {
    sinal: controle.signal,
    soltar: () => {
      clearTimeout(t);
      externo?.removeEventListener("abort", abortar);
    },
  };
}

/** POST /api/nutrition, lendo o SSE enquanto chega. */
export async function perguntarANutricionista(args: {
  mensagens: MensagemDaApi[];
  contexto?: ContextoDoAparelho;
  sinal?: AbortSignal;
  aoChegar: (estado: EstadoDoStream) => void;
  aoSaberAmostra: (n: number | null) => void;
}): Promise<ResultadoDoChat> {
  const token = await tokenAtual();
  if (!token) return { tipo: "aviso", aviso: "sessao" };
  const r = relogio(TEMPO_DA_CONVERSA_MS, args.sinal);
  try {
    let res;
    try {
      res = await fetchDoExpo(`${SITE}/api/nutrition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: args.mensagens, contexto: args.contexto ?? CONTEXTO_VAZIO }),
        signal: r.sinal,
      });
    } catch {
      /* Relógio estourado é demora do servidor ("falha"); o resto é sinal. */
      const demorou = r.sinal.aborted && !args.sinal?.aborted;
      return { tipo: "aviso", aviso: demorou ? "falha" : "rede" };
    }
    const corpo402 = res.status === 402 ? await res.json().catch(() => null) : undefined;
    const d = desfechoDoChat(res.status, corpo402);
    if (d.tipo === "bloqueio") return d;
    if (d.tipo === "aviso") return d;
    args.aoSaberAmostra(amostraDoCabecalho(res.headers.get("X-Nutricionista-Amostra")));

    const leitor = criarLeitorDoStream();
    let estado: EstadoDoStream = { texto: "", erro: null, assinatura: null };
    try {
      if (!res.body) throw new Error("sem corpo");
      const bytes = res.body.getReader();
      const decodificador = new TextDecoder();
      while (true) {
        const { done, value } = await bytes.read();
        if (done) break;
        estado = leitor.empurrar(decodificador.decode(value, { stream: true }));
        args.aoChegar(estado);
      }
      estado = leitor.empurrar(decodificador.decode());
      estado = leitor.fechar();
    } catch {
      estado = leitor.fechar();
      return { tipo: "quebrou", parcial: estado.texto, erro: estado.erro };
    }
    if (!estado.texto.trim()) return { tipo: "quebrou", parcial: "", erro: estado.erro };
    return { tipo: "ok", texto: estado.texto, assinatura: estado.assinatura };
  } finally {
    r.soltar();
  }
}

/**
 * A foto pronta para subir: lado maior em 1024, JPEG a 0,8. Devolve os bytes
 * e a URI local (a bolha mostra a foto; nada é guardado além do cache do
 * sistema, que o iOS limpa).
 */
export async function prepararFoto(
  uri: string,
  largura = 0,
  altura = 0,
): Promise<{ bytes: Uint8Array; uri: string } | { erro: "grande" | "preparo" }> {
  try {
    const contexto = ImageManipulator.manipulate(uri);
    /* O seletor costuma dar as medidas; quando dá 0 (acontece), a imagem é
       desenhada uma vez para saber o tamanho antes de reduzir. */
    let w = largura;
    let h = altura;
    if (!(w > 0 && h > 0)) {
      const medida = await contexto.renderAsync();
      w = medida.width;
      h = medida.height;
    }
    const novo = tamanhoReduzido(w, h);
    if (novo) contexto.resize(novo);
    const final = await contexto.renderAsync();
    const salvo = await final.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
    contexto.release();
    if (!salvo.base64) return { erro: "preparo" };
    const bytes = base64ParaBytes(salvo.base64);
    if (!bytes.length) return { erro: "preparo" };
    if (bytes.length > FOTO_BYTES_MAX) return { erro: "grande" };
    return { bytes, uri: salvo.uri };
  } catch {
    return { erro: "preparo" };
  }
}

/** POST /api/prato (multipart). */
export async function mandarFoto(args: {
  bytes: Uint8Array;
  assunto: AssuntoDaFoto;
  contexto?: ContextoDoAparelho;
  sinal?: AbortSignal;
}): Promise<DesfechoDaFoto> {
  const token = await tokenAtual();
  if (!token) return { tipo: "sessao" };
  const { corpo, contentType } = montarMultipart(
    { assunto: args.assunto, contexto: JSON.stringify(args.contexto ?? CONTEXTO_VAZIO) },
    { campo: "foto", nome: "foto.jpg", tipo: "image/jpeg", bytes: args.bytes },
  );
  const r = relogio(TEMPO_DA_FOTO_MS, args.sinal);
  try {
    const res = await fetchDoExpo(`${SITE}/api/prato`, {
      method: "POST",
      headers: { "Content-Type": contentType, Authorization: `Bearer ${token}` },
      body: corpo as unknown as BodyInit,
      signal: r.sinal,
    });
    const json = (await res.json().catch(() => null)) as RespostaDaFoto | null;
    return desfechoDaFoto(res.status, json);
  } catch {
    /* O relógio estourou → "demorou"; senão, o aparelho sem sinal. */
    const demorou = r.sinal.aborted && !args.sinal?.aborted;
    return { tipo: "recado", texto: recadoDaFoto(demorou ? "demorou" : "sem_sinal") };
  } finally {
    r.soltar();
  }
}

export type LeituraDaMemoria =
  | { tipo: "ok"; turnos: Turno[] }
  /** A tabela ainda não existe neste banco: normal, e cala. */
  | { tipo: "ausente" }
  | { tipo: "falhou" };

/** Os últimos turnos da conversa (dela, por RLS). Nunca no Modo Cuidado. */
export async function lerMemoria(uid: string): Promise<LeituraDaMemoria> {
  try {
    const { data, error } = await supabase
      .from("nutricao_mensagens")
      .select("role,content,assinatura,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(TURNOS_DA_MEMORIA);
    if (error) return tabelaAusente(error) ? { tipo: "ausente" } : { tipo: "falhou" };
    return { tipo: "ok", turnos: turnosDaTela(turnosDaMemoria((data ?? []) as LinhaDaMemoria[])) };
  } catch {
    return { tipo: "falhou" };
  }
}

/**
 * Grava o PAR, e só depois de a resposta chegar (ver `nutricao-memoria.ts`:
 * pergunta gravada sem resposta voltaria órfã na visita seguinte).
 * Falha calada: a conversa desta visita continua igual.
 */
export async function gravarTroca(
  uid: string,
  pergunta: string,
  resposta: { content: string; assinatura?: string },
): Promise<void> {
  if (!resposta.content.trim()) return;
  try {
    const { error } = await supabase
      .from("nutricao_mensagens")
      .insert(parParaGravar(uid, pergunta, resposta));
    if (error && !tabelaAusente(error)) console.warn("[nutricao] troca não gravou", error.code);
  } catch {
    /* melhor esforço */
  }
}
