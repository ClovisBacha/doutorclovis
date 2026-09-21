/**
 * A ABA DE CUSTO — o dinheiro que a IA consome, lido do que aconteceu.
 *
 * ⚠️ **TRÊS AVISOS SÃO OBRIGATÓRIOS NESTA TELA**, e cada um existe porque um
 * painel financeiro erra numa direção só que importa — PARA MENOS:
 *
 * 1. **`degradado`** — alguma leitura falhou. "Custo zero" é a leitura mais
 *    perigosa que este painel pode mostrar: parece lucro.
 * 2. **`truncado`** — o teto de linhas cortou o período. Um total incompleto
 *    apresentado como completo é o defeito que esta tela veio consertar.
 * 3. **`semPreco`** — chamadas cujo modelo não está na tabela. O custo delas
 *    NÃO está no total, e sem o aviso o painel some com uma fatia inteira em
 *    silêncio, justamente no dia em que alguém trocou o modelo.
 */
import { useEffect, useState } from "react";

import { adminToken, Bar, EmptyHint, Kpi, Panel } from "@/components/admin-ui";
import { emReais } from "@/lib/custo-da-plataforma";
import type { CustoDaPlataforma } from "@/lib/custo.functions";

const JANELAS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
] as const;

/** Um rótulo humano para o canal, sem inventar canal que não existe. */
const NOME_DO_CANAL: Record<string, string> = {
  app: "Conversa clínica (app)",
  suporte: "Dúvida sobre o app",
  site: "Visitante do site",
  diario: "Transcrição do diário",
};

const NOME_DA_ESPECIE: Record<string, string> = {
  chat: "Resposta lida pela paciente",
  memoria: "Resumo interno",
  embedding: "Indexação do cérebro",
};

/**
 * ⚠️ **A BANCADA INJETA O DADO NOS MESMOS `useState` DA PRODUÇÃO.**
 *
 * Os quatro estados que mais importam desta tela — leitura falhada, período
 * truncado, modelo sem preço e "nada no período" — só nascem de uma condição
 * do banco que não se fabrica numa conta de teste. Sem bancada eles ficariam
 * sem ninguém nunca ter olhado, que é como uma tela passa meses errada.
 */
