/**
 * Quanto do perfil está pronto — e o que cada campo faltando CUSTA.
 *
 * Uma barra de porcentagem sozinha é decoração: ela informa que falta algo e
 * não dá motivo para preencher. O que move é a consequência. "Faltam as
 * formações" é cobrança; "sem formações você aparece abaixo de quem preencheu,
 * e é o que a paciente lê para escolher entre dois nomes que ela não conhece" é
 * uma razão.
 *
 * Por isso cada item traz `efeito` em vez de só o nome do campo, e a ordem é por
 * impacto real na paciente — não pela ordem do formulário.
 */

export type ItemPerfil = {
  chave: string;
  rotulo: string;
  /** O que muda para ele quando este campo existe. */
  efeito: string;
  pronto: boolean;
  /** Peso na barra: nem todo campo vale o mesmo. */
  peso: number;
};

export function itensDoPerfil(p: {
  display_name?: string | null;
  crm?: string | null;
  whatsapp?: string | null;
  education?: string | null;
  bio?: string | null;
  specialty?: string | null;
  accepts_insurance?: boolean | null;
  accepts_private?: boolean | null;
  insurances?: string | null;
  precoCentavos?: number | null;
  temEndereco?: boolean;
  temFoto?: boolean;
}): ItemPerfil[] {
  const cheio = (v?: string | null) => !!(v ?? "").trim();
  return [
    {
      chave: "whatsapp",
      rotulo: "Telefone para pacientes",
      efeito: "Sem ele você não aparece na busca — é o número que o botão SOS delas disca.",
      pronto: (p.whatsapp ?? "").replace(/\D/g, "").length >= 10,
      peso: 3,
    },
    {
      chave: "crm",
      rotulo: "CRM",
      efeito: "Vai impresso na carteirinha que ela mostra no hospital.",
      pronto: /[A-Za-z]{2}/.test(p.crm ?? "") && (p.crm ?? "").replace(/\D/g, "").length >= 3,
      peso: 3,
    },
    {
      chave: "specialty",
      rotulo: "Especialidade / foco",
      efeito: "É por aqui que ela te encontra: ela busca pelo problema dela.",
      pronto: cheio(p.specialty),
      peso: 2,
    },
    {
      chave: "atendimento",
      rotulo: "Convênio ou particular",
      efeito: "É a primeira pergunta dela, antes até do preço.",
      pronto: !!p.accepts_insurance || !!p.accepts_private,
      peso: 2,
    },
    {
      chave: "preco",
      rotulo: "Valor da consulta",
      efeito: "Card sem valor faz ela voltar para a lista em vez de pedir consulta.",
      pronto: !p.accepts_private || !!(p.precoCentavos && p.precoCentavos > 0),
      peso: 2,
    },
    {
      chave: "convenios",
      rotulo: "Quais convênios",
      efeito: "“Aceito convênio” sem a lista não responde se o plano dela serve.",
      pronto: !p.accepts_insurance || cheio(p.insurances),
      peso: 1,
    },
    {
      chave: "endereco",
      rotulo: "Endereço do consultório",
      efeito: "Ela precisa saber para onde ir — e é o que ordena a busca por proximidade.",
      pronto: p.temEndereco !== false,
      peso: 2,
    },
    {
      chave: "education",
      rotulo: "Formações",
      efeito: "É o que decide entre você e outro nome que ela também não conhece.",
      pronto: cheio(p.education),
      peso: 2,
    },
    {
      chave: "bio",
      rotulo: "Sobre você",
      efeito: "A parte que faz ela sentir que já te conhece um pouco.",
      pronto: (p.bio ?? "").trim().length >= 40,
      peso: 1,
    },
    {
      chave: "foto",
      rotulo: "Sua foto",
      efeito: "Um rosto é a maior diferença isolada entre dois cards.",
      pronto: !!p.temFoto,
      peso: 2,
    },
  ];
}

export function PerfilProgresso({
  itens,
  compacto,
}: {
  itens: ItemPerfil[];
  /** No cadastro a lista inteira é ruído: mostra só a barra e o próximo passo. */
  compacto?: boolean;
}) {
  const total = itens.reduce((s, i) => s + i.peso, 0);
  const feito = itens.reduce((s, i) => s + (i.pronto ? i.peso : 0), 0);
  const pct = total ? Math.round((feito / total) * 100) : 0;
  const faltando = itens.filter((i) => !i.pronto);
  const completo = faltando.length === 0;

  return (
    <div className="rounded-2xl border border-border bg-background/50 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">
          {completo ? "Perfil completo 🎉" : `Perfil ${pct}% pronto`}
        </p>
        {!completo && (
          <span className="text-xs text-muted-foreground">
            {faltando.length} {faltando.length === 1 ? "item" : "itens"}
          </span>
        )}
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            completo ? "bg-emerald-500" : pct >= 60 ? "bg-primary" : "bg-amber-500"
          }`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>

      {completo ? (
        <p className="mt-2 text-xs leading-snug text-muted-foreground">
          Nada a preencher. Você aparece na busca com tudo o que a paciente quer saber.
        </p>
      ) : compacto ? (
        /* No cadastro, um passo por vez: a lista inteira de pendências antes de
           terminar o formulário desanima em vez de guiar. */
        <p className="mt-2 text-xs leading-snug text-muted-foreground">
          <strong className="text-foreground">{faltando[0].rotulo}</strong> — {faltando[0].efeito}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {faltando.map((i) => (
            <li key={i.chave} className="text-xs leading-snug">
              <span className="font-semibold text-foreground">{i.rotulo}</span>
              <span className="text-muted-foreground"> — {i.efeito}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
