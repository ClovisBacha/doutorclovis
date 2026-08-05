/**
 * Listas curadas do cadastro do médico.
 *
 * Por que listas e não campo livre: o texto que o médico digita aqui é o que a
 * paciente LÊ e o que a busca COMPARA. Em campo livre o mesmo profissional
 * escreve "Gineco e Obstetra", "GO", "Ginecologista/Obstetra" — e aí a busca por
 * "obstetra" acha um e perde outro, e dois médicos iguais parecem diferentes no
 * card. Uma lista resolve os dois problemas de uma vez.
 *
 * Por que sempre com "Outro": nenhuma lista cobre a medicina inteira, e um
 * campo que não aceita a resposta certa é pior que um campo livre. A lista é o
 * caminho rápido; digitar continua possível.
 *
 * A ordem NÃO é alfabética — é por frequência no público do app (gestação e
 * pré-natal primeiro). O que a maioria escolhe fica onde o dedo já está.
 */

/** Títulos como a paciente os reconhece, do mais comum ao mais específico. */
export const TITULOS_MEDICO = [
  "Ginecologista e Obstetra",
  "Obstetra",
  "Ginecologista",
  "Especialista em Medicina Fetal",
  "Especialista em Reprodução Humana",
  "Mastologista",
  "Uroginecologista",
  "Ginecologista Oncológico",
  "Cirurgião(ã) Ginecológico",
  "Enfermeiro(a) Obstetra",
] as const;

/**
 * Foco de atuação. É o campo que mais pesa na busca: a paciente procura
 * "alto risco", "parto humanizado", "endometriose" — palavras de problema, não
 * nomes de especialidade.
 */
export const ESPECIALIDADES_MEDICO = [
  "Gestação de alto risco",
  "Pré-natal e parto",
  "Parto humanizado",
  "Medicina fetal e ultrassonografia obstétrica",
  "Reprodução humana e fertilidade",
  "Endometriose",
  "Climatério e menopausa",
  "Contracepção e planejamento familiar",
  "Cirurgia minimamente invasiva (laparoscopia e histeroscopia)",
  "Uroginecologia e assoalho pélvico",
] as const;

/**
 * Categorias de formação, na ordem em que um currículo médico brasileiro é
 * lido: graduação, residência, título de especialista, e daí para cima.
 *
 * `exemplo` não é enfeite — é o que faz o médico escrever no formato que a
 * paciente entende. Sem ele, metade escreve só "UFMG" e a linha final fica
 * "Graduação em Medicina — UFMG" contra "Graduação em Medicina — fiz na
 * federal de Minas em 2010".
 */
export type CategoriaFormacao = {
  chave: string;
  rotulo: string;
  exemplo: string;
  /** Aparece antes do que ele digita, na linha final. */
  prefixo: string;
};

export const CATEGORIAS_FORMACAO: CategoriaFormacao[] = [
  {
    chave: "graduacao",
    rotulo: "Faculdade de Medicina",
    exemplo: "UFMG, 2010",
    prefixo: "Graduação em Medicina",
  },
  {
    chave: "residencia",
    rotulo: "Residência médica",
    exemplo: "Ginecologia e Obstetrícia — Hospital das Clínicas UFMG",
    prefixo: "Residência",
  },
  {
    /* TEGO/RQE é o que separa "fez residência" de "tem título reconhecido", e
       é a credencial que a paciente pode conferir no conselho. */
    chave: "titulo",
    rotulo: "Título de especialista (TEGO / RQE)",
    exemplo: "TEGO — FEBRASGO/AMB, RQE 12345",
    prefixo: "Título de especialista",
  },
  {
    chave: "especializacao",
    rotulo: "Especialização ou fellowship",
    exemplo: "Medicina Fetal — Hospital Israelita Albert Einstein",
    prefixo: "Especialização",
  },
  {
    chave: "mestrado",
    rotulo: "Mestrado",
    exemplo: "Medicina Fetal — USP",
    prefixo: "Mestrado",
  },
  {
    chave: "doutorado",
    rotulo: "Doutorado",
    exemplo: "Tocoginecologia — UNICAMP",
    prefixo: "Doutorado",
  },
  {
    chave: "posdoc",
    rotulo: "Pós-doutorado",
    exemplo: "Medicina Materno-Fetal — Barcelona",
    prefixo: "Pós-doutorado",
  },
  {
    chave: "sociedades",
    rotulo: "Sociedades e associações",
    exemplo: "Membro da FEBRASGO e da SOGIMIG",
    prefixo: "Sociedades",
  },
  {
    chave: "docencia",
    rotulo: "Docência",
    exemplo: "Professor de Obstetrícia — Faculdade de Medicina da UFMG",
    prefixo: "Docência",
  },
  {
    chave: "hospitais",
    rotulo: "Hospitais onde atua",
    exemplo: "Vila da Serra, Mater Dei e Hospital Felício Rocho",
    prefixo: "Atua em",
  },
  {
    chave: "cursos",
    rotulo: "Cursos e certificações",
    exemplo: "ALSO, Reanimação Neonatal, Ultrassonografia Obstétrica",
    prefixo: "Certificações",
  },
];