export function CustoTab({ bancada }: { bancada?: CustoDaPlataforma | "falhou" } = {}) {
  const [d, setD] = useState<CustoDaPlataforma | null>(
    bancada && bancada !== "falhou" ? bancada : null,
  );
  const [dias, setDias] = useState<number>(30);
  const [carregando, setCarregando] = useState(!bancada);
  const [falhou, setFalhou] = useState(bancada === "falhou");
  const ehBancada = Boolean(bancada);

  useEffect(() => {
    /* ⚠️ Guardado por um BOOLEANO, e não pelo objeto: um literal remontado a
       cada render faria o efeito re-rodar em toda pintura. */
    if (ehBancada) return;
    let vivo = true;
    setCarregando(true);
    setFalhou(false);
    (async () => {
      try {
        const { custoDaPlataforma } = await import("@/lib/custo.functions");
        const r = await custoDaPlataforma({ data: { accessToken: await adminToken(), dias } });
        if (!vivo) return;
        if (r.ok) setD(r);
        else setFalhou(true);
      } catch {
        if (vivo) setFalhou(true);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [dias, ehBancada]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {JANELAS.map((j) => (
          <button
            key={j.dias}
            type="button"
            onClick={() => setDias(j.dias)}
            className={`min-h-11 rounded-full px-4 text-sm font-medium transition ${
              dias === j.dias
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {j.rotulo}
          </button>
        ))}
      </div>

      {/* ⚠️ Estado de CARREGANDO explícito: sem ele a tela fica idêntica entre o
          toque e a resposta, e isso lê como "travou" — o defeito que o dono
          relatou no perfil da rede. */}
      {carregando && !d && <EmptyHint>Somando as chamadas do período…</EmptyHint>}

      {falhou && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Não foi possível ler o uso agora. <strong>Isto não quer dizer custo zero</strong> — quer
          dizer que a leitura falhou. Tente de novo.
        </div>
      )}

      {d && (
        <>
          {d.degradado && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              ⚠️ Uma das leituras falhou. Os números abaixo estão{" "}
              <strong>incompletos para menos</strong> — o custo real é maior.
            </div>
          )}
          {d.truncado && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              ⚠️ O período tem mais chamadas do que o teto de leitura. O total mostra{" "}
              <strong>só as mais recentes</strong>; escolha uma janela menor para um número fechado.
            </div>
          )}

          <Panel
            title="Custo de IA"
            subtitle={`Somado dos tokens que aconteceram — não é estimativa. Preço conferido em ${d.precoConferidoEm}, dólar a ${d.dolar.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`}
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi
                label={`Custo (${d.dias} dias)`}
                value={emReais(d.resumo.centavos)}
                tone="amber"
              />
              <Kpi label="Chamadas" value={d.resumo.chamadas.toLocaleString("pt-BR")} tone="sky" />
              <Kpi
                label="Custo do mês"
                value={emReais(d.custoDoMesAteAgoraCentavos)}
                tone="primary"
              />
              <Kpi
                label="Projeção do mês"
                value={d.projecaoDoMesCentavos === null ? "—" : emReais(d.projecaoDoMesCentavos)}
                tone="emerald"
                hint={
                  d.projecaoDoMesCentavos === null
                    ? "cedo demais no mês para projetar"
                    : "regra de três sobre os dias corridos"
                }
              />
            </div>

            {/* ⚠️ O aviso de modelo sem preço vem GRUDADO no total, e não num
                rodapé: ele muda o significado do número acima dele. */}
            {d.resumo.semPreco > 0 && (
              <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                ⚠️ <strong>{d.resumo.semPreco.toLocaleString("pt-BR")}</strong> chamada
                {d.resumo.semPreco === 1 ? "" : "s"} de modelo sem preço cadastrado —{" "}
                <strong>
                  {d.resumo.semPreco === 1 ? "o custo dela não está" : "o custo delas não está"} no
                  total acima
                </strong>
                . Cadastre em <code className="rounded bg-muted px-1">custo-da-plataforma.ts</code>:{" "}
                {d.resumo.modelosSemPreco.join(", ")}
              </div>
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              {d.resumo.tokensEntrada.toLocaleString("pt-BR")} tokens de entrada ·{" "}
              {d.resumo.tokensSaida.toLocaleString("pt-BR")} de saída. A saída custa muito mais que
              a entrada — respostas longas são as caras.
            </p>
          </Panel>

          <Panel title="Por onde o dinheiro sai" subtitle="Qual parte do app consome, e quanto.">
            {d.resumo.porCanal.length === 0 ? (
              <EmptyHint>Nenhuma chamada de IA no período.</EmptyHint>
            ) : (
              <div className="space-y-2">
                {d.resumo.porCanal.map((c) => (
                  <Bar
                    key={c.chave}
                    label={NOME_DO_CANAL[c.chave] ?? c.chave}
                    value={c.centavos}
                    max={d.resumo.porCanal[0].centavos || 1}
                    caption={`${emReais(c.centavos)} · ${c.chamadas.toLocaleString("pt-BR")} chamadas`}
                    tone="amber"
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Por espécie" subtitle="O que a paciente lê vs. o que roda por dentro.">
            {d.resumo.porEspecie.length === 0 ? (
              <EmptyHint>Nada no período.</EmptyHint>
            ) : (
              <div className="space-y-2">
                {d.resumo.porEspecie.map((c) => (
                  <Bar
                    key={c.chave}
                    label={NOME_DA_ESPECIE[c.chave] ?? c.chave}
                    value={c.centavos}
                    max={d.resumo.porEspecie[0].centavos || 1}
                    caption={`${emReais(c.centavos)} · ${c.chamadas.toLocaleString("pt-BR")} chamadas`}
                    tone="sky"
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Por modelo" subtitle="Trocar de modelo é a alavanca mais direta do custo.">
            {d.resumo.porModelo.length === 0 ? (
              <EmptyHint>Nada no período.</EmptyHint>
            ) : (
              <div className="space-y-2">
                {d.resumo.porModelo.map((c) => (
                  <Bar
                    key={c.chave}
                    label={c.chave}
                    value={c.centavos}
                    max={d.resumo.porModelo[0].centavos || 1}
                    caption={`${emReais(c.centavos)} · ${c.tokens.toLocaleString("pt-BR")} tokens`}
                    tone="primary"
                  />
                ))}
              </div>
            )}
          </Panel>

          {d.porMedico.length > 0 && (
            <Panel
              title="Quem mais consome"
              subtitle="Os cinco médicos com maior custo de IA no período."
            >
              <div className="space-y-2">
                {d.porMedico.map((m) => (
                  <Bar
                    key={m.nome}
                    label={m.nome}
                    value={m.centavos}
                    max={d.porMedico[0].centavos || 1}
                    caption={`${emReais(m.centavos)} · ${m.chamadas.toLocaleString("pt-BR")} chamadas`}
                    tone="emerald"
                  />
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
