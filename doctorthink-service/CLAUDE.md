# DoctorThink — serviço standalone

API de "segundo cérebro" de IA por profissional: cada médico tem um cérebro
treinado só com respostas que **ele aprovou**; apps clientes consomem via API key.
Este pacote é **auto-contido e deployável** (banco próprio + servidor HTTP).

Leia o `README.md` para o passo a passo de deploy. Este arquivo é o contexto
para desenvolvimento (o que editar, o que NÃO quebrar).

## Stack

- **Runtime:** Node 22+ ou **Bun** (roda TS direto, sem build).
- **Banco:** Supabase/Postgres + **pgvector** (embeddings 768d).
- **Embeddings:** Google `text-embedding-004` via REST.
- **Servidor:** `node:http` puro (sem framework) em `src/server.ts`.

## Comandos

```bash
bun install
bun run start                 # sobe o servidor (PORT do env, ex. 8787)
bun run gen-key <tenant> [id] # cria API key (crua só aparece uma vez)
bun run migrate               # importa cérebro da Obstétrica (precisa SOURCE_* no env)
curl localhost:8787/health
```

## Arquitetura

| Arquivo               | Papel                                                        |
| --------------------- | ------------------------------------------------------------ |
| `src/core.ts`         | **IP portável**: ranking + montagem do bloco. Funções puras. |
| `src/contract.ts`     | interfaces (`BrainStore`, `BrainQuery`, `BrainProfile`…)     |
| `src/orchestrator.ts` | fluxo: canal → semântica → keyword → bloco → hit/lacuna      |
| `src/store.ts`        | `BrainStore` sobre o banco próprio (`src/db.ts`)             |
| `src/embeddings.ts`   | embeddings Google (768d)                                     |
| `src/auth.ts`         | API keys (sha256; scope por `tenant_id` + `doctor_id`)       |
| `src/labels.ts`       | rótulos de domínio (default genérico — troque por área)      |
| `src/server.ts`       | HTTP: `/health`, `/v1/ask`, `/v1/train`                      |
| `schema.sql`          | schema completo do banco (rode uma vez no SQL Editor)        |

## Regras que NÃO podem quebrar

1. **`core.ts` / `contract.ts` / `orchestrator.ts` são cópias fiéis** de
   `src/lib/doctorthink/` do repo Obstétrica. São o núcleo do produto. Se evoluir
   o núcleo lá, **copie de novo** (ou extraia para um pacote npm compartilhado).
   Mudar a lógica aqui sem espelhar lá cria divergência silenciosa.

2. **Canal é default-DENY.** No orquestrador, um canal só é liberado se
   `enabledChannels[channel] === true`. Nunca troque para `?? true`.

3. **Banco só com `service_role`** (server-only). RLS ligado sem policy; nunca
   exponha `SERVICE_ROLE_KEY` ao cliente nem crie policy anon/authenticated.

4. **API keys nunca são guardadas cruas** — só o sha256. Chave trancada a um
   `doctorId` não pode operar em outro profissional (403).

5. **Aprovação de conteúdo:** aqui `/train` grava `approved:true` (o dono da
   chave responde pelo conteúdo). Se o seu caso exigir fila de aprovação médica,
   ajuste em `src/store.ts` (na Obstétrica, `/train` de terceiro entra como
   rascunho pendente do médico — princípio: IA médica não aprende sem aprovação).

## Env (ver `.env.example`)

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`,
`PORT`. Para `bun run migrate`: `SOURCE_SUPABASE_URL`,
`SOURCE_SUPABASE_SERVICE_ROLE_KEY`. Nunca commite `.env`.
