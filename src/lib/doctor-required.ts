/**
 * O que é obrigatório no cadastro do médico — e por quê.
 *
 * Isto mora num módulo só porque três lugares precisam da MESMA resposta: o
 * formulário de cadastro (para não deixar avançar), o servidor (para não
 * confiar no formulário) e o painel (para cobrar o que ficou faltando). Cada
 * um com sua lista era a receita para "o formulário exigiu, o servidor aceitou
 * vazio, e o SOS não tem para onde ligar".
 *
 * O critério de "obrigatório" é único e duro: **alguma tela da paciente fica
 * quebrada ou perigosa sem esse dado.** Nada entra aqui por ser bonito de ter.
 *
 * - `whatsapp` — é o número que o botão SOS disca e que vai na carteirinha de
 *   emergência. Sem ele o SOS não tem destino: é o único campo cuja ausência
 *   pode custar caro de verdade.
 * - `display_name` + `crm` — identificam o médico na carteirinha, no recibo e
 *   no e-mail de consulta. Sem CRM não há documento válido; e CRM é por estado,
 *   então UF e número são dois dados, não um.
 * - `endereço principal` — a paciente precisa saber para onde ir. Fica na
 *   tabela `doctor_addresses`, então é checado à parte.
 * - `convênio ou particular` — é a primeira pergunta dela. Precisa de pelo
 *   menos um "sim": um médico que não atende de nenhuma das duas formas não
 *   pode receber paciente.
 * - `valor da consulta` — obrigatório SÓ quando atende particular. Quem é só
 *   convênio não tem valor a informar, e exigir um número aí seria mentira.
 * - `formações` — é o que faz a paciente escolher entre dois nomes que ela não
 *   conhece. Sem isso o perfil na busca fica vazio.
 *
 * Fora daqui, complementar: telefone pessoal (é da plataforma falar com ele,
 * não da paciente), RQE (nem todo CRM tem um emitido), Instagram, bio,
 * abordagem, idiomas, hospitais, subespecialidade, anos de experiência,
 * mestrado/doutorado, PIX, teleconsulta, endereços extras.
 */

export type CamposMedico = {
  display_name?: string | null;
  crm?: string | null;
  whatsapp?: string | null;
  education?: string | null;
  accepts_insurance?: boolean | null;
  accepts_private?: boolean | null;
  insurances?: string | null;
  consultation_price_brl?: number | null;
};

export type Pendencia = {
  /** Chave do campo — o formulário usa para focar o input certo. */
  campo: string;
  /** Rótulo curto, na língua do médico. */
  rotulo: string;
  /** Por que a plataforma precisa disso. Aparece na tela. */
  porque: string;
};

/** Dígitos de um telefone, sem máscara. */
function digitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}

/**
 * O que ainda falta no cadastro. Lista vazia = pronto para receber paciente.
 *
 * `temEndereco` vem de fora porque endereço é outra tabela — e passar o booleano
 * é melhor do que esta função saber consultar banco.
 */
export function pendenciasDoMedico(c: CamposMedico, opts?: { temEndereco?: boolean }): Pendencia[] {
  const faltas: Pendencia[] = [];

  if ((c.display_name ?? "").trim().length < 2) {
    faltas.push({
      campo: "display_name",
      rotulo: "Seu nome",
      porque: "É o nome que a paciente vê na carteirinha e no recibo.",
    });
  }

  // CRM canônico é "CRM-UF 12345": exige UF de 2 letras e ao menos 3 dígitos.
  const crm = (c.crm ?? "").trim();
  if (!/[A-Za-z]{2}/.test(crm) || digitos(crm).length < 3) {
    faltas.push({
      campo: "crm",
      rotulo: "CRM (estado e número)",
      porque: "Sem CRM o recibo da consulta não é um documento válido.",
    });
  }

  /* Celular brasileiro tem 10 (fixo) ou 11 (móvel) dígitos, com DDD; com o 55
     na frente, 12 ou 13. Menos que isso não disca. */
  const tel = digitos(c.whatsapp);
  if (tel.length < 10 || tel.length > 13) {
    faltas.push({
      campo: "whatsapp",
      rotulo: "Telefone para pacientes",
      porque:
        "É este número que o botão de emergência (SOS) disca e que aparece na carteirinha da paciente. Não use o pessoal.",
    });
  }

  if (!c.accepts_insurance && !c.accepts_private) {
    faltas.push({
      campo: "atendimento",
      rotulo: "Convênio ou particular",
      porque: "A paciente precisa saber como você atende antes de pedir consulta.",
    });
  }

  if (c.accepts_insurance && !(c.insurances ?? "").trim()) {
    faltas.push({
      campo: "insurances",
      rotulo: "Quais convênios",
      porque: '"Aceito convênio" sem a lista não responde se o plano dela serve.',
    });
  }

  if (c.accepts_private && !(c.consultation_price_brl && c.consultation_price_brl > 0)) {
    faltas.push({
      campo: "consultation_price_brl",
      rotulo: "Valor da consulta",
      porque: "Atendimento particular sem valor deixa a paciente sem saber quanto custa.",
    });
  }

  if ((c.education ?? "").trim().length < 4) {
    faltas.push({
      campo: "education",
      rotulo: "Formações",
      porque: "É o que faz a paciente escolher você entre dois nomes que ela não conhece.",
    });
  }

  // Endereço vive em `doctor_addresses`; só cobramos quando sabemos a resposta.
  if (opts?.temEndereco === false) {
    faltas.push({
      campo: "endereco",
      rotulo: "Endereço do consultório",
      porque: "A paciente precisa saber para onde ir na consulta.",
    });
  }

  return faltas;
}

/** Atalho: o cadastro está completo? */
export function cadastroCompleto(c: CamposMedico, opts?: { temEndereco?: boolean }): boolean {
  return pendenciasDoMedico(c, opts).length === 0;
}
