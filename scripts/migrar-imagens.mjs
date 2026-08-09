#!/usr/bin/env node
/**
 * BACKFILL: base64 no Postgres → arquivo no Storage.
 *
 * ─── POR QUE SÃO DUAS PASSADAS ──────────────────────────────────────────────
 *
 * A tentação é fazer tudo de uma vez: sobe o arquivo, grava o caminho e zera o
 * base64 no mesmo UPDATE. Não faço isso, e o motivo é o conteúdo — laudo de
 * exame de gestante. Se o caminho gravado estiver errado por qualquer motivo
 * (upload que devolveu OK mas gravou noutro lugar, balde trocado, corrida com
 * outro processo), o base64 já foi embora e a imagem não existe em lugar
 * nenhum. Não há desfazer.
 *
 * Então:
 *
 *   passada 1 (subir)  — sobe o arquivo e grava `image_path`. `image_data`
 *                        CONTINUA lá. Nada se perde; no pior caso sobra um
 *                        arquivo órfão no balde, que custa centavos.
 *   passada 2 (limpar) — para cada linha com caminho, BAIXA o arquivo e
 *                        confere que ele abre e tem o tamanho esperado. Só
 *                        então zera o `image_data`.
 *
 * A passada 2 é a que devolve o espaço, e ela só apaga o que conseguiu ler de
 * volta. Rodar as duas com dias de intervalo é ainda melhor.
 *
 * ─── COMO RODAR ─────────────────────────────────────────────────────────────
 *
 *   node scripts/migrar-imagens.mjs subir            # seguro, não apaga nada
 *   node scripts/migrar-imagens.mjs subir --tabela=exam_files
 *   node scripts/migrar-imagens.mjs limpar --confirmar
 *   node scripts/migrar-imagens.mjs status
 *
 * `limpar` EXIGE `--confirmar`. Sem a flag ele só mostra o que faria — porque
 * um comando que apaga dado de paciente não pode ser algo que se dispara por
 * engano ao apertar seta-para-cima no terminal.
 *
 * Precisa de SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (.env).
 * A chave de serviço NUNCA vai para o repositório — ver .gitignore.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

/** MESMA derivação de `src/lib/imagens.server.ts`. O caminho não pode carregar
    o uuid de auth.users: ele entra na URL assinada, e a do álbum vai para a
    tag <img> de quem tem o link do convite. */
const pastaDoDono = (id) => createHash("sha256").update(String(id)).digest("hex").slice(0, 32);

