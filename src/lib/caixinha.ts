/**
 * A CAIXINHA DE PERGUNTAS — a régua, pura e testável.
 *
 * ─── ⚠️ POR QUE ELA SAIU DO SERVIDOR ───────────────────────────────────────
 *
 * As guardas de `perguntar` e `responderPergunta` viviam dentro dos handlers,
 * onde a única forma de testá-las é LER O FONTE. Uma auditoria por mutação
 * rodou 88 quebras contra este repositório e **dez asserções minhas passaram
 * verdes** — todas no arquivo que abria dizendo "todas foram conferidas por
 * mutação". O mecanismo é sempre o mesmo, e vale registrar:
 *
 *  · `indexOf` devolve **−1** quando a linha é APAGADA, e `−1 < qualquer coisa`
 *    passa. Apagar o bloco inteiro da bandeira vermelha ficava verde.
 *  · `slice(-1, x)` devolve **string vazia**, e `not.toContain(…)` sobre vazio
 *    passa. A asserção "a emergência não insere" era vácuo.
 *  · `indexOf("aceita_perguntas")` acha o `.select(...)`, nunca a guarda — então
 *    MOVER a guarda para depois da triagem passava.
 *  · `toContain('.eq("dona_id", eu)')` sobre o corpo inteiro passa quando existe
 *    uma SEGUNDA ocorrência, mesmo tendo apagado a primeira.
 *
 * As mutações que resistiram foram, sem exceção, as **comportamentais**. Então
 * a decisão virou função pura: apagar, mover ou inverter qualquer guarda muda o
 * RESULTADO, e não a posição de uma string.
 *
 * É a mesma lição que já tinha tirado `entradaDoSelo` e `contextoDaPersona` do
 * servidor na Fase 1, aplicada onde ela mais importa.
 */
import { triarTexto, type DesfechoDaPergunta } from "@/lib/pergunta-clinica";

/** Teto diário por pessoa, somando TODAS as caixas. */
export const PERGUNTAS_POR_DIA = 10;

/**
 * Teto diário por PAR.
 *
 * ⚠️ **O teto global não protege contra assédio DIRIGIDO** — as dez podiam ir
 * todas para a mesma pessoa. Numa caixa anônima, dez mensagens de um estranho
 * num dia é o recurso virando o problema, e o precedente é conhecido: o ask.fm
 * saiu do ar em vários países por exatamente isso, com defesas de spam
 * parecidas com as que tínhamos.
 */
export const PERGUNTAS_POR_PESSOA = 3;

export type FatosDaPergunta = {
  souADona: boolean;
  donaExiste: boolean;
  donaEmCuidado: boolean;
  donaAceita: boolean;
  /** `alcancaOPerfil` — a MESMA régua de `verPerfil`. */
  alcancoOPerfil: boolean;
  /** Bloqueio em qualquer um dos dois sentidos. */
  bloqueadas: boolean;
  /** Quantas já mandei hoje, somando todas as caixas. */
  mandeiHoje: number;
  /** Quantas já mandei hoje para ESTA pessoa. */
  mandeiParaElaHoje: number;
};

export type VeredictoDaPergunta =
  | { pode: false; motivo: "indisponivel" | "teto" | "teto_pessoa" | "vazio" }
  | { pode: true; desfecho: DesfechoDaPergunta };

/**
 * Posso perguntar, e para onde vai o que escrevi?
 *
 * ⚠️ **A ORDEM É A RÉGUA, e cada passo existe por um defeito concreto.**
 *
 * 1. **Alcance ANTES de tudo.** `perguntar` não conferia `alcancaOPerfil`, e
 *    `verPerfil` conferia — então quem tivesse o uuid (ele viaja em toda
 *    reação, todo story visto, todo pedido de seguir) escrevia na caixa de um
 *    perfil FECHADO, anonimamente, quantas vezes quisesse. Fechar o perfil não
 *    fechava nada.
 * 2. **Teto ANTES da triagem.** O teto contava só o que ENTRAVA NA CAIXA, e o
 *    ramo `clinica` escrevia em `doctor_questions` sem limite nenhum — e
 *    `posso` sozinho produzia `clinica`. Um script mandando "posso tomar" quatro
 *    mil vezes entupia a fila de dúvidas do consultório, com as dúvidas reais
 *    afundando nela. Agora toda TENTATIVA conta.
 * 3. **A triagem por último**, porque ela decide o destino, não o direito.
 */