/**
 * Monta o texto final de `education` a partir das categorias preenchidas.
 *
 * Uma linha por item, na ordem da lista — a mesma ordem em que um currículo é
 * lido. O banco continua guardando UMA coluna de texto: as categorias são
 * andaime de digitação, não estrutura de dados. Se amanhã a lista mudar, o que
 * já foi escrito continua legível, e é isso que importa para quem lê.
 */
export function montarFormacoes(valores: Record<string, string>): string {
  return CATEGORIAS_FORMACAO.map((c) => {
    const v = (valores[c.chave] ?? "").trim();
    if (!v) return null;
    /* Se o médico já escreveu o prefixo, não repetimos: ele digita
       "Residência em GO no HC" e a linha não vira "Residência — Residência…". */
    const jaTemPrefixo = v.toLowerCase().startsWith(c.prefixo.toLowerCase().slice(0, 8));
    return jaTemPrefixo ? v : `${c.prefixo} — ${v}`;
  })
    .filter(Boolean)
    .join("\n");
}

/**
 * Lê um `education` já salvo de volta para as categorias.
 *
 * Tolerante de propósito: o que existe hoje foi digitado à mão, sem categoria
 * nenhuma. O que casar com um prefixo conhecido volta para o seu campo; o resto
 * vai para `livre`, para o médico não perder nada que já escreveu.
 */
export function separarFormacoes(texto?: string | null): {
  valores: Record<string, string>;
  livre: string;
} {
  const valores: Record<string, string> = {};
  const sobrou: string[] = [];
  for (const linha of (texto ?? "").split("\n")) {
    const l = linha.trim();
    if (!l) continue;
    const cat = CATEGORIAS_FORMACAO.find((c) =>
      l.toLowerCase().startsWith(c.prefixo.toLowerCase().slice(0, 8)),
    );
    if (cat && !valores[cat.chave]) {
      /* Tira o prefixo e o travessão para o campo mostrar só o conteúdo — mas
         só quando a linha está no formato canônico que `montarFormacoes`
         escreve.

         O corte antes era um regex genérico (`^[^—-]*[—-]\s*`), e ele comia o
         hífen do PRÓPRIO prefixo: "Pós-doutorado — USP" voltava como
         "doutorado — USP", e o envio seguinte gravava "Pós-doutorado —
         doutorado — USP". Cada ida e volta somava um pedaço.

         Linha escrita à mão ("Residência em GO no HC") volta INTEIRA: o
         `jaTemPrefixo` do outro lado reconhece e não duplica nada. Melhor
         devolver o que ele escreveu do que adivinhar onde termina o rótulo. */
      const canonico = `${cat.prefixo} — `;
      valores[cat.chave] = l.toLowerCase().startsWith(canonico.toLowerCase())
        ? l.slice(canonico.length).trim() || l
        : l;
    } else {
      sobrou.push(l);
    }
  }
  return { valores, livre: sobrou.join("\n") };
}
