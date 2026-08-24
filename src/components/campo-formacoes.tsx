/**
 * Formações por categoria, em vez de um bloco de texto livre.
 *
 * O campo antigo era um `textarea` com "uma linha por item". Funciona para quem
 * já sabe o que escrever, e para todos os outros produz duas falhas previsíveis:
 * ou fica vazio (é trabalho em branco, sem pista do que entra), ou vem "UFMG
 * 2010, residência no HC, mestrado" numa linha só — que a paciente lê como um
 * borrão e a busca por "medicina fetal" não acha.
 *
 * Com categorias, cada resposta é curta e o formato final sai sempre igual. E as
 * categorias são só ANDAIME: o que vai para o banco continua sendo uma coluna de
 * texto, uma linha por item. Se a lista mudar amanhã, o que já foi escrito
 * continua legível — que é o que importa para quem lê.
 *
 * Nada aqui é obrigatório. Elas ficam recolhidas atrás de "+ adicionar" para o
 * formulário não parecer um edital de onze campos.
 */

import { useState } from "react";
import { CATEGORIAS_FORMACAO } from "@/lib/medico-opcoes";

export function CampoFormacoes({
  valores,
  onChange,
  livre,
  onChangeLivre,
  classeInput,
  classeLabel,
}: {
  valores: Record<string, string>;
  onChange: (chave: string, v: string) => void;
  /** Descrição corrida do perfil — vai para `bio`, não para `education`. */
  livre: string;
  onChangeLivre: (v: string) => void;
  classeInput: string;
  classeLabel: string;
}) {
  /* Abertas: as que já têm conteúdo (perfil sendo editado) mais as três
     primeiras, que quase todo médico preenche. As outras entram por escolha. */
  const [abertas, setAbertas] = useState<Set<string>>(() => {
    const s = new Set<string>(CATEGORIAS_FORMACAO.slice(0, 3).map((c) => c.chave));
    for (const c of CATEGORIAS_FORMACAO) if ((valores[c.chave] ?? "").trim()) s.add(c.chave);
    return s;
  });
  const fechadas = CATEGORIAS_FORMACAO.filter((c) => !abertas.has(c.chave));

  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4">
      <p className={classeLabel}>Formações e títulos</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        Nada aqui é obrigatório — mas é o que a paciente lê para escolher entre dois nomes que ela
        não conhece. Preencha só o que quiser mostrar.
      </p>

      <div className="mt-3 space-y-3">
        {CATEGORIAS_FORMACAO.filter((c) => abertas.has(c.chave)).map((c) => (
          <div key={c.chave}>
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {c.rotulo}
            </label>
            <input
              value={valores[c.chave] ?? ""}
              onChange={(e) => onChange(c.chave, e.target.value)}
              placeholder={c.exemplo}
              className={classeInput}
            />
          </div>
        ))}
      </div>

      {fechadas.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Adicionar mais
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {fechadas.map((c) => (
              <button
                key={c.chave}
                type="button"
                onClick={() => setAbertas((s) => new Set(s).add(c.chave))}
                className="rounded-full border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary"
              >
                + {c.rotulo}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Texto corrido, separado das categorias de propósito: vai para `bio`,
          que é onde a paciente lê "quem é esse médico" no card. Misturar as duas
          coisas numa coluna só faria a lista de títulos virar parágrafo. */}
      <div className="mt-4">
        <label className={classeLabel}>Sobre você</label>
        <textarea
          value={livre}
          onChange={(e) => onChangeLivre(e.target.value)}
          rows={4}
          placeholder="Como você acompanha uma gestação, o que a paciente pode esperar de você, o que te trouxe para a obstetrícia. Escreva como falaria numa primeira consulta."
          className={classeInput}
        />
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Este texto aparece no seu card, abaixo do nome. É a parte que faz a paciente sentir que já
          te conhece um pouco.
        </p>
      </div>
    </div>
  );
}
