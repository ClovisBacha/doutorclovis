# Regravação das falas com voz (26/10/2026)

O dono pediu: "Pode regravar via higgsfield". Este é o roteiro, para a sessão
que tiver o conector do Higgsfield ligado (claude.ai/customize/connectors — o
conector é lido quando a sessão começa).

## Por que regravar

Fala com voz gravada não muda de texto: a voz diria a frase antiga. Na fase 2d
(diário, "26/10 — build 34") as falas que fugiam das regras do app (21/10: rede
social + gamificação, não conselho médico; nunca o bebê no masculino) ficaram
de três jeitos, à espera desta regravação:

- **fora do plano** da meditação (o ciclo fica em silêncio) — `FALAS_FORA_DO_APP`
  e as réguas `FORA_DO_LUTO`/`FORA_DO_POS` em `mobile/src/lib/jornada/meditacao.ts`;
- **sem voz** — o fechamento "Com sono", "Conectada" e "Ainda ansiosa"
  (`FALA_DO_FECHAMENTO`), e a narração do tornozelo e do balanço no Mexer
  (`NARRACAO_FORA_DO_APP` em `mobile/src/lib/jornada/mexer.ts`);
- **como estão** — o "ele" para o bebê nas falas do tema "Conexão com o bebê",
  as promessas de eficácia de "Para vocês dois" (que, por decisão do dono, abre
  só da 28ª semana) e duas frases das histórias para dormir.

`roteiro.json` tem as 40 falas: o `id`, o arquivo de hoje, o texto de hoje, o
texto novo, o motivo e o destino no app.

## A voz (a mesma de todas as outras — não troque)

Higgsfield, modelo `text2speech_v2`, variante `elevenlabs`, voz **Isabella**,
`voice_id` `80924413-1ea8-4e64-9719-e00b86796f05` (decidido em ago/2026; ver
`docs/diario/2026-jul-set.md`, "Voz do app"). Formato dos arquivos de hoje:
mp3, 128 kbps, 44,1 kHz, mono. Uma fala regravada em outra voz soa como outro
produto no meio da sessão.

## Onde os arquivos moram

⚠️ **Nunca em `src/assets/audio`** — é do site, congelado, e o site toca esses
arquivos. As regravadas vão para `mobile/assets/vozes/regravadas/<id>.mp3`.

## Feita em 27/10/2026: as 40 entraram (build 36)

Ver o diário, "27/10 — build 36". O caminho abaixo vale para a próxima fala que
precisar de voz nova: acrescentá-la ao `roteiro.json` e seguir a receita.

## Como o app liga as regravadas

Texto e voz andam JUNTOS, e o app já sabe trocar os dois nos cinco lugares:

- `mobile/scripts/gerar-mapa-das-regravadas.ts` lê este roteiro e a pasta
  `mobile/assets/vozes/regravadas/`, e escreve `mobile/src/lib/audio/regravadas.ts`
  (a voz) e `regravadas-texto.ts` (o texto). **Só entra a fala cujo arquivo
  existe** — o texto novo nunca aparece com a voz velha.
- A meditação (`planoDaSessao`) troca o texto e devolve ao plano a fala que tinha
  saído; o fechamento (`falaDoFechamento`), o casal (`blocosDoCasalNoApp`), o
  Mexer (`narracaoNoApp`) e as histórias tocam `VOZ_REGRAVADA` antes da do site.
- `mobile/src/lib/audio/regravadas.test.ts` confere o roteiro contra o site, os
  mapas contra a pasta, e a troca com as 40 falas.

**Para gerar uma fala (precisa do conector do Higgsfield):**

1. Gerar cada fala de `roteiro.json` com o `texto_novo`, na voz acima. Gerar UMA
   primeiro e conferir o formato contra `src/assets/audio/med/inspire.mp3`.
2. Salvar como `mobile/assets/vozes/regravadas/<id>.mp3` (o `id` do roteiro).
3. `cd mobile && bun scripts/gerar-mapa-das-regravadas.ts` — ele diz quantas
   falas do roteiro entraram.
4. Portões, diário, `buildNumber`, commit e push.

## Catracas e entrega

- Todo `id` do mapa está em `roteiro.json`; o texto do site ainda é o
  `texto_do_site` (se o site mudar, a catraca avisa); cada arquivo existe.
- Nenhum texto novo com "ele/dele" para o bebê, consulta, "normal" ou promessa.
- Conferir o formato de cada arquivo e ouvir uma sessão inteira de cada tema
  trocado antes de dizer que acabou.
- Portões, diário e `buildNumber`.
