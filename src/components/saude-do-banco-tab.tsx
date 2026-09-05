import { useState } from "react";
import type { ArquivoConferido } from "@/lib/saude-do-banco.functions";

/**
 * ⚠️ QUAIS `APLICAR_*.sql` O BANCO AINDA NÃO RECEBEU.
 *
 * A tela do defeito que mais se repete neste repositório. O dono roda os SQL à
 * mão e o deploy chega antes; quando um arquivo fica para trás, **nada
 * quebra** — todo caminho tem degrau de recuo — e o recurso simplesmente não
 * existe, sem erro e sem log. Até aqui a única forma de descobrir era alguém
 * reparar que uma coisa não fazia nada.
 *
 * ⚠️ **Ela desenha, e não busca.** Quem chama passa o resultado — é o que
 * torna a bancada possível, e os três estados que mais importam (faltando ·
 * incerto · sem chave) não se fabricam num banco em dia.
 */
export function SaudeDoBancoTab({
  estado,
  conferidoEm,
  aoConferir,
  carregando,
}: {
  estado:
    | { t: "ok"; arquivos: ArquivoConferido[] }
    | { t: "sem_chave" }
    | { t: "falhou" }
    | { t: "nunca" };
  conferidoEm?: string;
  aoConferir: () => void;
  carregando: boolean;
}) {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  const botao = (
    <button
      type="button"
      onClick={aoConferir}
      disabled={carregando}
      className="min-h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      {carregando ? "Conferindo…" : "Conferir o banco agora"}
    </button>
  );

  if (estado.t !== "ok") {
    return (
      <div className="space-y-4">
        <Cabecalho />
        {estado.t === "sem_chave" && (
          /* ⚠️ Sem a chave de serviço a sonda mediria a RLS, e não o SCHEMA —
             uma tabela que existe e barra o anônimo apareceria como problema.
             Dizer isso é a única resposta honesta: um painel que não conseguiu
             conferir não pode se apresentar como verde. */
          <Aviso tom="ambar" titulo="Não dá para conferir sem a chave de serviço">
            Falta <code>SUPABASE_SERVICE_ROLE_KEY</code> no ambiente. Sem ela eu mediria a
            permissão, e não o formato do banco — e um verde falso aqui é pior que não ter a tela.
          </Aviso>
        )}
        {estado.t === "falhou" && (
          <Aviso tom="ambar" titulo="Não consegui conferir agora">
            Isso é a conexão com o banco, e não um problema do que já está aplicado.
          </Aviso>
        )}
        {estado.t === "nunca" && (
          <p className="text-sm text-muted-foreground">
            São {"~"}190 conferências, uma por tabela de cada arquivo. Leva alguns segundos.
          </p>
        )}
        {botao}
      </div>
    );
  }

  const faltando = estado.arquivos.filter((a) => a.estado === "faltando");
  const incertos = estado.arquivos.filter((a) => a.estado === "incerto");
  const aplicados = estado.arquivos.filter((a) => a.estado === "aplicado");

  return (
    <div className="space-y-5">
      <Cabecalho />

      <div className="flex flex-wrap items-center gap-3">
        {botao}
        {conferidoEm && (
          <span className="text-xs text-muted-foreground">
            Conferido às {new Date(conferidoEm).toLocaleTimeString("pt-BR")}
          </span>
        )}
      </div>

      {/* ⚠️ O que falta vem PRIMEIRO, e o que está aplicado fica recolhido: a
          tela existe para responder "o que eu preciso rodar?", e uma lista de
          54 verdes com dois vermelhos no meio não responde isso. */}
      {faltando.length === 0 && incertos.length === 0 ? (
        <Aviso tom="verde" titulo="Nada pendente">
          As {estado.arquivos.length} conferências passaram. Todo <code>APLICAR_*.sql</code> que o
          repositório conhece já está no banco.
        </Aviso>
      ) : null}

      {faltando.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold text-rose-700">
            {faltando.length} {faltando.length === 1 ? "arquivo falta" : "arquivos faltam"} rodar
          </h3>
          {/* ⚠️ A frase que importa: sem ela, um vermelho aqui parece um erro
              do app. O que ele quer dizer é que um recurso está DESLIGADO. */}
          <p className="text-sm text-muted-foreground">
            Nada disto quebra o app — os recursos que dependem destes arquivos simplesmente não
            existem para as pacientes até você rodá-los no Supabase.
          </p>
          {faltando.map((a) => (
            <Cartao
              key={a.arquivo}
              a={a}
              tom="rosa"
              aberto={!!abertos[a.arquivo]}
              aoAbrir={() => setAbertos((v) => ({ ...v, [a.arquivo]: !v[a.arquivo] }))}
            />
          ))}
        </section>
      )}

      {incertos.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold text-amber-700">{incertos.length} não consegui conferir</h3>
          {/* ⚠️ Nunca somado aos aplicados. */}
          <p className="text-sm text-muted-foreground">
            A sonda não respondeu — isto não quer dizer que está tudo certo, e nem que falta algo.
          </p>
          {incertos.map((a) => (
            <Cartao
              key={a.arquivo}
              a={a}
              tom="ambar"
              aberto={!!abertos[a.arquivo]}
              aoAbrir={() => setAbertos((v) => ({ ...v, [a.arquivo]: !v[a.arquivo] }))}
            />
          ))}
        </section>
      )}

      {aplicados.length > 0 && (
        <details className="rounded-2xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {aplicados.length} já aplicados
          </summary>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {aplicados.map((a) => (
              <li key={a.arquivo}>✅ {a.arquivo}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Cabecalho() {
  return (
    <div>
      <h2 className="font-serif text-xl">Saúde do banco</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Compara o que os arquivos <code>supabase/APLICAR_*.sql</code> prometem com o que o banco de
        fato tem.
      </p>
    </div>
  );
}

function Aviso({
  tom,
  titulo,
  children,
}: {
  tom: "ambar" | "verde";
  titulo: string;
  children: React.ReactNode;
}) {
  const cor =
    tom === "verde"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : "border-amber-300 bg-amber-50 text-amber-900";
  return (
    <div className={`rounded-2xl border p-4 ${cor}`}>
      <p className="font-semibold">{titulo}</p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}

function Cartao({
  a,
  tom,
  aberto,
  aoAbrir,
}: {
  a: ArquivoConferido;
  tom: "rosa" | "ambar";
  aberto: boolean;
  aoAbrir: () => void;
}) {
  const cor = tom === "rosa" ? "border-rose-300 bg-rose-50" : "border-amber-300 bg-amber-50";
  const ruins = a.alvos.filter((x) => x.estado !== "ok");
  return (
    <div className={`rounded-2xl border p-4 ${cor}`}>
      <button
        type="button"
        onClick={aoAbrir}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
      >
        <code className="text-sm font-semibold">{a.arquivo}</code>
        <span className="shrink-0 text-xs opacity-70">
          {ruins.length} de {a.alvos.length} {aberto ? "▲" : "▼"}
        </span>
      </button>
      {aberto && (
        <ul className="mt-3 space-y-1 text-sm">
          {ruins.map((x) => (
            <li key={x.tabela}>
              <code>{x.tabela}</code>
              {x.estado === "tabela_ausente" && " — a tabela não existe"}
              {x.estado === "coluna_ausente" && ` — faltam colunas: ${x.colunas.join(", ")}`}
              {x.estado === "erro" && ` — não consegui conferir (${x.detalhe ?? "sem detalhe"})`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
