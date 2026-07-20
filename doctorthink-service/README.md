# DoctorThink — serviço standalone

O **Segundo Cérebro** da Obstétrica, empacotado como **produto independente**: uma
API que dá, para cada profissional (médico), um "cérebro" de IA treinado com as
respostas que **ele aprovou**. Outros apps consomem via API key.

Este pacote é **auto-contido e deployável**: banco próprio (Supabase/Postgres +
pgvector), servidor HTTP (Node/bun), migração de dados e este guia. A Obstétrica
continua funcionando sozinha; ligá-la a este serviço é opcional (ver passo 7).

```
POST /v1/ask    → { block, hadCoverage, enabledChannels }   (contexto do cérebro)
POST /v1/train  → { ok, id }                                 (adiciona Q&A)
GET  /health    → { ok: true }
Auth: Authorization: Bearer dtk_...   (ou header X-API-Key)
```

## Arquitetura (o que é o quê)

| Arquivo                      | Papel                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `src/core.ts`                | IP portável: ranking + montagem do bloco (cópia fiel do núcleo da Obstétrica) |
| `src/contract.ts`            | interfaces (`BrainStore`, `BrainQuery`…)                                      |
| `src/orchestrator.ts`        | fluxo: canal → semântica → keyword → bloco → hit/lacuna                       |
| `src/store.ts`               | `BrainStore` sobre o banco PRÓPRIO deste serviço                              |
| `src/embeddings.ts`          | embeddings via Google (text-embedding-004, 768d)                              |
| `src/auth.ts`                | API keys (sha256; chave crua só na criação)                                   |
| `src/server.ts`              | servidor HTTP (Node/bun)                                                      |
| `schema.sql`                 | schema completo do banco (rode uma vez)                                       |
| `migrate-from-obstetrica.ts` | copia o cérebro da Obstétrica para cá                                         |

> `core.ts`/`contract.ts`/`orchestrator.ts` são cópias fiéis de
> `src/lib/doctorthink/` do repo Obstétrica. Ao evoluir o núcleo lá, copie de
> novo (ou, no futuro, extraia para um pacote npm compartilhado).

## Passo a passo (deploy)

**1. Banco.** Crie um projeto **Supabase novo** (só para o DoctorThink). No SQL
Editor, cole e rode o `schema.sql`. (Ele cria as tabelas, o índice vetorial e a
função de busca `match_brain_entries`.)

**2. Env.** `cp .env.example .env` e preencha:

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — do projeto novo.
- `GOOGLE_GENERATIVE_AI_API_KEY` — a mesma chave Google (embeddings).
- `PORT` — ex. `8787`.

**3. Rodar.**

```bash
bun install
bun run start        # ou: npm install && npm run start:node (Node 22+)
curl localhost:8787/health
```

**4. Criar uma API key.**

```bash
bun run gen-key obstetrica            # chave "de 1ª parte" (usa o doctorId do corpo)
bun run gen-key clinicaX <doctorUuid> # chave TRANCADA a um profissional (p/ terceiros)
```

Copie a chave impressa (só aparece uma vez).

**5. Testar.**

```bash
curl -X POST localhost:8787/v1/train -H "Authorization: Bearer dtk_..." \
  -H "content-type: application/json" \
  -d '{"doctorId":"med-1","question":"posso tomar café?","answer":"Até 200mg de cafeína/dia é ok."}'

curl -X POST localhost:8787/v1/ask -H "Authorization: Bearer dtk_..." \
  -H "content-type: application/json" \
  -d '{"doctorId":"med-1","message":"tô com vontade de café","channel":"app"}'
```

**6. Migrar o cérebro da Obstétrica (opcional).** Preencha `SOURCE_SUPABASE_URL`
/ `SOURCE_SUPABASE_SERVICE_ROLE_KEY` (o Supabase da Obstétrica) e:

```bash
bun run migrate      # copia settings + entries (re-embeddando) + lacunas
```

**7. Ligar a Obstétrica a este serviço (opcional).** No projeto Obstétrica:

1. Gere uma chave aqui (`gen-key obstetrica`).
2. Na Vercel da Obstétrica, defina `DOCTORTHINK_API_URL` (a URL pública deste
   serviço) e `DOCTORTHINK_API_KEY` (a chave).
3. No `/admin` → **Feature flags**, crie/ligue `doctorthink_remote` (duplo
   opt-in). Comece com `rollout_pct` baixo se quiser testar em poucos médicos.

Sem esses passos, a Obstétrica segue usando o cérebro **local** (idêntico ao de
hoje). Qualquer falha do remoto → fallback local automático.

## Onde hospedar

Qualquer lugar que rode Node/bun: **Railway, Fly.io, Render, Cloud Run, VPS**.
Start command: `bun run src/server.ts` (ou `npm run start:node`). Exponha `PORT`.

## Notas de produto

- **Aprovação de conteúdo:** aqui `/train` grava como `approved:true` — o app
  cliente (dono da chave) é responsável pelo que envia. (Na Obstétrica, `/train`
  de terceiros entra como rascunho pendente do médico.) Ajuste em `src/store.ts`
  se seu caso exigir fila de aprovação.
- **Rótulos de domínio:** `src/labels.ts` traz um default genérico. Para outra
  área (jurídico, cardiologia…), troque os rótulos — a lógica não muda.
- **Segurança:** o banco é acessado só com a `service_role` (server-only, RLS
  ligado sem policy). As chaves nunca são guardadas cruas (só sha256). Chaves
  trancadas a um `doctorId` não conseguem operar em outro profissional.
