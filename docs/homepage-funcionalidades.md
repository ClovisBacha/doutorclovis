# As 10 funcionalidades que sustentam a nova homepage

Levantadas por varredura completa do repositório em 2026-08-02 (HEAD `333a791`):
19 abas da paciente, 16 do médico, 58 rotas, 66 tabelas. A ordem é de força de
conversão, não de complexidade técnica.

O critério vem do [`brief-paciente.md`](./brief-paciente.md): **a dor 1 — o medo
que aparece às 3h — é o gancho; a dor 5 — a gravidez passando sem ela ver — é a
permanência.** A homepage entra pela primeira e retém pela quinta.

---

## 1 · A IA que responde às 3h com as condutas do médico dela

Nenhum concorrente copia: exige o Segundo Cérebro que o obstetra treinou. E o
argumento de confiança está no código, não no marketing — **onde o médico não
validou, ela não inventa conduta**, diz que encaminha.

`src/routes/api/chat.ts` · `src/lib/secondbrain.server.ts`

## 2 · A trilha diária — 294 aulas e 378 desafios, um por dia

O que transforma "app que abro quando tenho medo" em hábito. Ninguém no mercado
brasileiro tem conteúdo indexado ao **dia** gestacional; o padrão é por semana.

`src/components/gestacao-path.tsx` · `src/lib/daily-quizzes.data.json`

## 3 · SOS que avisa sozinho, por quatro canais, com localização

Push no médico, e-mail do médico, e-mail do contato de emergência, SMS. O que
vende é a honestidade da tela: ela mostra **quais canais saíram de fato**, nunca
um "enviado" genérico. Em alto risco isso não é recurso, é a razão de instalar.

`src/lib/emergencia.functions.ts`

## 4 · Contrações que dizem se é hora de ir

Cronômetro com veredito — padrão normal, atenção, trabalho de parto ativo, vá
agora. O momento mais visual do produto e o que toda gestante procura na loja.

`minha-conta.tsx` › ContracoesTab

## 5 · Meditação com voz humana gravada, e som que toca offline

Sete meditações em estúdio e nove movimentos narrados. Os sons de chuva, mar e
batimento são **sintetizados no navegador**: tocam no primeiro quadro, funcionam
sem internet, zero MB. É o que faz o app parecer caro.

`src/lib/voz.ts` · `src/lib/soundscapes.ts`

## 6 · Fila de espera e contraproposta de horário

A única da lista que resolve dor administrativa, e nenhum app de gestação tem.
_"Sem vaga, você entra na fila e é avisada quando alguém desmarca"_ se explica
sozinha. Vende para a paciente **e** para o médico.

`src/lib/waitlist.functions.ts`

## 7 · O céu do app muda com a hora e o clima da cidade dela

A prova de cuidado com o detalhe em três segundos de vídeo. Não precisa de
explicação, só de demonstração.

`src/components/ceu-do-dia.tsx`

## 8 · Gravar a consulta e receber o resumo escrito

Áudio no celular → transcrição, orientações, medicamentos, próximos exames e
quando voltar. Resolve a dor universal de sair do consultório sem lembrar
metade.

`src/routes/api/transcribe.ts`

## 9 · Não acaba no parto — 12 semanas de pós-parto e rastreio de EPDS

Mata a objeção "vou usar seis meses e desinstalar", e é o único item que fala de
**depressão pós-parto** — tema de enorme ressonância e sem concorrente sério.

`minha-conta.tsx` › PosPartoTab · `ppd_screenings`

## 10 · O parceiro acompanha por um link, sem mexer nos dados dela

Token revogável, guia por trimestre para ele, álbum da família, votação de nome.
Cada paciente traz uma a três pessoas para dentro — o vetor viral mais barato do
produto.

`src/routes/acompanhar.$token.tsx`

---

## O que NÃO entra na homepage

Prometer o que não existe é o jeito mais rápido de perder a paciente no primeiro
dia de uso.

| Item                                  | Por quê                               |
| ------------------------------------- | ------------------------------------- |
| Mural dos bebês                       | esqueleto, com empty state explícito  |
| Impressão 3D do rosto                 | landing de venda sem fluxo no produto |
| Enviar documento e áudio no chat      | mostra "em breve"                     |
| Relatórios de engajamento corporativo | a própria `/empresas` diz "em breve"  |
| As 7 peles de trilha sem arte         | só uma tem desenho pronto             |

E os três blocos atuais da página — "Clima em tempo real", "Escola do bebê" e
"Monitoramento completo" — **não devem ser repetidos como estão**. O clima virou
o item 7, a escola virou o item 2, e o monitoramento hoje é muito mais do que os
gráficos que o texto descreve.

## A ressalva que atravessa tudo

O `CLAUDE.md` registra migrations pendentes no banco de produção. O código está
completo, mas **quais `APLICAR_*.sql` já rodaram no Supabase real** é a única
coisa que não dá para verificar do repositório. Confirmar antes de prometer.
