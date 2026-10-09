/**
 * OS FILHOS — a identidade que sobrevive ao parto.
 *
 * ⚠️ **ESTE ARQUIVO EXISTE PARA RESOLVER O DEFEITO MAIS CARO DO PRODUTO: o app
 * morria quando o bebê nascia.**
 *
 * Tudo aqui dentro era derivado de `lmp_date` — a semana, a bolha, a fruta, o
 * dia da jornada. É uma identidade com prazo de validade: no dia do parto,
 * `computeGestation` para de fazer sentido e a paciente vira uma conta sem
 * assunto. O pós-parto cobre doze semanas e depois acaba.
 *
 * Uma mãe usa aplicativo de bebê por ANOS. O que muda é o sujeito da frase:
 * ela deixa de ser "grávida de 28 semanas" e passa a ser "mãe da Helena, de 3
 * meses" — e, dois anos depois, "mãe de 2, grávida do terceiro".
 *
 * ⚠️ **POR ISSO O FILHO É LINHA, E NÃO CAMPO NO PERFIL.** Um `tem_bebe boolean`
 * ou um `qtd_filhos int` não sabem dizer QUEM, nem QUANDO, nem distinguir a
 * gestação de gêmeos de duas gestações seguidas. Cada filho é uma linha com
 * data própria, e é dela que sai tudo: gemelaridade, idade, ordem, e a frase.
 *
 * ⚠️ **NOME E SEXO SÃO OPCIONAIS, e isso não é preguiça de formulário.** Há
 * mulheres que não querem publicar o nome do bebê, há quem ainda não escolheu,
 * e há quem perdeu uma gestação e quer que aquele filho continue contando sem
 * ter que escrever o nome dele numa tela pública. "Mãe de 2" tem de ser
 * dizível sem nomear ninguém.
 */

/** Um filho — nascido ou a caminho. */
export type Filho = {
  id: string;
  /** Opcional: nem toda mãe quer publicar, e nem todo bebê já tem nome. */
  nome: string | null;
  /** Opcional. Só serve para a concordância ("gêmeas" em vez de "gêmeos"). */
  sexo: "f" | "m" | null;
  /** `YYYY-MM-DD`. Preenchido quando nasceu; `null` enquanto está a caminho. */
  nascidoEm: string | null;
  /** `YYYY-MM-DD` previsto. Só importa enquanto `nascidoEm` é `null`. */
  previstoPara: string | null;
};

/**
 * ⚠️ LÊ `YYYY-MM-DD` SEM PASSAR POR `new Date(string)`.
 *
 * `new Date("2026-08-24")` é interpretado como MEIA-NOITE UTC, e em São Paulo
 * isso é o dia 23 às 21h — um dia inteiro de erro em toda conta de idade. O
 * projeto já pagou esse erro na agenda e em `entao-e-agora.ts`.
 */
