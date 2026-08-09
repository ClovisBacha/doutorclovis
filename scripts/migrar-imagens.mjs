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
    for (;;) {
      const { data: linhas, error } = await sb
        .from(tabela)
        .select(`id, ${cfg.dono}, image_data`)
        .is("image_path", null)
        .not("image_data", "is", null)
        .limit(LOTE);
      if (error) {
        console.error(`${tabela}: ${error.message}`);
        break;
      }
      if (!linhas || linhas.length === 0) break;

      for (const linha of linhas) {
        const img = decodificar(linha.image_data);
        if (!img) {
          /* Não é data URL — provavelmente já é uma URL, ou lixo. Marcar com
             caminho vazio faria a leitura quebrar; deixo como está e conto,
             para o número aparecer no fim em vez de o laço girar para sempre
             na mesma linha. */
          falhas++;
          const { error: eMarca } = await sb
            .from(tabela)
            .update({ image_path: "" })
            .eq("id", linha.id);
          if (eMarca) console.error(`  ${linha.id}: não é data URL e não consegui marcar`);
          continue;
        }
        const caminho = `${linha[cfg.dono]}/${crypto.randomUUID()}.${img.extensao}`;
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
      process.stdout.write(`\r${tabela}: ${feitas} subidas, ${falhas} falhas…`);
    }
    console.log(`\r${tabela}: ${feitas} subidas, ${falhas} falhas.        `);
  }
}

async function limpar(confirmar) {
  for (const [tabela, cfg] of Object.entries(TABELAS)) {
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
else if (comando === "limpar") await limpar(confirmar);
else {
  console.error("Comandos: status | subir | limpar --confirmar");
  process.exit(1);
}