// ── Ambiente ────────────────────────────────────────────────────────────────
if (existsSync(".env")) {
  for (const linha of readFileSync(".env", "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(linha);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !CHAVE) {
  console.error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ponha no .env).");
  process.exit(1);
}
const sb = createClient(URL, CHAVE, { auth: { persistSession: false } });

// ── As duas tabelas ─────────────────────────────────────────────────────────
const TABELAS = {
  exam_files: { balde: "exames", dono: "user_id" },
  family_album_posts: { balde: "album", dono: "patient_user_id" },
};

/** Quantas linhas por vez. Baixo de propósito: cada linha carrega um JPEG
    inteiro na memória, e o objetivo é terminar, não ser rápido. */
const LOTE = 25;

function decodificar(dataUrl) {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(String(dataUrl).trim());
  if (!m) return null;
  const bin = Buffer.from(m[2], "base64");
  if (bin.length === 0) return null;
  const tipo = m[1].toLowerCase();
  const extensao =
    tipo === "image/png"
      ? "png"
      : tipo === "image/webp"
        ? "webp"
        : tipo === "image/gif"
          ? "gif"
          : "jpg";
  return { bytes: bin, tipo, extensao };
}

async function status() {
  for (const [tabela] of Object.entries(TABELAS)) {
    const { count: faltam, error: e1 } = await sb
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .is("image_path", null)
      .not("image_data", "is", null);
    const { count: migradas } = await sb
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .not("image_path", "is", null);
    const { count: aLimpar } = await sb
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .not("image_path", "is", null)
      .not("image_data", "is", null);
    if (e1) {
      console.log(`${tabela}: NÃO CONSULTÁVEL — ${e1.message}`);
      continue;
    }
    console.log(
      `${tabela}: ${faltam ?? 0} por subir · ${migradas ?? 0} com caminho · ${aLimpar ?? 0} ainda ocupando base64`,
    );
  }
}

async function subir(sóTabela) {
  for (const [tabela, cfg] of Object.entries(TABELAS)) {
    if (sóTabela && tabela !== sóTabela) continue;
    let feitas = 0;
    let falhas = 0;
    let pulados = 0;
    /**
     * ─── POR QUE UM CONJUNTO DE JÁ-TENTADOS ─────────────────────────────────
     *
     * O laço relê SEMPRE o mesmo filtro (`image_path is null`). Uma linha que
     * não foi atualizada volta na página seguinte — e se a falha for sistêmica
     * (balde ainda não criado, que é justamente o cenário que todo o desenho de
     * recuo existe para cobrir; chave sem permissão de Storage; quota), o script
     * gira para sempre nas mesmas 25 linhas, imprimindo erro sem avançar.
     *
     * Guardar os ids já tentados nesta rodada transforma isso em "nada novo
     * nesta página → terminei", que é o comportamento certo: ele para, informa,
     * e a próxima execução tenta de novo do começo.
     */
    /**
     * ─── CURSOR POR `id`, E NÃO UM CONJUNTO DE JÁ-TENTADOS ──────────────────
     *
     * A primeira tentativa de consertar o laço infinito guardava os ids já
     * tentados e parava quando a página não trazia nada novo. Isso trocou um
     * defeito por outro, e a revisão adversarial pegou: PDFs nunca são
     * marcados, então voltam sempre. Bastavam 25 deles (um lote) para a
     * PRIMEIRA página ser toda de PDF — a segunda repetia os mesmos 25, `novas`
     * dava zero, e o script encerrava anunciando que terminou, sem nunca ter
     * chegado às imagens que vinham depois.
     *
     * Um cursor crescente por `id` avança de verdade: o que foi pulado fica
     * para trás e não bloqueia o resto.
     */
    let cursor = "00000000-0000-0000-0000-000000000000";
    for (;;) {
      const { data: linhas, error } = await sb
        .from(tabela)
        .select(`id, ${cfg.dono}, image_data`)
        .is("image_path", null)
        .not("image_data", "is", null)
        .gt("id", cursor)
        .order("id", { ascending: true })
        .limit(LOTE);
      if (error) {
        console.error(`${tabela}: ${error.message}`);
        break;
      }
      if (!linhas || linhas.length === 0) break;
      cursor = linhas[linhas.length - 1].id;

      for (const linha of linhas) {
        const img = decodificar(linha.image_data);
        if (!img) {
          /* ─── NÃO MARCA NADA ──────────────────────────────────────────────
           *
           * A versão anterior gravava `image_path: ""` para tirar a linha do
           * filtro. Isso EXCLUÍA o registro da migração para sempre — e o caso
           * mais comum aqui é o laudo em PDF, que o produto aceita de
           * propósito, que todo laboratório entrega, e que é o arquivo MAIS
           * PESADO da tabela (~4 MB): exatamente o alvo principal da economia.
           *
           * PDF continua em base64 hoje por uma razão de TELA, não de
           * armazenamento: os visualizadores decidem entre `<object>` e `<img>`
           * pelo prefixo `data:application/pdf`, e uma URL assinada não carrega
           * essa informação. Migrá-lo sem mexer na exibição quebraria a leitura
           * do laudo — e essa é a única coisa pior que gastar disco.
           *
           * Então: pula, conta, e deixa a linha intacta para o dia em que a
           * tela souber lidar com isso. */
          pulados++;
          continue;
        }
        const caminho = `${pastaDoDono(linha[cfg.dono])}/${crypto.randomUUID()}.${img.extensao}`;
        const { error: eUp } = await sb.storage
          .from(cfg.balde)
          .upload(caminho, img.bytes, { contentType: img.tipo, upsert: false });
        if (eUp) {
          console.error(`  ${linha.id}: upload falhou — ${eUp.message}`);
          falhas++;
          continue;
        }
        /* `image_data` permanece. Ver o cabeçalho: esta passada não apaga. */
        const { error: eUpd } = await sb
          .from(tabela)
          .update({ image_path: caminho })
          .eq("id", linha.id);
        if (eUpd) {
          console.error(`  ${linha.id}: caminho não gravou — ${eUpd.message}`);
          /* Apaga o arquivo que acabou de subir: sem a linha apontando para
             ele, é órfão puro, e na próxima rodada subiríamos outro. */
          await sb.storage.from(cfg.balde).remove([caminho]);
          falhas++;
          continue;
        }
        feitas++;
      }
      process.stdout.write(`\r${tabela}: ${feitas} subidas, ${falhas} falhas, ${pulados} pulados…`);
    }
    console.log(
      `\r${tabela}: ${feitas} subidas, ${falhas} falhas, ${pulados} pulados (PDF e afins).        `,
    );
  }
}

async function limpar(confirmar, sóTabela) {
  for (const [tabela, cfg] of Object.entries(TABELAS)) {
    /* `--tabela` era ACEITO e VALIDADO na entrada, respeitado por `subir` e
       ignorado aqui — no único comando que APAGA. Quem migrou só exam_files e
       rodava `limpar --tabela=exam_files --confirmar` acreditando estar
       restrito disparava também a limpeza do álbum. */
    if (sóTabela && tabela !== sóTabela) continue;
    let limpas = 0;
    let recusadas = 0;
    for (;;) {
      const { data: linhas, error } = await sb
        .from(tabela)
        .select("id, image_path, image_data")
        .not("image_path", "is", null)
        .not("image_data", "is", null)
        .limit(LOTE);
      if (error) {
        console.error(`${tabela}: ${error.message}`);
        break;
      }
      if (!linhas || linhas.length === 0) break;

      let mexeuNesteLote = false;
      for (const linha of linhas) {
        const caminho = String(linha.image_path || "").trim();
        if (!caminho) {
          recusadas++;
          continue;
        }
        /* A CONFERÊNCIA: baixa de volta e compara o tamanho com o que o base64
           decodifica. É o que separa "gravei um caminho" de "o arquivo está
           lá e é este". Sem ela, esta passada seria uma exclusão às cegas. */
        const { data: arq, error: eDown } = await sb.storage.from(cfg.balde).download(caminho);
        if (eDown || !arq) {
          console.error(
            `  ${linha.id}: não baixou (${eDown?.message ?? "vazio"}) — mantendo base64`,
          );
          recusadas++;
          continue;
        }
        const original = decodificar(linha.image_data);
        const baixado = Buffer.from(await arq.arrayBuffer());
        if (!original || baixado.length !== original.bytes.length) {
          console.error(`  ${linha.id}: tamanho não bate — mantendo base64`);
          recusadas++;
          continue;
        }
        if (!confirmar) {
          limpas++;
          continue;
        }
        const { error: eUpd } = await sb
          .from(tabela)
          .update({ image_data: null })
          .eq("id", linha.id);
        if (eUpd) {
          console.error(`  ${linha.id}: ${eUpd.message}`);
          recusadas++;
          continue;
        }
        limpas++;
        mexeuNesteLote = true;
      }
      /* Sem `--confirmar` nada muda no banco, então a mesma página voltaria
         para sempre. Também paro se um lote inteiro foi recusado. */
      if (!confirmar || !mexeuNesteLote) break;
    }
    console.log(
      confirmar
        ? `${tabela}: ${limpas} linhas liberadas, ${recusadas} mantidas por precaução.`
        : `${tabela}: ${limpas} linhas ESTARIAM prontas para liberar, ${recusadas} não. (ensaio — use --confirmar)`,
    );
  }
  if (confirmar) {
    console.log("\nO disco só desce de fato depois do VACUUM FULL — ver o rodapé de");
    console.log("supabase/APLICAR_IMAGENS_NO_STORAGE.sql. Ele TRAVA a tabela: faça de madrugada.");
  }
}

// ── Entrada ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const comando = args[0] || "status";
const sóTabela = (args.find((a) => a.startsWith("--tabela=")) || "").split("=")[1] || null;
const confirmar = args.includes("--confirmar");

if (sóTabela && !TABELAS[sóTabela]) {
  console.error(`--tabela precisa ser ${Object.keys(TABELAS).join(" ou ")}`);
  process.exit(1);
}

if (comando === "status") await status();
else if (comando === "subir") await subir(sóTabela);
else if (comando === "limpar") await limpar(confirmar, sóTabela);
else {
  console.error("Comandos: status | subir | limpar --confirmar");
  process.exit(1);
}
