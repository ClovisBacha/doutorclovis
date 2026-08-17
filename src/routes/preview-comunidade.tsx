/**
 * BANCADA DA COMUNIDADE — a aba nova sem conta e sem banco.
 *
 * Sem ela, conferir o pódio do bolão exigiria uma gestação de verdade chegando
 * ao fim, com meia dúzia de amigas reais tendo palpitado antes. É exatamente
 * assim que uma tela passa meses sem ninguém nunca ter olhado para ela — foi o
 * que aconteceu com a entrega do presente do médico.
 *
 * ⚠️ **A bancada fabrica os DADOS, nunca o desenho.** Ela monta a lista de
 * palpites e o resultado; quem calcula pontos, ordena o ranking e desenha o
 * troféu é a tela de verdade, com a mesma função pura (`ranking`) que o
 * servidor usa.
 *
 * Endereços:
 *   /preview-comunidade                → bolão aberto, cinco palpites
 *   /preview-comunidade?fechado=1      → o bebê nasceu, com pódio
 *   /preview-comunidade?vazio=1        → ninguém palpitou ainda
 *   /preview-comunidade?luto=1         → Modo Cuidado (sem bolão, sem "nome")
 */
import { createFileRoute } from "@tanstack/react-router";
import { ComunidadeTab } from "@/components/comunidade";
import type { BolaoNaTela } from "@/lib/bolao.functions";

export const Route = createFileRoute("/preview-comunidade")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `q.x == null` e NÃO `=== undefined`: o router serializa e revalida, e
       na segunda passada chega `null`. Com o `===`, abrir sem parâmetro
       terminaria em `?fechado=0`. É a mesma armadilha que `preview-saude` e
       `preview-jogo` documentam. */
    fechado: q.fechado == null ? false : !!q.fechado,
    vazio: q.vazio == null ? false : !!q.vazio,
    luto: q.luto == null ? false : !!q.luto,
  }),
});

const PALPITES = [
  { autorId: "a1", autorNome: "Vó Ana", dia: "2026-09-08", pesoGramas: 3200, horaMinutos: 6 * 60 },
  {
    autorId: "a2",
    autorNome: "Marina",
    dia: "2026-09-10",
    pesoGramas: 3400,
    horaMinutos: 9 * 60 + 5,
  },
  { autorId: "a3", autorNome: "Tio Beto", dia: "2026-09-15", pesoGramas: 4200, horaMinutos: null },
  { autorId: "a4", autorNome: "Carol", dia: "2026-09-11", pesoGramas: 3450, horaMinutos: 22 * 60 },
  /* O último é o MEU: é ele que faz o formulário abrir preenchido e o botão
     dizer "Corrigir", que é o estado que a régua de edição existe para ter. */
  {
    autorId: "eu",
    autorNome: "Eu",
    dia: "2026-09-12",
    pesoGramas: 3550,
    horaMinutos: 3 * 60 + 40,
    meu: true,
  },
];

function Bancada() {
  const { fechado, vazio, luto } = Route.useSearch();

  const bolao: BolaoNaTela = {
    donaId: "eu",
    donaNome: "Marina",
    bebeNome: "Helena",
    dpp: "2026-09-10",
    palpites: vazio ? [] : PALPITES.map((p) => ({ ...p, meu: !!(p as { meu?: boolean }).meu })),
    /* 09/09 às 23h55: a data cai um dia antes do palpite certeiro E a hora fica
       colada na meia-noite — é o caso que prova a distância CIRCULAR da hora,
       que sem ela daria zero a quem chutou 03h40. */
    resultado: fechado ? { dia: "2026-09-09", pesoGramas: 3380, horaMinutos: 23 * 60 + 55 } : null,
    souADona: true,
  };

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <ComunidadeTab
        donaId="eu"
        careMode={luto}
        onAbrir={(d, s) => alert(`abriria: ${d}${s ? ` → ${s}` : ""}`)}
        bancadaDoBolao={{ bolao }}
      />
    </div>
  );
}
