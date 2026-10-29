# Os documentos jurídicos do app (fase 4)

Os **Termos de uso** e a **Política de privacidade** do app Obstétrica (o React
Native de `mobile/`). Escritos em 28/10/2026 para o app de hoje — comunidade de
gestantes e mães, jogo de cuidado diário, SOS, sem orientação médica (decisão
do dono de 21/10/2026) — e a partir do que o app coleta de fato. Corrigidos em
29/10/2026 por um inventário independente do código, que achou o que o
primeiro texto errava (o diário, "28/10 — build 42" e "29/10 — build 43").

> ⚠️ **Precisam de revisão jurídica antes da loja.** Foram escritos a partir do
> código, por quem conhece o app, e não por advogado. Os pontos que mais pedem
> olhar de advogado: o consentimento do dado sensível (LGPD, art. 11, I), a
> transferência internacional (art. 33), o prazo dos registros de acesso (Marco
> Civil) e a cláusula de responsabilidade frente ao CDC.

## Onde mora o texto

O texto é UM só, em `mobile/src/lib/juridico/termos.ts` e `privacidade.ts`.
Dele saem:

- as telas do app (`/termos`, `/privacidade`), que funcionam sem internet;
- `termos.md` e `privacidade.md` aqui, para revisão;
- `termos.html` e `privacidade.html` aqui, publicadas no GitHub Pages (a URL
  pública que a App Store pede no campo "Privacy Policy URL");
- `index.html` aqui, a página de suporte que liga as duas (a "Support URL").

Depois de mudar o texto: `cd mobile && bun scripts/gerar-juridico.ts`, e
empurre. A catraca `juridico.test.ts` reprova se as cópias daqui ficarem para
trás, e o workflow `paginas-juridicas.yml` publica a cada push que muda esta
pasta.

## O aceite, por versão

`VERSAO_DOS_TERMOS` (em `mobile/src/lib/juridico/aceite.ts`) é a data da versão
em vigor. O aceite de cada versão fica nos metadados da conta
(`raw_user_meta_data`: `termos_do_app`, `termos_do_app_aceite_em`,
`maior_de_18_confirmado_em`, `consentimento_dados_de_saude_em`). Quem não aceitou
a versão em vigor vê a tela de aceite ao abrir o app — inclusive quem entrou pela
Apple, que antes nunca passava por aceite nem pelos 18 anos.

**Mudou algo relevante?** Mude a data da versão: todas aceitam de novo.

## Onde estão hospedados

No GitHub Pages deste repositório — só esta pasta, nunca `docs` inteira:

- suporte: `https://clovisbacha.github.io/doutorclovis/`
- privacidade: `https://clovisbacha.github.io/doutorclovis/privacidade.html`
- termos: `https://clovisbacha.github.io/doutorclovis/termos.html`

⚠️ Essas URLs vão para o App Store Connect: não renomeie os arquivos nem o
repositório. Os detalhes estão em `docs/loja-textos.md`, "Onde a Privacidade e
os Termos estão hospedados".
