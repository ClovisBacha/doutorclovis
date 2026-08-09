/**
 * O prontuário da paciente, na tela do médico.
 *
 * O que existia no lugar disto era um desenho do bebê ocupando metade da altura
 * do modal, quatro etiquetas (semana, DPP, bpm, Premium) e o log do chatbot.
 * Nenhuma pressão, nenhum peso, nenhuma medicação, nenhuma alergia. Para saber
 * o peso de uma paciente o médico tinha de sair daqui, abrir a aba de
 * Engajamento — uma tela de MÉTRICA DE USO —, achar o nome numa lista sem busca
 * e clicar "ver relatório", que só mostrava os últimos catorze dias.
 *
 * A ordem aqui não é estética, é a ordem em que um obstetra pergunta:
 *
 *   1. quem é, quantas semanas e dias, e o que na história dela muda conduta
 *   2. o que está fora de faixa AGORA
 *   3. para onde os números estão indo (tendência, não último valor)
 *   4. o que aconteceu desde a última vez
 *
 * Idade gestacional em SEMANAS E DIAS de propósito. "32 semanas" é o que a tela
 * antiga mostrava, e em obstetrícia o dia decide: corticoide, viabilidade,
 * 36+6 contra 37+0 são condutas diferentes.
 */

import type { SecaoDoProntuario } from "@/lib/abas-da-paciente";
import {
  ESTILO_SINAL,
  baseDePressao,
  sinalGlicemia,
  sinalPressao,
  sinalPressaoComBase,
  type Gravidade,
} from "@/lib/sinais-clinicos";
import {
  mudancasDesde,
  serieDe,
  type Consulta,
  type EventoClinico,
  type FichaClinica,
  type Serie,
} from "@/lib/clinical.functions";
import { formataTelefone, linkTel } from "@/lib/telefone";
import { quando } from "@/lib/quando";
import { GraficoClinico, daSerie, seriesDePressao } from "./grafico-clinico";

function idadeGestacional(dias: number | null): string {
  if (dias == null || dias < 0) return "—";
  return `${Math.floor(dias / 7)}s${dias % 7}d`;
}

const ROTULO_ESPECIE: Record<string, string> = {
  medida: "Medida",
  sintoma: "Sintomas",
  emergencia: "SOS",
  exame: "Exame",
  contracao: "Contração",
  humor: "Humor",
  movimento: "Movimentos",
  consulta: "Pré-consulta",
  pergunta: "Pergunta",
};