function emNumeros(dia: string): { a: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dia);
  if (!m) return null;
  return { a: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** Quantos meses inteiros de `de` até `ate`, contando pelo dia do mês. */
export function mesesEntre(de: string, ate: string): number | null {
  const a = emNumeros(de);
  const b = emNumeros(ate);
  if (!a || !b) return null;
  let meses = (b.a - a.a) * 12 + (b.m - a.m);
  /* Ainda não chegou o dia do mês: o mês não fechou. */
  if (b.d < a.d) meses -= 1;
  return meses;
}

/** Dias inteiros entre duas datas locais, sem passar por fuso. */
export function diasEntre(de: string, ate: string): number | null {
  const a = emNumeros(de);
  const b = emNumeros(ate);
  if (!a || !b) return null;
  const ua = Date.UTC(a.a, a.m - 1, a.d);
  const ub = Date.UTC(b.a, b.m - 1, b.d);
  return Math.floor((ub - ua) / 86400000);
}

/**
 * A idade do bebê em palavras.
 *
 * ⚠️ **A UNIDADE MUDA COM A IDADE, e isso é como as mães falam.** Ninguém diz
 * "meu filho tem 400 dias"; diz "1 ano e 1 mês". E ninguém diz "0 meses" para
 * um recém-nascido: diz "12 dias". A régua segue a fala, não a aritmética.
 */
export function idadeEmPalavras(nascidoEm: string, hoje: string): string | null {
  const dias = diasEntre(nascidoEm, hoje);
  if (dias === null || dias < 0) return null;
  if (dias === 0) return "recém-nascida";
  if (dias < 14) return `${dias} ${dias === 1 ? "dia" : "dias"}`;

  const meses = mesesEntre(nascidoEm, hoje) ?? 0;
  if (meses < 1) {
    const semanas = Math.floor(dias / 7);
    return `${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
  }
  if (meses < 24) return `${meses} ${meses === 1 ? "mês" : "meses"}`;

  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (resto === 0) return `${anos} anos`;
  return `${anos} anos e ${resto} ${resto === 1 ? "mês" : "meses"}`;
}

/** Os que ainda não nasceram. */
export function aCaminho(filhos: Filho[]): Filho[] {
  return filhos.filter((f) => !f.nascidoEm);
}

/** Os que já nasceram, do mais velho para o mais novo. */
export function jaNasceram(filhos: Filho[]): Filho[] {
  return filhos
    .filter((f) => !!f.nascidoEm)
    .sort((a, b) => (a.nascidoEm ?? "").localeCompare(b.nascidoEm ?? ""));
}

/**
 * A palavra para uma gestação múltipla.
 *
 * ⚠️ **A CONCORDÂNCIA SÓ VIRA FEMININA COM TODAS MENINAS.** Em português, o
 * plural masculino cobre o grupo misto e o desconhecido — "gêmeos" está certo
 * para um casal de gêmeos e para quem ainda não sabe o sexo. Escrever "gêmeas"
 * por engano numa gestação mista é errar o nome de um filho na cara da mãe.
 */
export function palavraDeMultiplos(quantos: number, sexos: Filho["sexo"][]): string | null {
  if (quantos < 2) return null;
  const todasMeninas = sexos.length === quantos && sexos.every((s) => s === "f");
  const a = todasMeninas ? "as" : "os";
  if (quantos === 2) return `gême${a}`;
  if (quantos === 3) return `trigême${a}`;
  if (quantos === 4) return `quadrigême${a}`;
  if (quantos === 5) return `quíntupl${todasMeninas ? "as" : "os"}`;
  return `${quantos} bebês`;
}

/**
 * A LINHA DO PERFIL — o que aparece embaixo do nome.
 *
 * ⚠️ **ELA É DERIVADA, NUNCA GUARDADA.** Texto salvo envelhece: "mãe de 1"
 * continuaria escrito depois do segundo filho, e "grávida de 30 semanas" viraria
 * mentira no dia seguinte ao parto. O que a mãe escreve à mão é a `bio`, que é
 * outro campo e não tem obrigação de ser verdade.
 *
 * ⚠️ **O CASO QUE OS APPS ERRAM É O ÚLTIMO: mãe COM filho E grávida.** É a
 * situação mais comum de todas depois do primeiro parto, e nenhum aplicativo de
 * gestação a representa — eles assumem que grávida é grávida de primeira viagem.
 */
export function linhaDoPerfil(filhos: Filho[], hoje: string): string | null {
  const vindo = aCaminho(filhos);
  const nascidos = jaNasceram(filhos);

  const gestando = (() => {
    if (vindo.length === 0) return null;
    if (vindo.length >= 2) {
      return `Grávida de ${palavraDeMultiplos(
        vindo.length,
        vindo.map((f) => f.sexo),
      )}`;
    }
    const nome = vindo[0].nome?.trim();
    return nome ? `Grávida ${daOuDo(vindo[0].sexo)} ${nome}` : "Grávida";
  })();

  const maternidade = (() => {
    if (nascidos.length === 0) return null;
    if (nascidos.length === 1) {
      const f = nascidos[0];
      const idade = f.nascidoEm ? idadeEmPalavras(f.nascidoEm, hoje) : null;
      const nome = f.nome?.trim();
      if (nome && idade) return `Mãe ${daOuDo(f.sexo)} ${nome}, ${idade}`;
      if (nome) return `Mãe ${daOuDo(f.sexo)} ${nome}`;
      return "Mãe de 1";
    }
    /* Com dois ou mais, o nome de cada um não cabe: o número é o que informa. */
    return `Mãe de ${nascidos.length}`;
  })();

  if (maternidade && gestando) {
    /* ⚠️ "grávida do segundo" conta o TOTAL, não só os nascidos: quem tem um
       filho e espera gêmeos está esperando o segundo E o terceiro. */
    const ordinal = ordem(nascidos.length + 1);
    if (vindo.length >= 2)
      return `${maternidade}, grávida de ${palavraDeMultiplos(
        vindo.length,
        vindo.map((f) => f.sexo),
      )}`;
    return `${maternidade}, grávida ${ordinal ? `${daOuDo(vindo[0].sexo)} ${ordinal}` : ""}`.trim();
  }
  return maternidade ?? gestando;
}

function daOuDo(sexo: Filho["sexo"]): string {
  return sexo === "f" ? "da" : "do";
}

/** "segundo", "terceiro"… e `null` acima do que vale a pena escrever por extenso. */
export function ordem(n: number): string | null {
  const nomes = [
    null,
    "primeiro",
    "segundo",
    "terceiro",
    "quarto",
    "quinto",
    "sexto",
    "sétimo",
    "oitavo",
    "nono",
    "décimo",
  ];
  return nomes[n] ?? null;
}

/** Está grávida agora? */
export function ehGestante(filhos: Filho[]): boolean {
  return aCaminho(filhos).length > 0;
}

/** Já é mãe de alguém que nasceu? */
export function ehMae(filhos: Filho[]): boolean {
  return jaNasceram(filhos).length > 0;
}

/**
 * A TURMA — o mês em que o bebê nasceu, como `YYYY-MM`.
 *
 * ⚠️ É o que faz a comunidade não morrer: "grávida de 30 semanas" dura uma
 * semana, "mãe da turma de agosto de 2026" dura a vida inteira. Quem pariu no
 * mesmo mês enfrenta a mesma coisa ao mesmo tempo, por anos — a primeira noite
 * inteira de sono, a creche, o primeiro passo.
 */
export function turmaDe(filho: Filho): string | null {
  if (!filho.nascidoEm) return null;
  const n = emNumeros(filho.nascidoEm);
  return n ? `${n.a}-${String(n.m).padStart(2, "0")}` : null;
}

/** "agosto de 2026", para mostrar na tela. */
export function turmaEmPalavras(turma: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(turma);
  if (!m) return null;
  const meses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const nome = meses[Number(m[2]) - 1];
  return nome ? `${nome} de ${m[1]}` : null;
}
