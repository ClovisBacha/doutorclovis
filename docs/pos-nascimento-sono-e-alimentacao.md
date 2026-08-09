# Pós-nascimento: sono e alimentação do bebê

> **Estado: NA FILA.** Pedido do dono em 9/ago/2026, com ordem explícita —
> só começa depois que a aba do médico estiver perfeita.

## O pedido, nas palavras dele

> "Aplique ali no perfil do bebê, dentro do aplicativo, uma questão do sono.
> Tem um aplicativo que eu acho interessante que chama **Napper**. Estude esse
> aplicativo a fundo, coloca ali dentro do painel do bebê. E isso vai ser
> somente **depois que o bebê nascer**. E depois dessa questão vai ter também a
> questão dele comer, alimentação. (…) Pense em outros pontos que tem que ter
> na aba de pós-nascimento do bebê."

## O que isso quer dizer, em decisões

**1. É uma aba que só existe depois do parto.** O produto hoje é de pré-natal;
esta é a primeira função desenhada para o outro lado da linha. O gatilho é o
nascimento, não a DPP — bebê nasce antes e depois da data, e uma aba que aparece
no dia errado é pior que uma que aparece tarde.

**2. O pós-parto já existe no produto e não pode virar dois lugares.** Há a
série pós-parto do Caminho (`D = idade do bebê em dias + 7`, ver CLAUDE.md), a
EPDS e os registros pós-parto no fluxo clínico. Sono e alimentação entram
NAQUELE lugar ou o app passa a ter duas abas de pós-parto que se ignoram.

**3. O que estudar no Napper, antes de copiar tela.** A pergunta não é "como é a
interface dele" — é **o que ele mede e por que a mãe volta**. Registro de sono de
recém-nascido é feito às três da manhã, com uma mão, no escuro, com o bebê no
colo. Isso governa tudo: número de toques, tamanho do alvo, brilho da tela,
se precisa de precisão de minuto ou se "faixa aproximada" basta.

**4. Alimentação tem uma armadilha clínica.** Mamada, fórmula e intervalo são
dados que aproximam de conduta — quantidade, ganho de peso, "está mamando
pouco?". Vale a mesma régua do resto do produto: o app REGISTRA e mostra o que
ela registrou; quem interpreta é o médico. Nada de faixa de normalidade
inventada na tela.

## Perguntas para decidir com ele (não decidir sozinho)

- O que dispara a aba: uma data de nascimento que ela informa, ou o médico
  registrando o parto?
- O sono/alimentação aparece para o MÉDICO no prontuário, ou é só dela?
  (Se aparece, entra no fluxo unificado de `clinical_events` — não numa tabela
  paralela.)
- Isso é do plano Premium dela, ou de graça?

## Onde encostar no código, quando começar

- `src/routes/_authenticated/minha-conta.tsx` — as abas dela, inclusive a série
  pós-parto que já existe.
- `src/lib/gestacao-path.tsx` — `challengeForPosDay`, a régua de dias pós-parto.
- `supabase/APLICAR_EVENTOS_CLINICOS.sql` — se for visível ao médico, a view
  `clinical_events` é o contrato, e ela é montada dinamicamente.