/** Um número com a etiqueta da própria régua clínica. */
function Medida({
  rotulo,
  valor,
  gravidade,
  nota,
}: {
  rotulo: string;
  valor: string;
  gravidade?: Gravidade;
  nota?: string;
}) {
  /* A nota aparece SEMPRE que existe; a gravidade só decide a COR. Antes o
     bloco inteiro estava atrás de `gravidade !== "normal"`, então "+14 kg na
     gestação" — que o próprio código calcula e que é sinal de pré-eclâmpsia —
     era computado e jogado fora. */
  const alerta = gravidade && gravidade !== "normal";
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p className="mt-0.5 font-serif text-xl tabular-nums text-foreground">{valor}</p>
      {nota && (
        <span
          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            alerta ? ESTILO_SINAL[gravidade] : "bg-secondary text-muted-foreground"
          }`}
        >
          {nota}
        </span>
      )}
    </div>
  );
}

/**
 * Tendência em palavras, não em seta.
 *
 * Uma seta para cima ao lado de "+0,3 mmHg/semana" sugere alarme onde não há —
 * e o oposto, uma seta igual para +12, esconde o que importa. O texto diz o
 * número e deixa o médico julgar.
 */
function Tendencia({ s }: { s: Serie }) {
  if (s.ultimo == null) return null;
  const v = s.variacaoSemanal;
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {s.rotulo}
      </p>
      <p className="mt-0.5 font-serif text-xl tabular-nums text-foreground">
        {s.ultimo}
        <span className="ml-1 text-xs font-normal text-muted-foreground">{s.unidade}</span>
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
        {v == null
          ? `${s.pontos.length} ${s.pontos.length === 1 ? "registro" : "registros"} — poucos para tendência`
          : v === 0
            ? "estável nas últimas semanas"
            : `${v > 0 ? "+" : ""}${v} ${s.unidade}/semana`}
      </p>
      {s.pontos.length > 1 && <Faisca pontos={s.pontos} />}
    </div>
  );
}

/** Linha da série, sem eixo e sem legenda: serve para ver a FORMA. */
function Faisca({ pontos }: { pontos: { em: string; valor: number }[] }) {
  const ultimos = pontos.slice(-20);
  const vs = ultimos.map((p) => p.valor);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const faixa = max - min || 1;
  const d = ultimos
    .map((p, i) => {
      const x = (i / Math.max(1, ultimos.length - 1)) * 100;
      const y = 24 - ((p.valor - min) / faixa) * 20;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 28" className="mt-1.5 h-7 w-full" preserveAspectRatio="none" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx="100"
        cy={(24 - ((vs[vs.length - 1] - min) / faixa) * 20).toFixed(1)}
        r="2"
        fill="var(--primary)"
      />
    </svg>
  );
}

export function ProntuarioPaciente({
  ficha,
  eventos,
  carregando,
  incompleto,
  onRegistrarDesfecho,
  registrando,
  consultas = [],
  aoRegistrarConsulta,
  secoes,
}: {
  ficha: FichaClinica | null;
  eventos: EventoClinico[];
  carregando: boolean;
  /** Alguma fonte não pôde ser lida — a tela avisa em vez de fingir completude. */
  incompleto: boolean;
  onRegistrarDesfecho: (fonte: string, fonteId: string) => void;
  registrando: string | null;
  /** As consultas dela, mais recente primeiro. */
  consultas?: Consulta[];
  /** O formulário de registro. Vem por prop para o prontuário não precisar
      conhecer token nem server function — ele desenha, quem chama age. */
  aoRegistrarConsulta?: React.ReactNode;
  /**
   * Quais das cinco seções desenhar. Omitido = TODAS, que é o comportamento de
   * sempre — nenhuma tela existente muda por causa desta prop.
   *
   * Existe porque o cartão da paciente virou três abas e cada uma leva um
   * pedaço do prontuário. Um `secoes` em vez de três componentes separados
   * mantém UMA carga de dados: dividir o componente dividiria também as
   * chamadas ao servidor, e trocar de aba viraria uma espera.
   */
  secoes?: SecaoDoProntuario[];
}) {
  const mostra = (s: SecaoDoProntuario) => !secoes || secoes.includes(s);
  if (carregando) return <div className="skeleton h-72 rounded-3xl" />;
  if (!ficha) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Não consegui carregar a ficha desta paciente.
      </p>
    );
  }

  /* ORDEM EXPLÍCITA, e não a que o servidor por acaso mandou.
     `eventos.find(...)` para o par de pressão e `eventos[0]` para "quando foi o
     último registro" leem o PRIMEIRO elemento e chamam isso de "o mais
     recente" — o que só é verdade enquanto a lista chegar em ordem
     decrescente. Hoje chega; a garantia não estava escrita em lugar nenhum.

     É a mesma armadilha que fez `mudancasDesde` transformar +4,1 kg em +1,6 kg
     com o array invertido, e que já foi fechada lá com uma ordenação própria.
     Uma cópia do array custa nada e tira a tela da dependência. */
  const emOrdem = [...eventos].sort((a, b) => b.ocorrido_em.localeCompare(a.ocorrido_em));

  const pa = serieDe(eventos, "systolic", "Pressão (sistólica)", "mmHg");
  /* A diastólica NÃO tem série própria: ela só aparece emparelhada com a
     sistólica, e o par vem do mesmo evento (`seriesDePressao`). Uma `Serie`
     solta aqui seria o convite para alguém desenhá-la sozinha e reabrir o
     defeito de compor duas leituras de dias diferentes. */
  const peso = serieDe(eventos, "weight_kg", "Peso", "kg");
  const gli = serieDe(eventos, "glucose_mg_dl", "Glicemia", "mg/dL");

  /* O PAR VEM DO MESMO REGISTRO. Com duas séries independentes, uma sistólica
     de 168 medida na triagem de hoje casava com uma diastólica de 78 medida no
     diário de anteontem, e a tela exibia "168/78" com etiqueta de faixa grave —
     um dado clínico inventado pela composição de duas leituras. */
  const ultimaPA = emOrdem.find(
    (e) => e.dados.systolic != null && e.dados.diastolic != null,
  )?.dados;
  /* ─── A BASE DELA ────────────────────────────────────────────────────────
     As PRIMEIRAS medidas do acompanhamento, em ordem cronológica. `emOrdem`
     está do mais recente para o mais antigo (a linha do tempo lê assim), então
     inverter aqui é obrigatório — com a ordem trocada, a "base" seria a média
     das medidas MAIS RECENTES e a subida lenta arrastaria a própria referência.
     É a mesma armadilha que já transformou +4,1 kg em +1,6 kg nesta tela. */
  const base = baseDePressao(
    [...emOrdem]
      .reverse()
      .filter((e) => e.dados.systolic != null && e.dados.diastolic != null)
      .map((e) => ({
        sistolica: Number(e.dados.systolic),
        diastolica: Number(e.dados.diastolic),
      })),
  );
  const sinalPA = sinalPressaoComBase(ultimaPA?.systolic, ultimaPA?.diastolic, base);
  const sinalG = sinalGlicemia(gli.ultimo);

  const pendentes = eventos.filter((e) => e.gravidade !== "normal" && !e.tratado_em);
  const ganho =
    ficha.pesoPreGestacional != null && peso.ultimo != null
      ? Math.round((peso.ultimo - Number(ficha.pesoPreGestacional)) * 10) / 10
      : null;

  return (
    <div className="space-y-5">
      {incompleto && (
        <p className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-[12px] leading-snug text-amber-900">
          📡 Não consegui ler todos os registros dela. O que está abaixo pode estar incompleto —
          atualize antes de tomar uma decisão a partir desta tela.
        </p>
      )}

      {ficha.degradada && (
        <p className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-[12px] leading-snug text-amber-900">
          ⚠️ O banco ainda não tem as colunas do perfil completo. Alergias, medicações e a história
          de risco desta paciente estão <strong>desconhecidas</strong> aqui — não vazias. Aplique o
          SQL pendente antes de decidir a partir desta tela.
        </p>
      )}

      {/* 1. QUEM É — e o que na história dela muda conduta */}
      {mostra("quem") && (
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-serif text-2xl text-foreground">{ficha.nome ?? "Paciente"}</h3>
            <span className="font-serif text-lg tabular-nums text-primary">
              {idadeGestacional(ficha.gestDias)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            {ficha.dpp && <span>DPP {new Date(ficha.dpp).toLocaleDateString("pt-BR")}</span>}
            {ficha.gestacaoNumero != null && <span>{ficha.gestacaoNumero}ª gestação</span>}
            {ficha.tipoSanguineo && <span>Sangue {ficha.tipoSanguineo}</span>}
            {ficha.telefone && linkTel(ficha.telefone) && (
              <a href={linkTel(ficha.telefone)!} className="font-medium text-primary">
                {formataTelefone(ficha.telefone)}
              </a>
            )}
          </div>

          {/* Os quatro fatores que antes só a IA lia. */}
          {ficha.riscos.length > 0 && (
            <div className="mt-3 rounded-2xl bg-rose-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-700">
                História que muda conduta
              </p>
              <ul className="mt-1 space-y-0.5">
                {ficha.riscos.map((r) => (
                  <li key={r} className="text-[13px] leading-snug text-rose-900">
                    • {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(ficha.alergias || ficha.medicamentos) && (
            <div className="mt-3 space-y-1 text-[13px] leading-snug">
              {ficha.alergias && (
                <p>
                  <span className="text-muted-foreground">Alergias: </span>
                  <strong className="text-foreground">{ficha.alergias}</strong>
                </p>
              )}
              {ficha.medicamentos && (
                <p>
                  <span className="text-muted-foreground">Em uso: </span>
                  <strong className="text-foreground">{ficha.medicamentos}</strong>
                </p>
              )}
            </div>
          )}
          {ficha.observacoesPrevias && (
            <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
              {ficha.observacoesPrevias}
            </p>
          )}
        </div>
      )}

      {/* 2. O QUE MUDOU DESDE A ÚLTIMA VEZ QUE ELE A VIU.

          É a pergunta das 13h50, e a que o sistema não conseguia responder por
          falta de âncora. Vem ANTES dos números soltos porque um valor isolado
          não decide nada — o que decide é o que ele já sabia contra o que
          apareceu depois. */}
      {mostra("mudou") && (
        <>
          <MudancasDesdeAConsulta eventos={eventos} consultas={consultas} incompleto={incompleto} />
          {aoRegistrarConsulta}
        </>
      )}

      {/* 3. O QUE PEDE OLHAR AGORA */}
      {mostra("pendentes") && pendentes.length > 0 && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-4">
          <p className="text-sm font-bold text-rose-900">
            {pendentes.length === 1
              ? "1 registro fora de faixa sem desfecho"
              : `${pendentes.length} registros fora de faixa sem desfecho`}
          </p>
          <ul className="mt-2 space-y-2">
            {pendentes.slice(0, 6).map((e) => (
              <li
                key={`${e.fonte}-${e.fonte_id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {ROTULO_ESPECIE[e.especie] ?? e.especie} · {quando(e.ocorrido_em)}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-foreground">
                    {e.notas.join(" · ") || "Registro fora de faixa"}
                  </p>
                  {e.texto && (
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                      {e.texto}
                    </p>
                  )}
                </div>
                {/* "Já cuidei disto", não "li". Marcar como lido faz o item
                    sumir sem que nada tenha sido feito, e o próximo médico não
                    tem como saber se houve conduta. */}
                <button
                  onClick={() => onRegistrarDesfecho(e.fonte, e.fonte_id)}
                  disabled={registrando === `${e.fonte}:${e.fonte_id}`}
                  className="press shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-50"
                >
                  {registrando === `${e.fonte}:${e.fonte_id}` ? "…" : "Já cuidei"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 4. PARA ONDE OS NÚMEROS ESTÃO INDO */}
      {mostra("numeros") && (
        <div>
          <h4 className="font-serif text-lg text-foreground">Números dela</h4>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Informados por ela no app, não aferidos em consultório. Sem etiqueta significa dentro da
            faixa de referência ou sem registro — não é diagnóstico.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Medida
              rotulo="Última pressão"
              valor={ultimaPA ? `${ultimaPA.systolic}/${ultimaPA.diastolic}` : "—"}
              gravidade={sinalPA?.gravidade}
              nota={sinalPA?.nota}
            />
            <Medida
              rotulo="Última glicemia"
              valor={gli.ultimo != null ? `${gli.ultimo}` : "—"}
              gravidade={sinalG?.gravidade}
              nota={sinalG?.nota}
            />
            <Medida
              rotulo="Peso"
              valor={peso.ultimo != null ? `${peso.ultimo} kg` : "—"}
              nota={ganho != null ? `${ganho > 0 ? "+" : ""}${ganho} kg na gestação` : undefined}
              gravidade={ganho != null ? "normal" : undefined}
            />
            <Medida
              rotulo="Registros"
              valor={String(eventos.length)}
              nota={emOrdem.length ? quando(emOrdem[0].ocorrido_em) : undefined}
            />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Tendencia s={pa} />
            <Tendencia s={peso} />
            <Tendencia s={gli} />
          </div>

          {/* ─── E O DESENHO, QUE É OUTRA PERGUNTA ────────────────────────────
            Os três cartões acima respondem "como ela está": último valor e
            variação por semana. O gráfico responde "para onde isso está indo",
            que é o que o obstetra pergunta de verdade — peso subindo 200 g por
            semana e 900 g por semana têm o mesmo último peso na tela.

            Um gráfico POR MEDIDA, nunca dois eixos: pressão em mmHg e peso em
            kg no mesmo desenho exigiria duas escalas, e duas escalas fazem
            qualquer par de linhas parecer correlacionado. As duas linhas que
            dividem um gráfico aqui são sistólica e diastólica — mesma unidade.

            A gravidade do PONTO vem de `sinais-clinicos`, a mesma régua do app
            da paciente e da fila do painel. */}
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <GraficoClinico
              titulo="Pressão arterial"
              /* O par sai do MESMO evento — ver `seriesDePressao`. Duas séries
               independentes já casaram uma sistólica de hoje com uma diastólica
               de anteontem nesta tela. */
              series={seriesDePressao(
                eventos,
                (sis, dia) => sinalPressao(sis, dia)?.gravidade ?? null,
              )}
            />
            <GraficoClinico titulo="Peso" series={[daSerie(peso)]} />
            <GraficoClinico
              titulo="Glicemia"
              series={[
                daSerie(gli, (v) => sinalGlicemia(v)?.gravidade ?? null, { de: 70, ate: 99 }),
              ]}
            />
          </div>
        </div>
      )}

      {/* 5. O QUE ACONTECEU */}
      {mostra("linha") && (
        <div>
          <h4 className="font-serif text-lg text-foreground">Linha do tempo</h4>
          {eventos.length === 0 ? (
            <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-[13px] text-muted-foreground">
              Nenhum registro dela no período. Pode ser que ela ainda não use o app — vale combinar
              isso na próxima consulta.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {eventos.slice(0, 40).map((e) => (
                <li
                  key={`${e.fonte}-${e.fonte_id}`}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <span
                    aria-hidden
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      e.gravidade === "grave"
                        ? "bg-rose-500"
                        : e.gravidade === "atencao"
                          ? "bg-amber-500"
                          : "bg-muted-foreground/30"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      {ROTULO_ESPECIE[e.especie] ?? e.especie} · {quando(e.ocorrido_em)}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-foreground">{resumo(e)}</p>
                    {e.texto && (
                      <p className="mt-0.5 line-clamp-3 text-[12px] leading-snug text-muted-foreground">
                        {e.texto}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Uma linha que diz o que aconteceu, sem obrigar o médico a ler um objeto. */
function resumo(e: EventoClinico): string {
  const d = e.dados;
  const partes: string[] = [];
  if (d.systolic != null && d.diastolic != null) partes.push(`PA ${d.systolic}/${d.diastolic}`);
  if (d.glucose_mg_dl != null) {
    partes.push(`glicemia ${d.glucose_mg_dl}${d.momento ? ` (${d.momento})` : ""}`);
  }
  if (d.weight_kg != null) partes.push(`peso ${d.weight_kg} kg`);
  if (d.spo2 != null) partes.push(`SpO₂ ${d.spo2}%`);
  if (d.heart_rate_bpm != null) partes.push(`FC ${d.heart_rate_bpm} bpm`);
  if (d.sintomas?.length) partes.push(d.sintomas.join(", "));
  /* `nivel` CARREGA DOIS VOCABULÁRIOS. A view projeta na mesma chave o `level`
     de `triage_logs` (vermelho/amarelo/verde) e o de `epds_logs`
     (baixo/moderado/alto/urgente) — e isto imprimia "triagem urgente" para um
     rastreio de DEPRESSÃO, nome de outro instrumento. Um EPDS 21 com ideação
     de autoagressão aparecia no prontuário rotulado como triagem de sintomas.

     A gravidade em si sempre esteve certa (sai de `epds_q10`, não daqui); o que
     mentia era o rótulo. A fonte desempata. */
  if (d.nivel) {
    partes.push(e.fonte === "epds_logs" ? `rastreio ${d.nivel}` : `triagem ${d.nivel}`);
  }
  if (d.chutes != null) partes.push(`${d.chutes} movimentos`);
  if (d.intensidade != null) {
    partes.push(`intensidade ${d.intensidade}${d.duracao_seg ? ` · ${d.duracao_seg}s` : ""}`);
  }
  if (d.nome) partes.push(d.nome);
  if (d.humor) partes.push(`humor: ${d.humor}`);
  if (d.epds != null) partes.push(`EPDS ${d.epds}`);
  if (d.medicamentos) partes.push(`medicações: ${d.medicamentos}`);
  if (d.emocional) partes.push(`emocional: ${d.emocional}`);
  if (e.especie === "emergencia") partes.push("acionou o SOS");
  if (e.especie === "pergunta") partes.push(d.respondida ? "respondida" : "sem resposta");
  return partes.join(" · ") || (ROTULO_ESPECIE[e.especie] ?? "Registro");
}

/**
 * O bloco das 13h50.
 *
 * Um valor isolado não decide nada: o que decide é o que ele já sabia contra o
 * que apareceu depois. Sem consulta registrada, este bloco convida a registrar
 * a primeira — porque a alternativa (não mostrar nada) esconde que a
 * funcionalidade existe.
 */
function MudancasDesdeAConsulta({
  eventos,
  consultas,
  incompleto,
}: {
  eventos: EventoClinico[];
  consultas: Consulta[];
  /** A leitura dos registros dela falhou. Sem isto, "ela não registrou nada"
      era impresso como FATO em cima de uma consulta que não aconteceu. */
  incompleto: boolean;
}) {
  const ultima = consultas[0] ?? null;
  const m = mudancasDesde(eventos, ultima?.occurred_at ?? null, ultima?.weight_kg ?? null);

  if (!ultima) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/50 p-4">
        <p className="text-[13px] leading-snug text-muted-foreground">
          Nenhuma consulta registrada ainda. Ao registrar a primeira, esta área passa a mostrar{" "}
          <strong className="text-foreground">o que mudou desde então</strong> — pressões alteradas,
          episódios, perguntas sem resposta e variação de peso.
        </p>
      </div>
    );
  }

  const quandoFoi = new Date(ultima.occurred_at).toLocaleDateString("pt-BR");
  const nada =
    m.registros === 0 &&
    m.alteracoes.length === 0 &&
    m.episodios.length === 0 &&
    m.perguntasAbertas.length === 0;

  return (
    <div className="rounded-3xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-serif text-lg text-foreground">Desde a última consulta</h4>
        <span className="text-[11px] text-muted-foreground">
          {quandoFoi}
          {ultima.systolic != null && ultima.diastolic != null
            ? ` · PA aferida ${ultima.systolic}/${ultima.diastolic}`
            : ""}
          {ultima.weight_kg != null ? ` · ${ultima.weight_kg} kg` : ""}
        </span>
      </div>

      {ultima.conduta && (
        <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">Conduta de então: </span>
          {ultima.conduta}
        </p>
      )}

      {nada && incompleto ? (
        /* A LEITURA FALHOU — e isso não pode sair com cara de fato clínico.
           A prop existia, estava documentada e era passada pelo pai; o corpo do
           componente simplesmente nunca a lia, então a frase de baixo era
           impressa idêntica nos dois casos. O médico via "ela não registrou
           nada" e levava isso para dentro da consulta.

           Zero registro é informação (ela não abriu o app). Zero LEITURA é
           ausência de informação. Confundir os dois é o pior erro que uma tela
           clínica pode cometer, porque parece que ela está funcionando. */
        <p className="mt-2 rounded-2xl bg-amber-500/10 px-3 py-2 text-[13px] leading-snug text-amber-900 dark:text-amber-200">
          <strong>Não consegui ler os registros dela agora.</strong> Isto não quer dizer que ela não
          registrou nada — quer dizer que a leitura falhou. Recarregue antes de tirar conclusão.
        </p>
      ) : nada ? (
        <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
          Ela não registrou nada no app desde então. Vale combinar isso na consulta: sem registro, o
          acompanhamento entre as consultas fica cego.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Contador n={m.episodios.length} rot="episódios" grave />
          <Contador n={m.alteracoes.length} rot="fora de faixa" />
          <Contador n={m.perguntasAbertas.length} rot="perguntas sem resposta" />
          <Contador
            n={m.exames.length}
            rot="exames enviados"
            extra={
              m.deltaPeso != null
                ? `${m.deltaPeso > 0 ? "+" : ""}${m.deltaPeso} kg no período`
                : `${m.registros} registros`
            }
          />
        </div>
      )}

      {(m.episodios.length > 0 || m.alteracoes.length > 0) && (
        <ul className="mt-3 space-y-1">
          {[...m.episodios, ...m.alteracoes].slice(0, 5).map((e) => (
            <li key={`${e.fonte}-${e.fonte_id}`} className="text-[12.5px] leading-snug">
              <span className="text-muted-foreground">{quando(e.ocorrido_em)} · </span>
              <span className="text-foreground">{e.notas.join(" · ") || resumo(e)}</span>
            </li>
          ))}
        </ul>
      )}

      {m.perguntasAbertas.length > 0 && (
        <p className="mt-2 rounded-2xl bg-card px-3 py-2 text-[12.5px] leading-snug text-foreground">
          <span className="font-semibold">Ela perguntou e ainda não foi respondida: </span>
          {m.perguntasAbertas[0].texto}
        </p>
      )}
    </div>
  );
}

function Contador({
  n,
  rot,
  grave,
  extra,
}: {
  n: number;
  rot: string;
  grave?: boolean;
  extra?: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-2.5">
      <p
        className={`font-serif text-xl tabular-nums ${
          grave && n > 0 ? "text-rose-700" : "text-foreground"
        }`}
      >
        {n}
      </p>
      <p className="text-[10px] leading-tight text-muted-foreground">{rot}</p>
      {extra && <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{extra}</p>}
    </div>
  );
}
