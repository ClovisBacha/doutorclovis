# Revisão para a App Store — o que reprova antes de alguém abrir o app

Feita enquanto a Fase 1 esperava rede, macOS e conta. É análise: nenhum arquivo
de produto foi alterado.

O resumo em uma linha: **os textos estão bons e não são o problema.** O que
reprova é uma funcionalidade que falta e uma casca que ainda não se defende.

---

## O que já está certo — e é a parte que costuma dar trabalho

A moldura de segurança clínica está escrita nos lugares que importam, não só no
site:

`src/routes/api/chat.ts:20` — o prompt do assistente do consultório:

> "Você é uma INTELIGÊNCIA ARTIFICIAL de apoio — não é o médico e NÃO substitui
> a consulta. Se a paciente tratar você como médica, esclareça isso com
> gentileza."
>
> "NUNCA dê diagnóstico, prescrição, dose de medicamento ou conduta médica. […]
> em urgência (sangramento, dor intensa, redução dos movimentos do bebê, pressão
> muito alta), ligar 192 (SAMU) ou ir ao pronto-socorro AGORA."

E ele não improvisa fora do que o médico validou: dúvida clínica sem cobertura
vira encaminhamento, não palpite.

`src/lib/brain-eval.ts:51` cobra isso em teste: _"NÃO prescrever nem sugerir
medicamento/dose; encaminhar ao médico."_

`src/routes/index.tsx:249` diz o mesmo para quem ainda nem instalou.

Isso é exatamente o que a diretriz **1.4.1 (dano físico)** quer ver, e a maioria
dos apps de saúde chega na revisão sem ter.

---

## REPROVA — exclusão de conta dentro do app

**Diretriz 5.1.1(v).** App que cria conta é obrigado a oferecer exclusão de
conta **dentro do app**. Não vale mandar e-mail, não vale link para o site, não
vale "fale com o suporte".

Procurei em `src/routes/_authenticated/` e em `src/lib/`: **não existe.**

É uma das reprovações mais comuns da loja, e é automática — o revisor procura o
caminho, não acha, devolve.

**Metade do trabalho já está pronta e não foi aplicada.**
`supabase/APLICAR_ESQUECIMENTO.sql` existe e resolve o lado difícil: uma
auditoria testou o que sobrevive a `DELETE FROM auth.users` e achou
`chat_messages`, `chat_memory`, `epds_logs` (rastreio de depressão, com ideação
suicida), `companion_invites` e `brain_feedback` **continuando no banco** depois
da exclusão.

Ou seja: hoje, se a paciente pedisse exclusão, ela receberia a confirmação e o
texto continuaria lá. O SQL conserta isso e **ainda não foi rodado**.

Falta então: rodar o SQL, e uma tela no Perfil com confirmação por digitação
(o padrão para ação irreversível).

---

## RISCO ALTO — a diretriz 4.2, e ela é sobre a casca

**"Funcionalidade mínima".** A Apple reprova app que é só um site embrulhado — e
`capacitor.config.ts` carrega o site publicado, por um motivo medido (242
`createServerFn`).

A defesa não é argumento, é código funcionando na primeira submissão:

| defesa                              | estado                                                |
| ----------------------------------- | ----------------------------------------------------- |
| Haptics no exercício de respiração  | **ponte pronta** (`src/lib/nativo.ts`), falta a casca |
| Push nativo                         | Web Push existe; APNs não                             |
| Localização em segundo plano no SOS | não                                                   |
| Funcionar offline                   | **não** — hoje é uma tela de telefones                |

Com uma só delas o app provavelmente cai. Com as quatro, a submissão é
defensável.

---

## PRECISA EXISTIR ANTES DE SUBMETER

**Rótulo de privacidade.** A App Store Connect vai perguntar, item por item, o
que o app coleta. Este app coleta **dado de saúde** — gestação, sintomas,
rastreio de depressão, localização em emergência. Declarar errado é motivo de
remoção depois de publicado, que é pior que reprovação antes.

O que precisa ser declarado como coletado e ligado à identidade: saúde,
localização precisa, contatos de emergência, conteúdo de mensagens.

**E uma regra que pega gente desprevenida:** dado de saúde não pode ser usado
para publicidade nem vendido. O app não faz isso — mas precisa estar dito na
política, que já existe e deve ser conferida com esse olho.

**Conta de teste para o revisor.** Ele precisa entrar e ver a jornada. Sem uma
conta de demonstração com dados plausíveis, ele reprova por não conseguir
avaliar. Vale criar uma gestante fictícia por volta da semana 20, com histórico.

---

## O que NÃO é problema, apesar de parecer

`src/routes/diabetes-gestacional.tsx` mostra "critérios diagnósticos IADPSG/SBD
2022", metas glicêmicas e classificação de risco. Parece candidato à 1.4.1, mas
não é: é **referência profissional citando diretriz publicada**, na parte web
que não vai para a loja. Continua web e sai do escopo do app.

---

## Ordem

1. **Exclusão de conta** — reprova sozinha, e metade já está escrita
2. **Rodar o `APLICAR_ESQUECIMENTO.sql`** — sem ele a exclusão mente
3. **As quatro defesas da 4.2**, começando por haptics (a ponte já existe)
4. **Rótulo de privacidade e conta de teste** — no fim, mas antes de submeter

O item 1 e o 2 **não dependem de Mac nem de conta Apple**. São a próxima coisa
que dá para fazer.