export function decidirPergunta(f: FatosDaPergunta, texto: string): VeredictoDaPergunta {
  const t = (texto ?? "").trim();
  if (!t) return { pode: false, motivo: "vazio" };

  /* Um motivo só para os seis casos: distinguir entregaria, por eliminação,
     que ela está em Modo Cuidado. */
  if (f.souADona) return { pode: false, motivo: "indisponivel" };
  if (!f.donaExiste) return { pode: false, motivo: "indisponivel" };
  if (f.donaEmCuidado) return { pode: false, motivo: "indisponivel" };
  if (!f.donaAceita) return { pode: false, motivo: "indisponivel" };
  if (f.bloqueadas) return { pode: false, motivo: "indisponivel" };
  if (!f.alcancoOPerfil) return { pode: false, motivo: "indisponivel" };

  if (f.mandeiHoje >= PERGUNTAS_POR_DIA) return { pode: false, motivo: "teto" };
  if (f.mandeiParaElaHoje >= PERGUNTAS_POR_PESSOA) return { pode: false, motivo: "teto_pessoa" };

  return { pode: true, desfecho: triarTexto(t) };
}

export type FatosDaResposta = {
  souADona: boolean;
  euEmCuidado: boolean;
  perguntaExiste: boolean;
  jaRespondida: boolean;
  arquivada: boolean;
};

export type VeredictoDaResposta =
  | { pode: false; motivo: "indisponivel" | "respondida" | "vazio" | DesfechoDaPergunta }
  | { pode: true };

/**
 * Posso publicar esta resposta?
 *
 * ⚠️ **A régua clínica roda AQUI TAMBÉM**, e é este o texto perigoso: a
 * pergunta é de quem não sabe, a resposta é de quem afirma — e vai para todo
 * mundo de uma vez.
 */
export function decidirResposta(f: FatosDaResposta, texto: string): VeredictoDaResposta {
  const t = (texto ?? "").trim();
  if (!t) return { pode: false, motivo: "vazio" };
  if (!f.souADona) return { pode: false, motivo: "indisponivel" };
  if (f.euEmCuidado) return { pode: false, motivo: "indisponivel" };
  if (!f.perguntaExiste || f.arquivada) return { pode: false, motivo: "indisponivel" };
  if (f.jaRespondida) return { pode: false, motivo: "respondida" };

  const desfecho = triarTexto(t);
  if (desfecho !== "publicavel") return { pode: false, motivo: desfecho };
  return { pode: true };
}

/**
 * O que a tela diz a quem escreveu.
 *
 * ⚠️ **Nunca o motivo detalhado.** "Sua pergunta tem a palavra X" ensina quais
 * palavras passam, e quem quiser burlar precisa de duas tentativas.
 */
export function recadoDoVeredicto(v: VeredictoDaPergunta): string {
  if (v.pode) {
    if (v.desfecho === "emergencia") {
      return "Isso precisa de atendimento agora, não de uma resposta aqui.";
    }
    if (v.desfecho === "clinica") {
      return "Mandei a sua pergunta para o seu médico — é com ele que isso se resolve.";
    }
    return "Pergunta enviada 💛";
  }
  if (v.motivo === "teto") return "Você já mandou bastante pergunta hoje. Amanhã dá de novo 💛";
  if (v.motivo === "teto_pessoa") {
    return "Você já mandou algumas perguntas para essa pessoa hoje. Amanhã dá de novo 💛";
  }
  return "Não deu para enviar agora.";
}

/** O que a dona lê quando a resposta dela é recusada. */
export function recadoDaResposta(v: VeredictoDaResposta): string {
  if (v.pode) return "";
  if (v.motivo === "emergencia") {
    return "Isso é assunto de atendimento agora — abra o SOS em vez de responder aqui.";
  }
  if (v.motivo === "clinica") {
    return "Aqui a gente conta a própria experiência, sem dizer o que a outra deve fazer. Quem orienta é o médico dela.";
  }
  if (v.motivo === "respondida") return "Essa pergunta já foi respondida.";
  return "Não deu para publicar agora. Tente de novo.";
}
