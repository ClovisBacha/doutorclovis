# Auditoria do painel do médico — 9 de agosto de 2026

Dez agentes leram o painel inteiro, uma área cada, procurando o que QUEBRA,
o que MENTE e o que VAZA — não estilo. Cada achado exigiu evidência concreta:
trecho de código ou nome de tabela.

## O que a auditoria mediu

- **100 achados** em 10 áreas
- 🔴 VAZAMENTO: 4
- 🟠 QUEBRA: 19
- 🟡 SILENCIOSO: 54
- ⚪ INCÔMODO: 23

### As três causas de fundo

**1. Migrations pendentes.** O banco de produção tem menos tabelas e colunas que
o repositório. Várias abas dependem de coisas que só existem em arquivos APLICAR
que ninguém foi instruído a rodar. Não é 'talvez falhe': falha, e falha calado.

**2. `supabase-js` nunca lança.** Ele devolve `{ data, error }`. Dezenas de
leituras ignoram o `error`, e o resultado é sempre o mesmo: lista vazia com cara
de 'não tem nada'. O médico vê 'Ninguém na fila de espera' quando a verdade é
'não consegui ler a fila'.

**3. Recorte pelo carimbo, não pelo vínculo.** Várias consultas filtram pelo
`doctor_id` gravado na linha no momento em que ela nasceu, e não pelo vínculo
ATUAL da paciente. Quem troca de médico continua aparecendo para o anterior.

---

## Achados

Marcados com ✅ os já consertados nesta madrugada.


### 🔴 VAZAMENTO

**Fila de espera do painel recortada por doctor_id carimbado no ingresso, não pelo vínculo atual**  
> ❎ FALSO POSITIVO — conferido. `appointment_waitlist` não tem `user_id` (identifica por e-mail de formulário) e é fila de ENTRADA: quem pede vaga ainda não é paciente de ninguém. Mesma exceção que `vinculo.server.ts` documenta para `appointment_requests`.  
`/home/user/doutorclovis/src/lib/admin.functions.ts:587`  
joinWaitlist carimba doctor_id na linha da fila no momento em que a paciente entra. Se ela depois troca de médico (patient_profiles.doctor_id muda), getDoctorWaitlist continua devolvendo a linha antiga: o médico anterior segue vendo nome, e-mail e telefone dela na fila dele. Pior que ver: quando ele cancela uma consulta, offerNextForWeek oferta a vaga a ela e respondWaitlistOffer cria um appointment_requests confirmado com o doctor_id ANTIGO — ela é agendada com um médico que não é mais o dela. As irmãs desta função no mesmo arquivo já fazem o cruzamento certo (getAdminData e getPreConsultaForms filtram por nameById, que vem de patient_profiles recortado por doctor_id); só a fila ficou de fora, e appointment_waitlist sequer tem user_id para cruzar.

**✅ ConsumoDaIACard: "Quem mais conversou" é recortado pelo doctor_id carimbado, e o nome vem sem filtro de médico**  
`src/lib/cota-ia.server.ts:252`  
O consumo por paciente sai de `ai_usage.doctor_id` — o carimbo do momento da conversa, não o vínculo atual — e o nome é buscado em `patient_profiles` só por `.in("id", …)`, sem `.eq("doctor_id", doctorId)`. O médico encerra o acompanhamento de uma paciente (o botão `encerrar()` de PacientesSection zera `patient_profiles.doctor_id`) ou ela se vincula a outro médico: as linhas do ciclo continuam carimbadas com o doctor_id antigo, e o card segue nomeando a ex-paciente — nome e volume de conversas — até a virada do mês, para alguém que já não tem vínculo com ela. E o clique nela morre: `onAbrirPaciente` joga para a aba Pacientes, onde o efeito faz `patients.find((x) => x.id === abrirPacienteId)` sobre a lista recortada pelo vínculo ATUAL (painel.tsx:10656); não encontra, `onAbriu` nunca é chamado e nada abre — troca de aba sem explicação. O próprio repo já trata isso como defeito no caminho vizinho: `getPreConsultaForms` filtra `nameById.has(f.user_id)` justamente para não exibir ex-paciente.

**✅ Cerebro lista pergunta de ex-paciente (e de qualquer usuario) — so o carimbo, sem vinculo atual**  
`src/lib/secondbrain.functions.ts:576`  
O medico encerra o acompanhamento (encerrarAcompanhamento zera patient_profiles.doctor_id, patientlink.functions.ts:487) mas doctor_questions.doctor_id continua carimbado com ele. Na aba Perguntas ela some (filtro por vinculo, admin.functions.ts:189); no card '❓ Perguntas das pacientes esperando voce' do Cerebro (painel.tsx:7508 renderiza {q.question}) o TEXTO CRU da pergunta dela continua na tela para sempre. Pior: a RLS de doctor_questions so checa auth.uid()=user_id e o GRANT de INSERT e de tabela inteira (migration 20260731080000, linha 218), entao doctor_id e escolhido pelo navegador da paciente — qualquer usuario logado insere linha com o doctor_id de QUALQUER medico e o texto aparece na fila de treino dele. Responder falha (answerAndTrain devolve 'sem_vinculo'), mas a tela so diz 'Nao foi possivel treinar... Tente novamente' e o item nunca sai da lista. Mesma raiz em dashboard.functions.ts:295 (recentPending, card 'Perguntas aguardando voce' do Painel).

**✅ As AÇÕES de teleconsulta autorizam pelo carimbo da linha, não pelo vínculo atual — só a leitura foi corrigida**  
`src/lib/teleconsulta.functions.ts:43`  
A paciente encerra o acompanhamento e passa para outro médico (patient_profiles.doctor_id muda; o carimbo em teleconsulta_sessions.doctor_id NÃO). A LISTA do médico anterior já esconde a sessão (passa por vinculadasAgora/soVinculadas). Mas se ele estiver com a aba aberta desde antes da transferência — ou repetir o POST da server function com o id que já tem — openTeleconsultaRoom passa: cria um evento no Google Agenda DELE convidando o e-mail da ex-paciente, dispara e-mail para ela e reabre a sala. saveDoctorClinicalNote e updateTeleconsultaStatus passam pelo mesmo portão. É a regra que o próprio vinculo.server.ts existe para impor, aplicada só na metade de leitura.


### 🟠 QUEBRA

**Calendário e Fila dependem de colunas/tabela que podem não existir em produção**  
`/home/user/doutorclovis/src/routes/_authenticated/painel.tsx:4770`  
O médico abre a aba Calendário e vê a grade da semana toda vazia mais "Nenhuma consulta confirmada com data definida", tendo dez consultas confirmadas. Abre Agendamentos e a Fila de espera diz "Ninguém na fila de espera no momento". Nada de erro aparece. Causa: confirmed_date/confirmed_time/price_brl/payment_status/internal_notes nascem em supabase/migrations/20260610010000_doctor_scheduling.sql, proposed_date/proposed_time em 20260723010000 e a tabela appointment_waitlist inteira em 20260723020000 — todas posteriores a 20260608120000, a fronteira do que o CLAUDE.md declara pendente em produção. Como o painel lê com select("*"), coluna ausente não dá erro: vira undefined, o filtro descarta tudo e a tela mente. Só o botão Confirmar falha em voz alta (PGRST204 no toast).

**✅ APLICAR_AGENDA.sql aborta antes de criar appointment_waitlist se as colunas de agenda não existirem**  
`/home/user/doutorclovis/supabase/APLICAR_AGENDA.sql:17`  
O CLAUDE.md manda rodar supabase/APLICAR_AGENDA.sql para ligar contraproposta + fila. O arquivo só adiciona proposed_date/proposed_time; na linha 17 cria um índice sobre confirmed_date/confirmed_time, que ele NÃO cria e que vêm de APLICAR_PENDENTES. Num banco onde as pendentes não foram aplicadas, o SQL Editor para nesse statement com 42703 e tudo que vem depois — inclusive o CREATE TABLE public.appointment_waitlist da linha 24, os índices e os GRANTs — nunca roda. O dono lê "erro na linha 17", acha que foi só o índice, e fica com a fila de espera inexistente enquanto o painel jura que ela está vazia.

**Engajamento: a aba inteira morre calada quando a sessão expira**  
`src/routes/_authenticated/painel.tsx:731`  
`token()` devolve string vazia quando não há sessão (painel.tsx:304-307), e o validador do servidor exige `z.string().min(10)` — a chamada REJEITA. `loadEngagement` não tem try/catch, não tem estado de erro e só trata `res.ok === true`. O efeito da linha 821 (`if (tab === "Engajamento" && !engagement) loadEngagement()`) dispara uma promessa rejeitada sem catch, `engagement` fica `null` e a aba mostra "Clique para carregar o dashboard" com o botão "Carregar dados" — que chama a MESMA função e também falha calado. O médico clica quantas vezes quiser e a tela não muda nem diz por quê. Com dados já em tela, o "↺ Atualizar" tem o mesmo destino: falha sem mensagem logo abaixo da faixa âmbar que manda "Atualize antes de ligar para alguém".

**Engajamento: "Ver relatório" trava em "..." para sempre, ou não abre nada**  
`src/routes/_authenticated/painel.tsx:3353`  
Dois caminhos, os dois sem uma palavra ao médico. (1) Se `getPatientReport` LANÇA (rede, sessão expirada — `token()` vazio é recusado pelo zod), não há try/catch nem finally: `setLoadingReport(null)` nunca roda, e o botão daquela paciente fica `disabled` mostrando "..." até o médico dar F5. (2) Se devolve `{ok:false}` — que é o que acontece quando `assertOwnsRow` nega, por exemplo numa paciente já desvinculada —, `reportData[userId]` não é preenchido mas `setExpandedId(userId)` roda mesmo assim; o JSX é guardado por `expandedId === p.id && reportData[p.id]`, então o clique não produz absolutamente nada na tela e nenhum toast explica.

**Pergunta de ex-paciente entope a fila de treino: o medico responde e so recebe "Tente novamente"**  
`/home/user/doutorclovis/src/routes/_authenticated/painel.tsx:7421`  
A paciente pergunta, depois troca de medico (patientlink.functions.ts:487 grava patient_profiles.doctor_id = null). A linha em doctor_questions guarda o doctor_id ANTIGO. listUnansweredQuestions recorta so pelo carimbo (.eq("doctor_id", target.doctorId)), entao a pergunta continua na fila do BrainTrainCard — e como a ordem e created_at ASC, ela fica NO TOPO. O medico escreve a resposta e clica "Responder e treinar": answerAndTrain confere o vinculo ATUAL, nao acha, e devolve reason:"sem_vinculo". A tela nao le esse reason e mostra "Nao foi possivel treinar com essa resposta. Tente novamente." Ele tenta de novo, perde o texto, e o item nunca sai. Nao ha nenhuma mencao de "sem_vinculo" em painel.tsx (grep = 0 ocorrencias).

**✅ brain_gap_askers nao esta no APLICAR_PENDENTES.sql — a resposta da lacuna nao chega a ninguem**  
`/home/user/doutorclovis/src/lib/secondbrain.functions.ts:1447`  
O CLAUDE.md manda rodar supabase/APLICAR_PENDENTES.sql para fechar as migrations pendentes. Esse arquivo cria brain_gaps e brain_feedback, mas NAO cria brain_gap_askers (a tabela nasceu na migration 20260731010000, pendente, e no arquivo separado APLICAR_QUEM_PERGUNTOU.sql). Sem ela, com o painel parecendo perfeito: (a) entregarRespostaDaLacuna cai no catch e devolve 0 — nenhuma paciente recebe a resposta que a IA prometeu ("registrei aqui para ele ver"), e nao ha nada na tela dizendo isso; (b) listBrainGaps deixa `pacientes` undefined, entao o aviso "So uma paciente perguntou isto — talvez seja do caso dela" nunca aparece; (c) marcar "Responder so para ela" cai no `if (cntErr)` e devolve varias_pacientes/quantas:null, mostrando "Nao consegui confirmar quem esta esperando. Tente de novo." — um botao que nunca funciona, com uma mensagem que convida a repetir.

**Pergunta generalizada com 1 a 7 caracteres derruba a RESPOSTA CLINICA inteira**  
`src/routes/_authenticated/painel.tsx:2901`  
O medico escreve a resposta, marca 'Ensinar isto a minha IA' e digita algo curto no campo da pergunta generalizada (ex.: 'febre', 5 letras). O cliente manda perguntaGeneralizada='febre'; o zod do servidor exige min(8), o inputValidator LANCA, a server function nunca roda e o catch da tela mostra 'Nao consegui enviar. Tente de novo.'. Clicar de novo repete o mesmo erro para sempre e a paciente nao recebe resposta nenhuma. O aviso na tela afirma o contrario, textualmente: 'Muito curta — sem isso a IA nao aprende (a resposta chega a ela de qualquer jeito)' (painel.tsx:2998). Nao chega. O botao continua habilitado e nada indica que a culpa e do campo opcional de treino.

**Transcrição devolve 402 para gestor de clínica que já paga**  
`src/routes/api/transcribe.ts:47`  
O dono de clínica SEM linha em `doctors` (gestor não-médico) entra no painel pelo resgate do getMyClinic (painel.tsx:678-682), aterrissa direto na aba Cérebro (ABA_DE_ENTRADA) com podeIA = true — aplicarPlano só roda `if (me.ok && me.doctor)` (painel.tsx:657), e ele não tem doctor — e opera o cérebro de um médico da clínica. Ao clicar em '🎙️ Enviar áudio da consulta', /api/transcribe resolve getEntitlements(usuario) DELE: sem linha em doctors, planRowFor devolve 'free', aiApp = false; o fallback procura patient_profiles com o id dele, não acha; volta 402 'Transcrição de consulta faz parte dos planos com IA… a partir de R$ 29,90/mês'. No MESMO cartão, o botão ao lado ('🧠 Extrair conhecimento') funciona normalmente, porque extractKnowledgeFromTranscript passa por brainPlanAllows, que libera quando viaClinic. Dois gates discordando na mesma tela, e o que quebra é justamente o caminho que a clínica pagou.

**A coluna exam_files.image_path só existe num APLICAR que ninguém foi mandado rodar — o visor de exames do médico quebra inteiro**  
`src/lib/clinical.functions.ts:1150`  
O commit HEAD anterior ("Imagens saem do Postgres e vão para o Storage") passou a ler e escrever exam_files.image_path. Essa coluna NÃO nasce em nenhuma migration de supabase/migrations/, nem em APLICAR_PENDENTES.sql, nem em BANCO_COMPLETO.sql — ela só existe em supabase/APLICAR_IMAGENS_NO_STORAGE.sql, arquivo que o CLAUDE.md não cita em lugar nenhum (o CLAUDE.md só manda rodar PENDENTES, EVENTOS_CLINICOS e AGENDA). Como o banco de produção está atrás do repo, o efeito é duplo e imediato: (1) o médico abre QUALQUER exame na aba Exames -> o select devolve 42703 -> imagemDoExame cai no if (error) e responde motivo:"falha" -> a tela mostra a tarja âmbar "Não consegui carregar a imagem" para todos os laudos, sempre; (2) a paciente anexa laudo no chat -> o insert nomeia image_path -> PostgREST devolve PGRST204 antes de chegar ao banco -> enviarExameDoChat devolve {ok:false} -> ela lê "Não consegui enviar o arquivo agora" e o exame nunca é gravado, mesmo com o Storage fora do caminho. A lista de exames continua funcionando (não seleciona image_path), então o médico vê nomes de laudos que nunca abrem.

**Abrir um exame na aba Exames da paciente estoura a tela: preview.image_data é undefined no primeiro render**  
`src/routes/_authenticated/minha-conta.tsx:19151`  
A paciente abre Minha Conta -> Exames e clica no botão 'Abrir' de qualquer exame. `abrirExame` faz `setPreview(exam)` SÍNCRONO e só depois vai buscar a imagem. Mas `exam` veio de `load()`, cujo select foi propositalmente enxugado e NÃO traz image_data — então `exam.image_data` é `undefined`. O React renderiza o lightbox nesse estado e executa `preview.image_data!.startsWith("data:application/pdf")` sobre undefined: TypeError em tempo de render, que sobe para o error boundary do __root e mata a tela. Acontece em 100% dos cliques. E mesmo depois de aplicado o Storage o bug persiste por outro caminho: o exame vindo do chat grava image_data NULL e image_path preenchido, e `abrirExame` só busca `select("image_data")` — nunca image_path —, então o fetch traz null e o crash continua.

**assessSymptoms chama o Gemini sem token de sessão, sem limite de taxa e sem nenhum gate de plano**  
`src/lib/triage.functions.ts:18`  
O inputValidator de `assessSymptoms` não pede accessToken — só sintomas, pressão, nota e semanas. O handler não chama `supabaseAdmin.auth.getUser`, não consulta entitlements e não passa por `makeRateLimiter` (que este repo já tem e usa em exame-do-chat.functions.ts:53). Server functions do TanStack Start são endpoints HTTP POST públicos; o `attachSupabaseAuth` em src/start.ts é middleware de CLIENTE (só põe o header) e nada no servidor o confere. Qualquer pessoa com a URL do serverFn dispara `generateText` com o Gemini em laço, sem login. Pior para a fatura: o uso é registrado com `doctorId: null, patientId: null, canal: "triagem"`, e 'triagem' está fora de CANAIS_DA_COTA — o custo cai como despesa não atribuída da plataforma, sem cota que trave e sem médico que pague.

**teleconsulta_sessions.doctor_id não existe em NENHUMA migration — só no APLICAR_PENDENTES**  
`src/lib/teleconsulta.functions.ts:106`  
O médico abre a aba Teleconsultas: a lista vem vazia ("Nenhuma teleconsulta cadastrada ainda"). Ele clica em + Agendar, escolhe a paciente, clica em Criar teleconsulta — o formulário fecha, os campos limpam, e nada aparece. Repete três vezes achando que errou algo. No servidor, o INSERT devolveu 42703 (coluna doctor_id inexistente) ou 42P01 (tabela inexistente) e ninguém leu o campo error. Pior: a tabela teleconsulta_sessions nasce na migration 20260608170000, que o CLAUDE.md declara PENDENTE em produção — hoje a aba inteira está morta e calada no ar.

**A tabela `lives` não tem CREATE TABLE em migration nenhuma, e a migration que a altera derruba junto o recorte das Consultas Pagas**  
`supabase/migrations/20260719030000_lives_consultas_doctor.sql:9`  
Quem reconstruir o banco pelas migrations (supabase db push) para em 20260719030000: 'ALTER TABLE public.lives' aborta com 42P01 porque nenhuma migration cria essa tabela. E o mesmo arquivo, três linhas abaixo, é o ÚNICO lugar das migrations que adiciona private_consultations.doctor_id — o recorte da aba Consultas Pagas. Ou seja: uma tabela que não existe mata a coluna de outra aba. O médico fica com Lives mostrando o aviso amarelo (esse caminho está tratado) e Consultas Pagas mostrando lista vazia sem aviso nenhum.

**O horário da teleconsulta é gravado 3 horas errado — a paciente recebe convite para a hora errada**  
`src/routes/_authenticated/painel.tsx:3690`  
O médico marca a teleconsulta para 20:00 no campo datetime-local. O painel manda a string crua '2026-08-10T20:00' (sem fuso) e o servidor a insere direto na coluna scheduled_for timestamptz; o Postgres da Supabase lê como UTC. O cartão volta na tela mostrando 17:00 — e o convite do Google Agenda é criado às 17:00, com o e-mail do Google avisando a paciente desse horário. A LivesSection, no MESMO arquivo, faz a conversão certa (new Date(when).toISOString(), linha 10347); a de teleconsulta não. Esta base já registrou dois defeitos exatamente desta família em src/lib/fuso.test.ts (o cartão do batimento e a fila de espera) e criou instanteBrasilia/ymdBrasilia para isso — a teleconsulta ficou de fora.

**generateClinicalNote chama o Gemini sem verificar plano nenhum — médico do Free gera nota SOAP ilimitada**  
`src/lib/teleconsulta.functions.ts:251`  
Um médico no plano Free (aiApp: false) abre Teleconsultas — a aba não é filtrada por plano, e o gate podeIA do painel só cobre a aba Cérebro. Numa sessão com status sala_aberta/encerrada aparece o botão '✨ Gerar nota SOAP'. Ele clica, e funciona: o servidor só checa requireScope (médico ativo) e chama generateText no Gemini. Sem teto: a cota do médico conta apenas os canais 'app' e 'nutricao', e esta chamada grava canal 'teleconsulta'. Chamada paga, ilimitada, para quem não paga IA — enquanto /api/transcribe e o Segundo Cérebro barram no mesmo entitlement.

**Nenhum botão das duas abas trata falha, e o estado de 'carregando' trava para sempre quando a sessão expira**  
`src/routes/_authenticated/painel.tsx:3682`  
token() devolve string vazia quando a sessão expira (painel.tsx:244) e todos os validadores exigem accessToken min(10) — a server function REJEITA, a promessa estoura. Como create(), openRoom(), doGenerateNote(), doSaveNote() e handleConfirm() não têm try/finally, o setCreating(false)/setOpeningRoom(null)/setGeneratingNote(null)/setUpdatingId(null) nunca roda: o botão fica em 'Criando...' / 'Criando sala…' / 'Gerando...' para sempre, e em Consultas Pagas os dois botões ficam permanentemente desabilitados. Só o F5 sai disso. E quando a chamada VOLTA com {ok:false} (paciente não é sua, API key ausente, update recusado), nenhum desses handlers olha o retorno — a tela finge que deu certo. A LivesSection, no mesmo arquivo, faz certo (try/catch/finally + toast em todos os caminhos).

**A tabela `clinics` e as colunas `doctors.clinic_id/clinic_role` nao existem em NENHUMA migration — so no APLICAR_PENDENTES.sql**  
`supabase/APLICAR_PENDENTES.sql:2014`  
O medico com plano Pro Equipe abre o menu do perfil e clica em 'Minha clinica'. `getMyClinic` consulta `clinics` (42P01) e depois `doctors.clinic_id` (42703). No melhor caso ele ve a faixa 'rode o APLICAR_PENDENTES.sql'; a aba inteira (criar clinica, adicionar medico, operar cerebro) fica morta. `grep -rn 'clinics' supabase/migrations/` devolve UMA linha, e e comentario. `grep -rn 'clinic' supabase/BANCO_COMPLETO.sql` so acha `clinical_note`/`clinical_tools`. Ou seja: quem reconstruir o banco pelas migrations OU pelo BANCO_COMPLETO.sql nunca tera a tabela; ela so nasce se alguem rodar o PENDENTES a mao.

**`doctor_orders` esta fora do APLICAR_PENDENTES.sql — o unico botao de verdade da aba Ferramentas falha para sempre com 'Tente de novo'**  
`src/lib/clinical.functions.ts:1348`  
O medico abre Ferramentas, expande 'Suplementacao pre-natal padrao', clica 'Enviar a uma paciente', escolhe a paciente e confirma. O INSERT em `doctor_orders` volta 42P01, `emitirParaPaciente` devolve `{ok:false}`, o modal lanca e mostra 'Nao consegui enviar. Tente de novo.' — mensagem que convida a repetir um ato que nunca vai funcionar. A tabela so existe em `20260731030000_prescricoes_e_pedidos.sql` e em `supabase/APLICAR_RECEITAS.sql`; nao esta no APLICAR_PENDENTES.sql (o unico arquivo que o CLAUDE.md manda aplicar) nem no BANCO_COMPLETO.sql. O erro tambem nao distingue 42P01 de falha de rede, entao ninguem descobre que falta rodar um SQL.

**"Salvar perfil" falha SEMPRE num banco sem APLICAR_MEDICO.sql — a rede de 42703 esqueceu 4 colunas**  
`src/lib/doctors.functions.ts:513`  
O médico abre Meu Perfil, preenche/corrige qualquer campo e clica "Salvar perfil". O painel monta `perfil` sempre com consultation_currency, consultation_price_cents, focos e photo_url (painel.tsx:9596 — nunca undefined: moeda cai em "BRL", cents em 0, focos em [] e photo_url em ""). Num banco onde só o APLICAR_PENDENTES.sql foi rodado essas 4 colunas NÃO existem: o 1º update devolve 42703, a retentativa apaga só as 12 chaves de RICH_UPDATE_KEYS, manda as 4 de novo, toma 42703 outra vez e volta ok:false. A tela diz apenas "Não foi possível salvar o perfil." — sem citar SQL nenhum. Nada do perfil é salvo, nunca, por nenhum caminho: registerDoctor tem a MESMA lista incompleta, então o médico novo também não consegue se cadastrar.


### 🟡 SILENCIOSO

**getDoctorWaitlist ignora o campo error: falha de leitura vira "fila vazia"**  
`/home/user/doutorclovis/src/lib/admin.functions.ts:585`  
Tabela appointment_waitlist ausente (42P01/PGRST205), grant revogado ou qualquer erro de PostgREST devolvem data: null com error preenchido. O destructuring só pega data, então a função retorna { ok: true, entries: [] } — sucesso. O painel imprime "Ninguém na fila de espera no momento" e o contador mostra 0. O médico conclui que ninguém está esperando vaga e não oferta o horário cancelado a ninguém. Note o contraste com getMyWaitlist, sweepWaitlist e leaveWaitlist, que na mesma feature já foram corrigidas para logar/propagar erro.

**WaitlistSection transforma qualquer falha em lista vazia, sem faixa de aviso**  
`/home/user/doutorclovis/src/routes/_authenticated/painel.tsx:2327`  
Sessão expirada, rede caída ou ok:false do servidor caem no mesmo lugar que "a fila está mesmo vazia": setEntries([]). A tela então renderiza o texto tranquilizador "Ninguém na fila de espera no momento". O resto do painel tem o mecanismo certo para isso (setFonteFalhou, usado por SOS, vínculos, triagens, eventos e pré-consultas) — a fila é a única fonte da aba Agendamentos que não participa dele.

**A cascata da fila não avança por nenhum caminho do médico e o cron não está registrado**  
`/home/user/doutorclovis/vercel.json:5`  
O médico cancela uma consulta confirmada às 18h; offerFreedSlot oferta a vaga à 1ª da fila com prazo de 4h. Ela não responde. Às 22h a oferta venceu, mas ninguém a expira: sweepWaitlist só roda dentro de getMyWaitlist e getMyAppointments — ambos do lado da PACIENTE — e getDoctorWaitlist não o chama. O cron /api/waitlist-tick, que o CLAUDE.md descreve como a rede de segurança, não existe no vercel.json (o array crons só tem /api/push-weekly-tick), então nunca é chamado. Resultado: se nenhuma paciente abrir o app, a entrada fica "offered" para sempre, a 2ª da fila nunca recebe a vaga, o horário morre vago, e o painel do médico segue exibindo "vaga oferecida · até 22:00" indefinidamente.

**Painel 📊 e Calendário discordam da data da consulta: um usa preferred_date, o outro confirmed_date**  
`/home/user/doutorclovis/src/lib/dashboard.functions.ts:418`  
A paciente pede 01/08; o médico contrapropõe e ela aprova 20/08 (confirmed_date = 20/08, preferred_date continua 01/08). No dia 05/08 o card "Consultas" do Painel 📊 não conta essa consulta em confirmedUpcoming (porque preferred_date 01/08 < hoje) e não a mostra como "próxima consulta" — enquanto o Calendário, que lê confirmed_date, a exibe corretamente no dia 20. E quando o dashboard mostra alguma "próxima", o rótulo impresso é o preferred_date, ou seja, a data que a paciente PEDIU, não a que foi marcada. O médico pode se preparar para o dia errado.

**Pedido de consulta sem médico resolvido não aparece em painel nenhum, mas a paciente é avisada que será confirmado**  
`/home/user/doutorclovis/src/lib/appointments.functions.ts:99`  
Visitante não logada preenche /agendamento (página pública, sem médico na URL), ou paciente logada que ainda não escolheu médico (patient_profiles.doctor_id nulo). Ambas as resoluções falham e a linha é gravada com doctor_id: null. Como getAdminData recorta com .eq("doctor_id", scope.doctorId), a linha não entra na aba Agendamentos de NENHUM médico assinante — e a paciente recebe o e-mail "Recebemos sua solicitação... vamos confirmar o horário em até 1 dia útil". O pedido só existe como e-mail na caixa da plataforma; ninguém o vê no painel para confirmar, contrapropor ou cancelar.

**Paciente que perde o prazo de 4h some das duas telas sem nenhum aviso**  
`/home/user/doutorclovis/src/lib/waitlist.functions.ts:215`  
A oferta vence, sweepWaitlist marca status = 'expired' e cascateia. A partir daí a entrada não aparece mais em lugar nenhum: getDoctorWaitlist filtra .in("status", ["waiting","offered"]) e getMyWaitlist filtra a mesma coisa. A paciente que dormiu quatro horas abre o app e o cartão "Fila de espera" volta a oferecer "Entre na fila" como se ela nunca tivesse entrado — sem e-mail, sem push, sem uma linha explicando que ela perdeu o lugar. E o médico não tem como saber que ela continua precisando da consulta: ela simplesmente sumiu do contador da fila dele.

**sweepWaitlist e offerNextForWeek ignoram o error dos SELECTs e reportam sucesso**  
`/home/user/doutorclovis/src/lib/waitlist.functions.ts:204`  
Em sweepWaitlist, se o SELECT de vencidas falhar (tabela ausente, timeout, RLS), overdue fica indefinido, a função devolve 0 e /api/waitlist-tick responde { ok: true, expired: 0 } — indistinguível de "fila em dia". A própria função tem comentário reconhecendo esse risco para os UPDATEs (que ganharam log), mas o SELECT que abre tudo ficou sem. Pior em offerNextForWeek: o SELECT que confere se o slot já foi tomado também ignora o erro, e taken?.length de undefined é falsy — se a leitura falhar, o código conclui "slot livre" e oferta um horário que pode já ter dono, gerando o 23505 na cara da próxima paciente.

**Lista e contadores de Agendamentos truncados em 200 sem aviso**  
`/home/user/doutorclovis/src/lib/admin.functions.ts:165`  
getAdminData traz no máximo as 200 consultas mais RECENTES por created_at. Num consultório com ~25 pedidos/mês, a partir de oito meses de uso as mais antigas caem fora — inclusive uma consulta marcada há muito tempo para uma data futura, que então desaparece da grade do Calendário e da lista "Próximas confirmadas" sem qualquer indicação. Os chips de filtro contam sobre essa amostra: "Todos (200)" e "Pendente (14)" são números da amostra apresentados como números do consultório. É exatamente o defeito que a mesma função já consertou para perguntas (com count: "exact", head: true), mas não para consultas.

**✅ Painel: mapa de atividade lê a plataforma inteira em vez das pacientes do médico**  
`src/lib/dashboard.functions.ts:227`  
O médico abre a aba Painel. "Ativas esta semana" e "Oportunidade de reengajar 💛" saem de um mapa montado com as 5000 linhas mais RECENTES de health_logs/journal_entries/kick_sessions de TODA a plataforma — sem `.in("user_id", ids)` e sem recorte por médico (e o teto real do PostgREST na instalação é 1000, como o próprio repo documenta). Duas consequências: (a) numa base com várias consultórios, as pacientes DELE simplesmente não entram no recorte e o card mostra "Ativas esta semana: 0 · N sem abrir há 7 dias" enquanto a aba Engajamento, que faz a leitura recortada em lotes de 100, mostra outro número para o mesmo médico, na mesma janela de 7 dias — dois números discordando no mesmo painel; (b) o risco de abandono só entra na lista com `lastMs != null`, e a paciente que sumiu há 60 dias tem justamente as linhas MAIS ANTIGAS, as primeiras a serem cortadas pelo `order(created_at desc)` — então ela nunca aparece e o card afirma "✨ Ninguém em risco de abandono. Suas pacientes estão engajadas!". O card existe para achar quem sumiu e é estruturalmente incapaz de achar quem sumiu mais.

**Painel: toda falha de leitura vira zero, e a tela afirma o zero como boa notícia**  
`src/lib/dashboard.functions.ts:183`  
supabase-js não lança — devolve `{data, error}`. Em `getDoctorDashboard` o campo `error` NUNCA é lido em bloco nenhum: `(...).data ?? []`, `pendingRes.count ?? 0`, `entriesRes.count ?? 0`, `(health.data ?? [])`. O `safe()` que embrulha os blocos só captura exceção, que nunca acontece. Resultado: coluna `doctor_id` ausente (42703), tabela fora do schema cache (PGRST205) ou soluço de rede produzem exatamente a mesma tela de um consultório vazio, e a tela AFIRMA: "Pacientes conectadas 0", "🎉 Nenhuma pergunta pendente. Suas pacientes estão em dia!", "✨ Ninguém em risco de abandono", "Seu Segundo Cérebro está pronto para trabalhar por você" (brain_hits/brain_entries zerados) e "Nenhuma consulta confirmada nos próximos dias". O único erro que a aba sabe mostrar é a falha TOTAL da server function (`res.ok === false`). Nas outras telas do mesmo painel esse sinal existe — a FilaDeTrabalho recebe `fontesComFalha` e a aba Engajamento tem `atividadeIncompleta` ("📡 Não consegui ler todos os registros"). O Painel é a única sem nenhum.

**Painel: a carteira por trimestre ignora a data corrigida por ultrassom**  
`src/lib/dashboard.functions.ts:198`  
O bloco de fases usa SÓ `lmp_date`; o `select` nem pede `reference_date/reference_weeks/reference_days`, que é a DUM corrigida gravada no perfil. Paciente com dating corrigido e sem DUM cai em `stages.semData` — o card diz "Sem data" enquanto a aba Engajamento, o app dela e todo o resto do produto (`computeGestation`, que dá PREFERÊNCIA à referência) mostram, por exemplo, 32s4d. Paciente com DUM E correção é classificada pela DUM, que é o número que a correção existe para descartar: com uma correção de duas semanas ela aparece no 2º trimestre quando está no 3º. A mesma paciente, no mesmo painel, tem duas idades gestacionais dependendo da aba.

**O toast diz "Respondida e aprendida" mesmo quando ZERO pacientes foram avisadas — `avisadas` e jogado fora**  
`/home/user/doutorclovis/src/routes/_authenticated/painel.tsx:6826`  
resolveBrainGap devolve `{ ok: true, avisadas, parecidas }`. O painel le `parecidas` e ignora `avisadas` (grep "avisadas" em painel.tsx = 0 ocorrencias). entregarRespostaDaLacuna devolve 0 em varios caminhos reais: brain_gap_askers ausente (catch), insert em doctor_questions falhando (console.error + return 0), ou todas as pacientes ja desvinculadas. Em qualquer um deles o medico le "Respondida e aprendida pelo cerebro" e vai embora achando que fechou o ciclo com quem perguntou — quando ninguem recebeu nada. O card irmao (BrainReviewCard, linha 6495-6502) faz exatamente o contrario e diz "Nao consegui avisar a paciente desta vez"; a fila de lacunas ficou para tras.

**As lacunas parecidas fechadas no servidor continuam na tela e, ao serem respondidas, dao erro generico**  
`/home/user/doutorclovis/src/routes/_authenticated/painel.tsx:6841`  
Ao responder uma lacuna, fecharLacunasParecidas marca outras lacunas como 'respondida' no banco e o toast anuncia "3 perguntas parecidas tambem foram respondidas". Mas o setGaps local remove SO o gapId respondido — as tres parecidas continuam listadas. O medico clica "Responder" numa delas, escreve a resposta, e resolveBrainGap nao acha linha com status 'aberta' (`.eq("status", "aberta")` + `if (!gap) return { ok: false }`), devolvendo o generico "Nao foi possivel salvar — tente novamente.". Trabalho escrito e jogado fora, com uma mensagem que sugere problema de rede. Nao ha `load()` depois de resolver.

**A fila de lacunas mostra no maximo 50 sem dizer o total — e afirma "o cerebro cobriu tudo" quando ainda ha lacunas**  
`/home/user/doutorclovis/src/lib/secondbrain.functions.ts:1012`  
listBrainGaps tem `.limit(50)` e nao devolve contagem exata; o card usa `gaps.length` como badge. Com 200 lacunas abertas, o badge diz 50. Quando o medico termina as 50 da tela, `gaps.length === 0` e o card exibe "Nenhuma lacuna aberta — o cerebro cobriu tudo que perguntaram ate agora." com as outras 150 vivas no banco. Pior: no MESMO scroll, o BrainLevelCard mostra o item "Lacunas abertas (200)" vindo de getBrainScore, que faz count exact — dois numeros discordando na mesma tela. O card vizinho BrainTrainCard resolveu exatamente isto ("Mostrando as 50 mais antigas de 73"); a fila de lacunas nao tem o equivalente.

**curarLacunasDoMedico dispara ate 20 chamadas de embedding sem conferir plano**  
`/home/user/doutorclovis/src/lib/secondbrain.functions.ts:1130`  
Toda montagem do BrainGapsCard dispara `void curarLacunasDoMedico(...)`, que chama curarLacunasSemVetor -> ate CURA_POR_VEZ=20 embeddings pagos. Diferente de resolveBrainGap, draftGapAnswer, answerAndTrain, installStarterPack e testBrain, essa funcao NAO chama brainPlanAllows — so requireAdmin + resolveBrainDoctor, que aceitam qualquer medico com doctors.active. E ela e alcancavel no plano Free: `podeIA` comeca `useState(true)` e `tab` comeca em ABA_DE_ENTRADA = "Cerebro", enquanto `setAllowed(true)` (painel.tsx:628) acontece ANTES do `await getMyDoctor(...)` que descobre o plano — ou seja, o CerebroSection monta e dispara tudo no intervalo da ida ao servidor, antes de aplicarPlano trocar a aba. Custo de modelo pago por quem nao tem IA no plano, uma vez por abertura de painel.

**doctor_questions.doctor_id nao existe em nenhuma migration versionada — a aba inteira depende dela**  
`src/lib/admin.functions.ts:168`  
Num banco onde APLICAR_PENDENTES.sql nao foi rodado (o cenario declarado no CLAUDE.md), a coluna doctor_id nao existe em doctor_questions. Toda consulta da aba passa por scopedBy → `.eq("doctor_id", ...)` → PostgREST 42703. Como o erro e descartado (achado seguinte), a aba mostra 'Nenhuma pergunta ainda.' e a faixa 'nao consegui conferir tudo' fica APAGADA (res.ok=true zera fonteFalhou.consultasEPerguntas, painel.tsx:632). Responder tambem morre: responderPergunta busca a linha com `.eq("doctor_id", user.id)` (clinical.functions.ts:1477), a consulta erra, `pergunta` vem null e a funcao devolve {ok:false} generico — o toast diz 'Nao consegui enviar. Tente de novo.' para sempre, sem cair no aviso 'banco_desatualizado', que so cobre o payload do UPDATE.

**getAdminData descarta o campo error das duas consultas — lista vazia com cara de 'nao tem nada'**  
`src/lib/admin.functions.ts:188`  
Qualquer falha (coluna ausente, timeout, RLS) na consulta de doctor_questions OU na de patient_profiles devolve {data:null,error} — supabase-js nao lanca. O codigo faz `(questions.data ?? [])` e `(profiles.data ?? [])`, monta nameById vazio e o filtro por vinculo derruba TODAS as perguntas. O handler devolve ok:true, o painel zera fonteFalhou.consultasEPerguntas e a aba renderiza 'Nenhuma pergunta ainda.' (painel.tsx:2846). Detalhe cruel: basta a consulta de patient_profiles falhar — nada a ver com perguntas — para a aba ficar vazia e silenciosa. O irmao no Cerebro faz o certo (listUnansweredQuestions devolve ok:false e a tela mostra a faixa ambar 'isto nao quer dizer que nao ha nenhuma').

**Treinar o cerebro pela aba Perguntas nao verifica plano (chamada de embedding paga no Free)**  
`src/lib/clinical.functions.ts:1547`  
A aba Perguntas esta em DOCTOR_TABS para todos os planos (painel.tsx:250) e o checkbox 'Ensinar isto a minha IA' aparece sempre. No plano Free (aiApp=false) a aba Cerebro mostra TrancadoCard, mas por aqui o medico insere em brain_entries e dispara embedBrainEntry → embedText, que e chamada real a API de embeddings do Google, medida por registrarUso (embeddings.server.ts:154). A chave da plataforma gasta por quem nao paga IA, sem teto. E a tela mente: o toast diz 'Respondida, avisada e a IA aprendeu ✓' para um medico cuja IA esta desligada e nunca vai usar aquele conhecimento.

**Badge conta pelo carimbo e a lista filtra pelo vinculo — numero fantasma que nunca zera**  
`src/lib/admin.functions.ts:213`  
A contagem exata de pendentes usa so scopedBy (carimbo doctor_id na linha); a LISTA usa scopedBy MAIS o filtro de vinculo atual (nameById). Depois de encerrar o acompanhamento de uma paciente com 3 perguntas em aberto, o badge da aba Perguntas e o Stat 'Perguntas a responder' continuam dizendo 3 enquanto a aba mostra 'Nenhuma pergunta ainda.'. Nenhuma acao do painel faz esse numero baixar — as linhas nao sao mais alcancaveis por nenhuma tela. E o mesmo defeito de 'dois numeros para a mesma coisa' que o comentario ao lado do codigo diz ter consertado.

**listPatientRequests nunca olha o campo error — solicitação de vínculo some em silêncio**  
`src/lib/patientlink.functions.ts:309`  
A paciente busca o médico, envia a solicitação e passa a ver "aguardando o médico aceitar". No painel, a leitura de patient_link_requests falha (tabela ausente em produção → 42P01/PGRST205, ou timeout/RLS) e o destructuring só pega `data`. `rows` vem undefined, a função devolve `{ ok: true, requests: [] }` — sucesso. A aba Pacientes desenha o cartão "📭 Nenhuma solicitação pendente" e a fila de trabalho do Painel executa `if (pr.ok) … setFonteFalhou({vinculos:false})`, ou seja, apaga o próprio aviso de falha. O médico nunca fica sabendo que alguém pediu para ser acompanhada, e não existe tela nenhuma onde isso apareça. `patient_link_requests` só existe na migration 20260709000000 / APLICAR_PENDENTES.sql — é exatamente o lote pendente descrito no CLAUDE.md.

**listMyPatients devolve ok:true com lista vazia em QUALQUER erro — inclusive coluna doctor_id ausente**  
`src/lib/patientlink.functions.ts:564`  
A cascata de selects degrada as COLUNAS opcionais, mas `.eq("doctor_id", user.id)` está nas seis tentativas. Se `patient_profiles.doctor_id` não existir no banco (coluna adicionada em 20260709000000 / APLICAR_PENDENTES.sql:1175), o PostgREST devolve 42703 para todas as seis, o laço termina com `rows = null` e a função retorna `{ ok: true, patients: [] }`. O mesmo acontece com qualquer erro que não seja 42703 (permissão, statement_timeout, 42P01): o `break` sai com `rows = null` e o retorno continua sendo `ok: true`. Na tela, `patients.length === 0` cai no estado vazio de onboarding: "👩‍🍼 Você ainda não tem pacientes vinculadas. Compartilhe seu perfil para que elas encontrem você…". Um médico com 40 pacientes lê que não tem nenhuma, com um convite para divulgar o perfil. Não há `missingTable` nem faixa de erro — ao contrário de `listLivesAdmin`, que no mesmo arquivo do painel devolve `missingTable`.

**pacientesAtuais engole o erro e a fila clínica responde "nada esperando por você"**  
`src/lib/clinical.functions.ts:191`  
`pacientesAtuais` é o recorte de TODAS as funções clínicas e lê patient_profiles sem checar `error`. Falhando (42703 se doctor_id não existe, timeout, rede), devolve Map vazio. Em `eventosQuePedemOlhar` isso cai no atalho `if (ids.length === 0) return vazio;` — e `vazio` tem `incompleto: false`. O painel faz `if (r.ok) { setEventosClinicos(r.eventos); setFonteFalhou({eventos: r.incompleto}) }`, então a faixa de leitura incompleta é DESLIGADA e a fila de trabalho fica vazia: uma paciente com 178/112 registrada hoje não aparece em lugar nenhum e a tela afirma completude. O próprio cabeçalho do arquivo diz que isso não pode acontecer ("devolvê-lo aqui transformava uma falha de leitura em 'nada esperando por você'") — o `catch` foi corrigido, mas o caminho `ids.length === 0` não. `examesRecebidos` (linha 1057) tem o mesmo atalho e vira "Nenhuma paciente enviou exame".

**Histórico de SOS da paciente some da ficha em silêncio quando a leitura do vínculo falha**  
`src/lib/acionamentos.functions.ts:99`  
`acionamentosDaPaciente` usa a sua própria cópia de `pacientesAtuais`, também sem checar `error`. Numa falha de leitura o array volta vazio, `!atuais.includes(pacienteId)` é verdadeiro e a função devolve `{ ok: true, acionamentos: [] }`. No PatientDetailModal o bloco "🆘 Acionamentos de emergência" só renderiza com `sosDela.length > 0` — ou seja, ele simplesmente não existe na tela. Uma paciente que apertou o SOS três vezes abre como uma ficha sem nenhuma emergência, sem qualquer marca de que a leitura falhou. É o mesmo padrão do achado anterior, com a agravante de ser o dado que o comentário do modal chama de "a primeira coisa que o médico precisa ver ao abrir a ficha".

**Aceitar/recusar solicitação: try/finally sem catch — botão sem reação e sem mensagem**  
`src/routes/_authenticated/painel.tsx:10765`  
`respond()` embrulha a chamada num `try { … } finally { setRespondingId(null) }` sem `catch`. Se `respondPatientRequest` rejeitar (queda de rede, 500, sessão expirada — `tokenFn()` devolvendo string vazia faz o `inputValidator` lançar), a promessa vira unhandled rejection: nenhum toast, o card continua na lista e o botão volta a ficar clicável. O médico toca em "Aceitar", vê um "…" piscar e conclui que aceitou. Enquanto isso a paciente segue vendo "aguardando o médico aceitar". As duas ações irmãs da mesma seção — `encerrar()` e `togglePremium()` — têm `catch { toast.error("Falha de conexão — tente novamente.") }`; só a mais importante das três não tem.

**PacientesSection não tem estado de falha: erro no carregamento vira o mesmo vazio bonito**  
`src/routes/_authenticated/painel.tsx:10748`  
O efeito de carga inicial é `try { … } finally { setLoading(false) }`, sem catch, e cada resultado é aplicado só sob `if (res.ok)`. Existem três caminhos que produzem `ok:false` sem nenhum aviso na tela: assinatura vencida (`requireDoctor` recusa quando `doctors.active === false`), token expirado, e falha de rede (que rejeita e nem chega no `if`). Nos três, `loading` vira false e a aba pinta "📭 Nenhuma solicitação pendente" + "Você ainda não tem pacientes vinculadas". Não há botão de recarregar nem faixa de erro dentro da seção — o médico não tem como distinguir "não há ninguém" de "não consegui ler", que é justamente a distinção que o resto do painel (`fonteFalhou`, `incompleto`) foi construído para preservar.

**O vínculo é gravado sem conferir se alguma linha foi afetada — a solicitação já foi consumida**  
`src/lib/patientlink.functions.ts:411`  
`respondPatientRequest` primeiro RECLAMA a solicitação (status vira "accepted") e só depois grava `patient_profiles.doctor_id`. Esse UPDATE checa apenas `linkErr` — não faz `.select("id")` nem confere linhas afetadas. Um UPDATE que casa zero linhas (perfil da paciente inexistente ou apagado por LGPD com a conta auth ainda viva, ou o gatilho `trg_protect_doctor_id` reescrevendo `NEW.doctor_id := OLD.doctor_id` se a conexão não estiver com `current_user = 'service_role'`) não devolve erro: `desfazer()` não roda, a função retorna ok, o painel mostra "Paciente vinculada ✓", dispara o push "aceitou te acompanhar" para ela — e ela não aparece em `listMyPatients` porque nunca foi vinculada. A solicitação já não está mais "pending", então o item também some da fila. O padrão correto está a 280 linhas de distância no mesmo arquivo, com o comentário "sem isto, zero linhas afetadas voltava como sucesso".

**Extração da consulta cria rascunhos e a Base de conhecimento logo abaixo não recarrega**  
`src/routes/_authenticated/painel.tsx:5407`  
O médico cola a transcrição, clica '🧠 Extrair conhecimento', recebe 'N rascunhos criados na sua voz 🎙️ — revise e aprove na Base de conhecimento 👇' e rola dois cartões para baixo: a lista está exatamente igual. BrainKnowledgeCard carrega num efeito com deps [search, tokenFn], e tokenFn é uma função de módulo (painel.tsx:240), referência estável — nada dispara recarga. Os rascunhos só aparecem se ele recarregar a página ou digitar algo na busca. Como nascem approved:false, a conclusão natural é 'não gravou', e extrair de novo duplica tudo: o INSERT de extractKnowledgeFromTranscript não é idempotente (secondbrain.functions.ts:2334-2345).

**'Estilo do médico' fica em esqueleto para sempre quando o carregamento lança**  
`src/routes/_authenticated/painel.tsx:7111`  
Sessão expirada → token() devolve "" → o TokenSchema do servidor (`accessToken: z.string().min(10)`) rejeita e a server function LANÇA. O efeito do BrainSettingsCard não tem try/catch nem .catch: a rejeição fica sem tratamento, `settings` continua null e o cartão exibe duas barras cinzas pulsando indefinidamente — sem toast, sem erro, sem forma de editar persona, frases e regras. O médico acha que a tela está 'carregando'. Todos os outros cartões da aba (Conversas, Busca por significado, Base de conhecimento, Playground) envolvem a mesma chamada em try/catch.

**brain_entries.updated_at não existe em nenhuma migration nem no schema completo**  
`supabase/APLICAR_IDADE_DO_CONHECIMENTO.sql:29`  
A coluna `updated_at` de `brain_entries` é criada SÓ neste arquivo avulso. Não está em supabase/migrations/ (a única migration da tabela, 20260707180000_second_brain.sql, cria brain_entries sem ela), não está em APLICAR_PENDENTES.sql (que só adiciona `source` e `embedding`), não está em BANCO_COMPLETO.sql, e o CLAUDE.md não manda rodá-lo. Em produção e em qualquer banco novo (`supabase db push`), updateBrainEntry cai no ramo colunaAusente e salva sem carimbar data; diasSemRevisao devolve null; precisaDeRevisao devolve false; o selo 'revisar · N anos sem olhar' NUNCA aparece. A peça que existe para o médico enxergar conduta obstétrica vencida está desligada, e nada na tela diz isso.

**A lista de 'Conversas da IA' é uma amostra de 600 mensagens e se apresenta como completa**  
`src/lib/secondbrain.functions.ts:2528`  
listBrainConversations lê as 600 mensagens mais recentes do CONSULTÓRIO inteiro e monta a lista de pacientes a partir dessa janela. A contagem por paciente já foi corrigida com um count exato, mas QUEM aparece na lista continua saindo da amostra: numa agenda movimentada 600 mensagens são poucas semanas, e a paciente que conversou muito com a IA há um mês simplesmente some do cartão. O texto do cartão promete 'o que a IA respondeu em cada chat, paciente por paciente' e não há nenhuma indicação de recorte — é a única tela onde o médico supervisiona o que é dito em nome dele.

**Falha ao ler o vínculo esvazia a lista de conversas sem dizer nada**  
`src/lib/vinculo.server.ts:49`  
vinculadasAgora descarta o campo error do supabase-js. Qualquer falha na leitura (rede, timeout do PostgREST) devolve data = null → Set vazio → soVinculadas filtra TODAS as mensagens → listBrainConversations responde ok:true com conversations: [] → o cartão mostra 'Nenhuma conversa registrada ainda. Assim que uma paciente falar com a IA no app, a conversa aparece aqui.' O médico lê que a IA nunca conversou com ninguém. Falha fechando (não vaza dado), mas mente com convicção — e é a mesma função que recorta getBrainConversation.

**Custo da transcrição é carimbado no usuário errado e some do consumo**  
`src/routes/api/transcribe.ts:181`  
O gate resolve corretamente o plano do MÉDICO quem chama é a paciente (`ent = await getEntitlementsByDoctorId(perfil.doctor_id)`), mas a medição grava `doctorId: usuario.id` — o uuid da PACIENTE. Como todo leitor de ai_usage filtra `.eq("doctor_id", …)` (diagnosticarBusca, respostasNoCiclo, card de consumo), a linha não aparece no card de consumo de médico nenhum: é a chamada mais cara da base (até 20 MB de áudio, ~32 tokens/segundo) gravada num doctor_id que não é de médico. É exatamente o efeito que o comentário deste bloco diz existir para evitar ('não aparecia no card de consumo, nem na projeção do mês'). O mesmo desvio vale para o gestor de clínica: a transcrição feita no cérebro do Dr. X entra na conta do gestor.

**getPreConsultaForms engole o error das duas consultas e devolve ok:true com lista vazia — a faixa de falha que o painel construiu nunca acende**  
`src/lib/admin.functions.ts:875`  
As duas leituras usam destructuring só de `data`. Se `preconsulta_forms` falhar (coluna doctor_id ausente = 42703, RLS, timeout) `forms` vem null e a função devolve `{ok:true, forms:[]}`. O painel faz `if (res.ok) { setPreForms(res.forms); setFonteFalhou(preConsultas:false) }` — ou seja, marca a fonte como SAUDÁVEL. A aba Pré-consultas mostra 'Nenhuma pré-consulta recebida ainda' e a fila da tela inicial mostra '☕ Nada esperando por você' com pré-consultas não lidas do outro lado. O mesmo vale para a segunda consulta: se `patient_profiles` falhar, `nameById` fica vazio e o `.filter(f => scope.isTeam || nameById.has(f.user_id))` descarta TODAS as pré-consultas de um médico assinante — lista vazia, ok:true, zero aviso. É exatamente o defeito que o comentário em painel.tsx:378-381 diz que o flag `fonteFalhou.preConsultas` existe para impedir; o servidor nunca deixa ele ser ligado.

**pacientesAtuais engole o error e vira 'Nenhuma paciente enviou exame' com incompleto:false**  
`src/lib/clinical.functions.ts:191`  
`pacientesAtuais` é o recorte de tudo no arquivo e lê patient_profiles sem checar o campo error. Se essa leitura falhar (timeout, 414 numa instalação grande, RLS), devolve um Map vazio. Em `examesRecebidos` isso cai em `if (ids.length === 0) return vazio;` — e `vazio` tem `incompleto:false`. O médico vê o cartão '🧾 Nenhuma paciente enviou exame nos últimos 120 dias' SEM a tarja âmbar, que é justamente o mecanismo que o resto da função construiu para separar 'não há exame' de 'não consegui ler'. O comentário na própria função (linhas 1043-1045) diz que essa distinção existe; o caminho de erro mais provável a atravessa.

**listarTriagens devolve ok:true com lista vazia quando a leitura falha — inclusive com triage_logs ausente em produção**  
`src/lib/triage.functions.ts:190`  
Dois pontos cegos. (1) `const { data: perfis } = await sb.from("patient_profiles")...` ignora o error: falha vira ids=[] e `return vazio` (ok:true). (2) `if (error) return vazio;` na leitura de triage_logs devolve ok:true também — o comentário ao lado diz 'Migração pendente: sem a aba, não sem o painel', mas ok:true faz o painel gravar `fonteFalhou.triagens = false`, ou seja, declarar a fonte saudável. Numa instalação onde APLICAR_PENDENTES.sql ainda não rodou, triage_logs não existe: a triagem vermelha (cefaleia com escotoma + 175/115, o cenário que a docstring da própria função descreve) some sem uma palavra, e a lista 'alertas de sintomas' nunca aparece em fontesComFalha.

**Na aba Exames da paciente, uma foto que o navegador não decodifica salva o exame SEM o laudo e ninguém é avisado**  
`src/routes/_authenticated/minha-conta.tsx:18942`  
`handleFile` cria `new Image()` e só define `img.onload`. Sem `onerror`: um HEIC de iPhone em Android antigo, ou qualquer arquivo que o canvas não decodifique, faz `setImageData` nunca rodar — o estado fica null, a miniatura não aparece e nenhum toast é mostrado. A paciente clica 'Salvar exame', o insert grava `image_data: imageData` = null, o botão volta ao normal e o exame entra na lista com nome, semana e observação. Do lado do médico isso vira exatamente o pior texto possível: `imagemDoExame` responde `motivo:"sem_imagem"` e a tela dele afirma 'Este registro não tem imagem anexada — só a anotação dela'. O caminho gêmeo no chat foi corrigido para isso e tem o comentário explicando ('não some em silêncio — ela precisa saber para tirar outra foto'); esta tela ficou para trás.

**Pré-consulta preenchida antes do vínculo com o médico fica invisível para sempre**  
`src/lib/preconsulta.functions.ts:48`  
`submitPreConsulta` carimba `doctor_id: prof?.doctor_id ?? null` no momento do envio. `getPreConsultaForms` filtra com `scopedBy`, que para médico assinante é `qb.eq("doctor_id", scope.doctorId)` — linha com doctor_id NULL nunca casa. Fluxo real: a paciente cria conta, preenche a Pré-consulta (a tela não exige vínculo e responde 'Formulário enviado! Seu médico receberá seu resumo antes da consulta'), e só depois solicita vínculo e é aceita. O formulário dela some: fica com doctor_id NULL para sempre, não aparece na aba Pré-consultas nem na fila. Mesma coisa para quem troca de médico — o novo nunca vê o histórico de pré-consultas. Aqui o carimbo na linha é o filtro PRIMÁRIO (o recorte pelo vínculo atual, via nameById, entra só como AND adicional), que é o inverso do contrato do CLAUDE.md: não vaza, mas esconde.

**Apagar um exame na aba da paciente não apaga o laudo do balde do Storage**  
`src/routes/_authenticated/minha-conta.tsx:18991`  
O botão × da aba Exames faz o DELETE direto do navegador com a chave anon. O navegador não tem (nem pode ter) acesso ao Storage — os baldes são privados e sem policy por decisão explícita —, então o arquivo em `exam_files.image_path` fica no balde 'exames' para sempre, órfão, sem linha que o aponte e sem nenhum caminho no produto que o encontre. A paciente vê o exame sumir da lista e conclui que o laudo foi apagado; ele não foi. O caminho equivalente do álbum foi tratado (family.functions.ts lê image_path antes do delete e chama apagarImagem, com teste cobrindo); o exame não. Só fica vivo depois que APLICAR_IMAGENS_NO_STORAGE.sql for aplicado — o que faz dele um defeito que nasce junto com a correção do achado nº 1.

**loadTeleconsultas e loadPrivateConsults jogam o erro no lixo — inclusive a mensagem que diria ao médico o que fazer**  
`src/routes/_authenticated/painel.tsx:703`  
Com a tabela ou a coluna ausentes (o estado documentado de produção), getPrivateConsultationsForDoctor devolve literalmente {ok:false, error:'Aplique a migração de consultas (APLICAR_PENDENTES.sql) no Supabase.'} — e o painel descarta a string. A tela renderiza 'Nenhuma consulta particular solicitada ainda.' O médico conclui que ninguém pediu consulta particular; na verdade o banco recusou a query. Idem para Teleconsultas. Nenhuma das duas alimenta `fonteFalhou`, que é justamente o mecanismo que este painel usa em todas as outras fontes (sos, vinculos, preConsultas, triagens, eventos) para mostrar a faixa 'não consegui conferir tudo'.

**O painel mostra o preço de TABELA da plataforma, não o que o médico cobrou — o app da paciente já foi corrigido, o painel não**  
`src/routes/_authenticated/painel.tsx:4095`  
Um médico com consultation_price_brl = R$ 600 recebe um pedido de 'Plantão de Dúvidas'. O servidor cobra 600 e grava amount_cents = 60000; a paciente vê 'R$ 600,00' no app e paga 600. No painel dele, o mesmo pedido aparece como 'Plantão de Dúvidas (30 min) · R$ 150'. Ele confere o PIX de 600 contra um painel que diz 150 e não sabe qual dos dois está certo. O campo amount_cents está na linha e nunca é lido pela tela do médico.

**O aviso 'sala de teleconsulta aberta' na tela de entrada NUNCA aparece — o array só é carregado depois de o médico abrir a aba**  
`src/routes/_authenticated/painel.tsx:1118`  
A paciente está na sala esperando. O médico abre o painel no celular e lê 'Nada esperando por você agora.' O cartão verde '🎥 Uma sala de teleconsulta aberta — A paciente já está esperando' está implementado e é inalcançável, porque quem o alimenta é o estado `teleconsultas`, e `teleconsultas` só é carregado dentro do efeito 'if (tab === "Teleconsultas")'. Na aba de entrada o array é []. O mesmo vale para o número na fita: o contador que existe para o médico ir até a aba só deixa de ser zero DEPOIS que ele foi até a aba. Todas as outras fontes do resumo (SOS, perguntas, agendamentos, pré-consultas) são carregadas no mount; teleconsultas é a única que não é — e também é a única que o refresh de 3 minutos não atualiza.

**A página pública /lives nunca mostra a live do médico — mostra a live estática do fundador**  
`src/lib/lives.functions.ts:69`  
O médico cadastra a live, lê no painel 'O que você cadastrar aqui aparece na página pública /lives' e divulga obstetrica.com.br/lives no Instagram dele. Quem abre o link sem estar logado recebe a consulta filtrada por doctor_id IS NULL — e toda live criada no painel nasce carimbada com o doctor_id dele, então o resultado é zero linhas. A página cai no fallback estático: 'Sangramento no início da gestação: quando se preocupar', 20/06/2026, com botão para o Instagram do Dr. Clóvis Bacha. Numa plataforma multi-inquilino, o médico divulga a própria live e o visitante é mandado para o Instagram de outro profissional.

**A lista de medicos da clinica ignora o campo `error` — falha vira 'Nenhum medico ainda'**  
`src/lib/clinic.functions.ts:114`  
O admin da clinica abre a aba Clinica. Se a consulta a `doctors` falhar por qualquer motivo — coluna `clinic_role` ausente no banco (42703, cenario real em producao), timeout, PostgREST fora do ar — `docs` vem null, `rows` vira [], `members` vira [] e a tela renderiza 'Nenhum medico ainda — adicione o primeiro pelo e-mail acima'. O gestor conclui que a clinica esta vazia e reconvida gente que ja esta dentro. Nada no codigo olha `error`.

**Placar do cerebro de cada medico mostra 0 quando a consulta falha — numero falso usado para avaliar a equipe**  
`src/lib/clinic.functions.ts:143`  
Cada cartao de medico na aba Clinica exibe '🧠 N entradas' e '🕳️ N lacunas'. As duas contagens usam `?? 0` sobre o resultado sem olhar `error`. `brain_entries` e `brain_gaps` sao tabelas pendentes (brain_gaps so existe no APLICAR_PENDENTES.sql:1936): sem elas, TODOS os medicos aparecem com '0 entradas · 0 lacunas', e o gestor le isso como 'ninguem treinou o cerebro' em vez de 'a consulta falhou'. `computeBrainQualityStats`, chamado na mesma linha, faz o certo (checa error, devolve null e a tela esconde o campo) — as duas contagens vizinhas nao.

**Erro do RPC vira a afirmacao falsa 'Nenhuma conta com esse e-mail'**  
`src/lib/clinic.functions.ts:223`  
O admin digita o e-mail de um colega que TEM conta e clica '+ Adicionar'. Se `get_user_id_by_email` falhar (a funcao vive em `20260707200000_multi_tenant_core.sql` e no APLICAR_PENDENTES — em producao pode nao existir, e ai o erro e 42883), o codigo trata o erro exatamente como 'usuario nao encontrado' e o toast diz: 'Nenhuma conta com esse e-mail. Peca para o medico se cadastrar primeiro.' O admin liga para o colega e manda ele criar uma segunda conta que ja tem.

**`ClinicaSection.load()` sem `else`: sessao expirada mostra o formulario 'Criar a clinica' a quem ja tem clinica**  
`src/routes/_authenticated/painel.tsx:8069`  
O medico deixa o painel aberto, o access token expira, ele clica em 'Minha clinica'. `getMyClinic` devolve `{ok:false}` (o handler retorna isso quando `authedUser` falha). Como so existe o ramo `if (res.ok)`, `clinic` continua null, `loading` vira false no finally e a tela renderiza 'Sua clinica / Criar a clinica' — como se a clinica e os medicos dela nao existissem. Nao ha toast nem faixa de erro nesse caminho: o toast so aparece se a promessa LANCAR, e `ok:false` nao lanca.

**`emissoesDaPaciente` esta implementada e nenhuma tela a chama — o medico nao ve o que emitiu**  
`src/lib/clinical.functions.ts:1392`  
O medico envia uma receita pela aba Ferramentas e o modal promete 'fica registrado no prontuario dela'. Depois ele quer conferir o que prescreveu: nao ha lugar nenhum. `grep -rn 'emissoesDaPaciente' src/` so acha a propria definicao e um comentario — zero importadores. E `doctor_orders` tambem NAO e fonte da view `clinical_events` (grep 'doctor_orders' em APLICAR_EVENTOS_CLINICOS.sql e em 20260731000000_eventos_clinicos.sql: nenhuma ocorrencia), entao a emissao tambem nao chega ao prontuario por esse caminho. Server function completa, com recorte multi-inquilino correto, inalcancavel.

**A paciente pode nunca ver a receita: `MeusPedidos` engole o erro e a secao inteira desaparece**  
`src/routes/_authenticated/minha-conta.tsx:10119`  
O medico envia e o painel diz 'Receita enviada — ela foi avisada ✓'. Do lado dela, `MeusPedidos` le `doctor_orders` pelo navegador ignorando `error`; qualquer falha (rede, RLS, grant) deixa `itens` vazio e o componente retorna null — a secao 'Do seu medico' simplesmente nao existe na tela. Ela abre o app pelo push, nao acha nada, e o medico ja recebeu a confirmacao de que ela foi avisada. As duas metades do mesmo ato afirmam coisas opostas.

**Operar cerebro pela clinica pula o gate de plano, e `clinics.active` nunca e desligada**  
`src/lib/secondbrain.functions.ts:121`  
`brainPlanAllows` devolve `true` incondicionalmente quando `viaClinic`, com a justificativa de que 'a autorizacao acima exige clinica ativa'. Mas nada no repositorio escreve `clinics.active = false`: `grep -rn 'from("clinics")' src/lib/` da cinco leituras e zero UPDATE/DELETE, e nao existe funcao de apagar clinica. Entao um admin cuja assinatura venceu (rebaixado a `free` por `planoVigente`) continua sendo admin de uma clinica `active = true`, e `testBrain`, o eval e o backfill de embeddings seguem chamando o modelo com a chave da plataforma pelos cerebros dos medicos da clinica. `addClinicDoctor` acaba barrado por `maxBrains`; as chamadas de modelo nao tem essa rede.

**"Desconectar" a Google Agenda avisa sucesso mesmo quando o refresh token continua guardado**  
`src/routes/_authenticated/painel.tsx:8840`  
O médico clica "Desconectar" no GoogleCalendarCard para retirar o consentimento de acesso à agenda dele. O painel descarta o retorno da função: qualquer falha do delete (tabela doctor_google_tokens ausente, erro de rede/policy) é ignorada, o selo vira "Não conectada" e o toast diz "Agenda desconectada.". O refresh_token continua na tabela e o servidor segue criando reunião na agenda pessoal dele nas próximas teleconsultas. O servidor foi escrito de propósito para avisar (loga e devolve ok:false) e ninguém escuta.

**O "1 mês grátis" da indicação de colega nunca chega para quem está pagando**  
`src/routes/_authenticated/painel.tsx:8761`  
O ReferralCard promete "Quando um deles assinar um plano pago, você ganha 1 mês grátis (aplicado no seu plano)" e exibe o placar "N assinaram — meses grátis ganhos". A recompensa real só empurra doctors.plan_expires_at em +30 dias. Para o médico assinante (plan `mensagens`) isso não vale um mês: a Stripe cobra a mensalidade normalmente e a própria renovação sobrescreve plan_expires_at com o periodEnd da fatura, apagando os 30 dias. Para o médico em `free` também não vale nada: planoVigente("free", data_futura) devolve "free", e free não tem IA. Sobra efeito só para linhas legadas em `trial` — e registerDoctor não cria mais ninguém em trial ("O trial de 14 dias saiu"). O médico indica colegas, vê o contador subir e nunca deixa de pagar um mês.

**A mesada de Sementinhas ignora o plano: R$ 999/mês e Free recebem os mesmos 450 🌱**  
`src/lib/mesada.functions.ts:80`  
O cartão diz "Todo mês você ganha um bolso de Sementinhas — do tamanho do seu plano" e o código comenta que "o cartão some para quem não tem bolso — médico no Free não tem o que dar". Nenhuma das duas coisas acontece: `mensagensContratadas` devolve a constante ENTRADA_MENSAGENS (150) para todo mundo, ignorando o argumento doctorId, então a mesada é sempre 150×3 = 450 🌱. Quem comprou 5.000 mensagens recebe 450 em vez de 15.000; quem está no Free (nunca pagou) também recebe 450 e distribui moeda às pacientes. E como 450 > 0, o guarda `if (mesada.total <= 0) return null` nunca esconde o cartão. O comentário que justifica o congelamento está vencido: a coluna que ele diz não existir já existe e já é lida em outro lugar.

**Sem a tabela doctor_addresses a tela mostra lista vazia E marca o endereço como preenchido no progresso**  
`src/lib/doctor-addresses.functions.ts:70`  
doctor_addresses só existe no APLICAR_MEDICO.sql (não está no APLICAR_PENDENTES.sql nem no BANCO_COMPLETO.sql). Num banco sem ele: (a) listMyAddresses engole o erro e devolve lista vazia, e o EnderecosCard escreve "Nenhum endereço cadastrado. A paciente não tem como saber onde você atende." — como se ele simplesmente não tivesse cadastrado; (b) pior, getMyDoctor deixa `temEndereco` em undefined e pendenciasDoMedico só cobra quando é `=== false`, então NÃO entra pendência de endereço; MeuPerfilSection deduz `temEndereco = !pendencias.some(p => p.campo === "endereco")` = true e o PerfilProgresso, logo acima do card, marca o endereço como CONCLUÍDO. Duas afirmações contrárias na mesma tela e o médico fica invisível para a busca achando que está completo. Só quando ele tenta salvar é que aparece o aviso do SQL.

**Salvar um endereço desmarca o principal ANTES de gravar e não desfaz se a gravação falhar**  
`src/lib/doctor-addresses.functions.ts:119`  
O médico edita o endereço já existente (ou cria um novo) com "Este é o endereço principal" marcado. A função primeiro roda um UPDATE que zera is_primary em TODOS os endereços dele — sem conferir o error dessa escrita — e só depois tenta gravar a linha. Se o insert/update falhar (CHECK, rede, coluna faltando), volta ok:false e a tela diz "Não foi possível salvar o endereço", mas o consultório que era o principal já perdeu a marca e ninguém repõe. A partir daí a paciente passa a ver um endereço escolhido por ordem de chegada em vez do que o médico elegeu, e nada na tela indica isso.


### ⚪ INCÔMODO

**Consultas em counter_proposed e declined não têm filtro nem ação direta**  
`/home/user/doutorclovis/src/routes/_authenticated/painel.tsx:2578`  
Depois de sugerir um horário, o pedido sai de pending e vira counter_proposed; se a paciente recusar, vira declined. Os chips de filtro só oferecem all/pending/confirmed/done/cancelled, então esses dois estados só existem dentro de "Todos" — justamente os que exigem ação do médico. E no cartão de uma consulta declined o botão "Confirmar / sugerir horário" não aparece (a condição só cobre pending e counter_proposed): para propor outro horário a alguém que recusou, ele precisa descobrir sozinho que tem que clicar em "Pendente" antes.

**Fila de espera do painel carrega uma vez e não reage ao cancelamento que ela mesma dispara**  
`/home/user/doutorclovis/src/routes/_authenticated/painel.tsx:2323`  
WaitlistSection busca no mount com useEffect(..., []) e nunca mais. Nem o onRefresh de Agendamentos (que chama load()) nem o poll de 3 minutos do painel a recarregam — o poll atualiza consultas, pré-consultas, triagens e eventos, mas não a fila. Então o médico cancela uma consulta confirmada na mesma tela, o servidor oferta a vaga à 1ª da fila, e o cartão logo abaixo continua mostrando essa mesma paciente como "aguardando". Ele só vê a verdade se trocar de aba e voltar (o que desmonta e remonta o componente).

**Painel: "este mês" e "hoje" são calculados no fuso do processo (UTC), não em Brasília**  
`src/lib/dashboard.functions.ts:162`  
`monthStart` e `todayStr` são montados com o fuso de quem roda, e a Vercel roda em UTC. Às 21h de Brasília do último dia do mês, `monthStart` já virou: "Valor gerado este mês", `newThisMonth`, `answeredThisMonth` e `hitsThisMonth` zeram três horas antes da meia-noite dele — e, no primeiro dia, carregam as últimas três horas do mês anterior. Todo dia às 21h BRT, `todayStr` também vira para amanhã, e as consultas confirmadas de HOJE somem de "Consultas confirmadas" e de "Próxima consulta confirmada". O mesmo painel já tem a régua certa em outro card: `inicioDoCiclo` do ConsumoDaIACard fixa America/Sao_Paulo e documenta este exato defeito.

**Engajamento: "Pré-consultas novas" continua contando as que o médico acabou de ler**  
`src/routes/_authenticated/painel.tsx:872`  
O médico lê as pré-consultas na aba Pré-consultas; `markSeen` atualiza só o estado local `preForms`. O objeto `engagement` — de onde saem o Stat "Pré-consultas novas" (linha 3483) e a etiqueta "Pré-consulta nova" ao lado de cada paciente ativa — vive no estado do pai e só é recarregado sob a condição `!engagement` (linha 821). Como ele já está carregado, a condição nunca é verdadeira: ele volta à aba Engajamento e continua vendo "Pré-consultas novas: 3" com as três já lidas, até apertar "↺ Atualizar" ou dar F5.

**O contador da faixa "O que esta esperando voce" nao desce quando ele resolve uma revisao**  
`/home/user/doutorclovis/src/routes/_authenticated/painel.tsx:6506`  
BrainReviewCard.resolver() remove o item da lista local mas nunca chama `onContar`. O badge do cabecalho (soma das tres filas) continua contando as revisoes ja resolvidas ate o medico recarregar a pagina: ele limpa a fila inteira e o numero ao lado de "O que esta esperando voce" nao se move. O card irmao BrainGapsCard corrige isso explicitamente nos dois handlers ("O CONTADOR DA FAIXA TAMBEM DESCE", linhas 6862-6871); a fila de revisao ficou para tras.

**'So marcar' nao mexe no badge nem no Stat — o medico age e o numero nao muda**  
`src/routes/_authenticated/painel.tsx:861`  
toggleAnswered atualiza otimistamente o array `questions` mas nunca toca `pendingExato`, e pendingQs prefere pendingExato quando ele nao e null. O medico marca a ultima pergunta como respondida: o cartao vira 'Respondida ✓' e o badge da aba e o Stat 'Perguntas a responder' ficam no numero antigo ate o refresh de 3 minutos — que so roda com a aba visivel (painel.tsx:520). Mesmo problema no callback onTrained do Cerebro (painel.tsx:1333), que tambem so mexe em `questions`. Responder pelo botao 'Responder' e a unica acao que corrige, porque chama load(true).

**setQuestionAnswered autoriza pelo carimbo, sem vinculo atual**  
`src/lib/admin.functions.ts:613`  
assertOwnsRow le doctor_id da propria linha de doctor_questions e compara com o medico; nao consulta patient_profiles. Um medico de quem a paciente ja se desvinculou continua autorizado a marcar as perguntas ABERTAS dela como respondidas — ela ve 'respondida' no app sem nunca ter recebido resposta. Hoje nenhum caminho de UI chega la (a lista da aba e filtrada por vinculo), entao e defesa em profundidade quebrada e nao vazamento em producao — mas contraria a regra escrita do projeto e a propria funcao irma responderPergunta, que faz a checagem.

**A resposta que o medico escreveu nao aparece em lugar nenhum do painel**  
`src/lib/admin.functions.ts:106`  
O texto e gravado em doctor_questions.answer (clinical.functions.ts:1497) e entregue a paciente, mas o tipo AdminQuestion nao carrega o campo e o cartao so renderiza {q.question}. Depois de respondida, o botao 'Responder' some (`{!q.answered && ...}`, painel.tsx:2939) e sobra a pergunta com o selo verde: o medico nao tem como reler o que mandou, conferir se saiu certo, nem corrigir. Nenhuma outra tela do painel exibe doctor_questions.answer (a unica leitura e estatistica, dashboard.functions.ts:371, para calcular minutos por resposta).

**lerDesfechos ignora o erro e os eventos já resolvidos ressuscitam como pendentes**  
`src/lib/clinical.functions.ts:391`  
A leitura de `clinical_acks` faz `const { data } = await q…` sem checar `error` (o `try/catch` em volta não captura nada — supabase-js não lança). Se a tabela não existir (ela mora só em APLICAR_EVENTOS_CLINICOS.sql, fora do APLICAR_PENDENTES) ou a consulta falhar, volta Map vazio e TODOS os eventos aparecem com `tratado_em: null`. O bloco "N registros fora de faixa sem desfecho" do prontuário e a fila do painel voltam a listar itens que o médico já resolveu, sem qualquer sinal de que a informação de desfecho não pôde ser lida. O próprio comentário logo acima descreve esse desfecho como inaceitável ("um desfecho que cai é um evento JÁ RESOLVIDO que volta a aparecer como pendente") — mas só para o caso do teto de linhas, não para o erro.

**Contato de emergência e Modo Cuidado são lidos do banco e nunca chegam a nenhuma tela**  
`src/lib/clinical.functions.ts:613`  
`fichaClinica` seleciona `emergency_contact`, `emergency_phone`, `height_cm`, `care_mode` e `baby_name`, monta os campos `contatoEmergencia`, `telefoneEmergencia`, `alturaCm`, `modoCuidado` e `bebe` no tipo `FichaClinica` — e `ProntuarioPaciente` é o ÚNICO consumidor desse tipo em toda a base (grep em src/ não acha nenhum outro uso desses campos). O componente renderiza nome, IG, DPP, gestação, sangue, telefone, riscos, alergias, medicações e observações; os cinco acima não são renderizados em lugar nenhum. Consequências concretas: numa emergência o médico abre a ficha e não tem o contato da família, mesmo com o dado carregado na memória do componente; e `modoCuidado` (Modo Cuidado = perda gestacional) não aparece, então ele abre a ficha de uma paciente que perdeu o bebê com a mesma cara de sempre — o desenho do bebê da semana inclusive segue no cabeçalho do modal.

**O mesmo modal mostra a última pressão e, três blocos abaixo, "—" para a mesma medida**  
`src/routes/_authenticated/painel.tsx:11255`  
O PatientDetailModal desenha dois painéis de medidas com janelas diferentes. O de cima (`ProntuarioPaciente`, via `prontuarioDaPaciente`) cobre 300 dias. O de baixo ("🩺 Registros dela") lê `ficha.healthLogs`, que vem de `getPatientReport` filtrado em 14 dias (`gte("created_at", twoWeeksAgo)`), e imprime "—" quando não há registro na janela. Para uma paciente que mediu a pressão há 20 dias, o médico lê "Última pressão 138/88" em cima e "Pressão —" embaixo, com o texto ao lado afirmando que sem etiqueta significa "dentro da faixa de referência ou sem registro". Nada na tela diz que o segundo bloco é de 14 dias. É o defeito que o cabeçalho de prontuarioDaPaciente diz ter corrigido ("uma medida de 20 dias atrás aparecia como '—', que o médico lia como 'ela não registra'"), sobrevivendo no bloco antigo logo abaixo.

**✅ Botão 'Ver planos' do 402 da transcrição não faz nada**  
`src/routes/_authenticated/painel.tsx:5355`  
Quando a transcrição volta 402, o cartão mostra um toast de 9 segundos com a ação 'Ver planos', que chama `document.getElementById("cobranca")?.scrollIntoView(...)`. A âncora `id="cobranca"` está DENTRO de MeuPerfilSection, que só é montada quando `tab === "Meu Perfil"` (painel.tsx:1373). O médico está na aba Cérebro quando o toast aparece, então o elemento não existe no DOM, o `?.` engole e o clique não faz absolutamente nada. O padrão correto já existe no mesmo arquivo, 4.380 linhas acima: trocar de aba primeiro e só então rolar.

**'Busca por significado' manda rodar SQL para qualquer falha, inclusive de permissão**  
`src/routes/_authenticated/painel.tsx:5518`  
diagnosticoDaBusca devolve o mesmo `ok:false` em três situações distintas: migration ausente, requireAdmin negado e resolveBrainDoctor negado (gestor operando um médico que já saiu da clínica). A tela trata as três como a primeira e instrui: 'falta rodar APLICAR_USO_IA.sql e APLICAR_PENDENTES.sql no Supabase'. Num banco já migrado, o médico roda o SQL, nada muda, e o cartão segue acusando o banco por um problema de permissão. Mesmo destino para uma falha de rede, pelo catch.

**O estado `triagens` do painel é carregado três vezes por ciclo e nunca é lido por nenhum render**  
`src/routes/_authenticated/painel.tsx:362`  
`loadTriagens()` roda no mount, no tique de 3 minutos e ao voltar para a aba, gastando uma ida ao servidor por vez. O resultado entra em `setTriagens(r.triagens)` e o array MORRE ali: `grep -n triagens painel.tsx` devolve só a declaração do useState, o flag de falha e a escrita — nenhuma leitura em JSX, nenhum .map, nenhum .length. A decisão de não pôr triagem na fila é deliberada e está documentada (painel.tsx:874-878: ela chega pelo fluxo de eventos clínicos, `ev-triage_logs-`), mas a carga ficou para trás. Consequência prática: três chamadas por ciclo sem consumidor, e a entrada 'alertas de sintomas' em fontesComFalha avisa o médico sobre uma fonte que ele não veria de qualquer jeito por esse caminho.

**Link de live sem https vira 'Falha de conexão' — o médico culpa a internet**  
`src/routes/_authenticated/painel.tsx:10361`  
O médico cola 'www.instagram.com/drfulano/live' no campo Link e clica em Cadastrar. z.string().url() reprova no inputValidator, a server function rejeita antes de chegar ao handler, e o único catch da função escreve 'Falha de conexão — tente novamente.' Ele tenta de novo com a mesma URL, troca de rede, e nunca descobre que faltava o https://. O caminho que existe para explicar erro (toast.error(res.error)) só é alcançado quando o handler roda.

**'Imprimir' e 'Copiar' da aba Ferramentas falham sem dizer nada**  
`src/routes/_authenticated/painel.tsx:4456`  
Com bloqueador de pop-up ligado (padrao em varios navegadores e no app nativo), `window.open` devolve null, `printText` faz `return` e o clique em '🖨️ Imprimir' nao produz absolutamente nada — nem janela, nem aviso. Do lado do 'Copiar', `navigator.clipboard.writeText(text).then(...)` nao tem `.catch`: se a escrita for negada (contexto nao seguro, permissao), a promessa rejeita sem tratamento, o rotulo continua 'Copiar' e o medico cola no receituario externo o que quer que estivesse na area de transferencia antes — numa prescricao, conteudo errado colado sem aviso.

**O dono da clinica nao tem porta de saida nenhuma — e o comentario aponta para uma acao que nao existe**  
`src/lib/clinic.functions.ts:357`  
`createClinic` carimba `clinic_id` + `clinic_role='admin'` no proprio dono. Depois disso: `sairDaClinica` recusa com `reason:'e_admin'`, `removeClinicDoctor` recusa com `reason:'proprio'` e nao existe nenhuma funcao de apagar clinica (`grep -rn 'deleteClinic\|apagarClinica' src/` = zero). O comentario ao lado da recusa manda 'ele remove os membros e apaga a clinica, nessa ordem' — o segundo passo nao esta implementado em lugar nenhum. Uma clinica criada por engano fica presa para sempre, e com ela o `clinic_id` do dono, que passa a ser recusado por `addClinicDoctor` de qualquer outra clinica com 'outra_clinica'.

**O gestor de clinica sem conta de medico aterrissa no cerebro dele proprio, que nao existe**  
`src/routes/_authenticated/painel.tsx:601`  
O painel admite o dono de clinica sem linha em `doctors` exatamente para administrar a clinica ('entra para administrar a clinica e operar os cerebros dos medicos dela'), mas nesse ramo faz apenas `setAllowed(true); return;` — sem chamar `aplicarPlano` e sem mexer em `tab`. `tab` continua em `ABA_DE_ENTRADA` ('Cerebro 🧠') e `podeIA` continua no valor inicial `true`, entao ele cai na tela do Segundo Cerebro DELE, que nao existe: filas vazias, placar zerado, e cada acao de treino barrada no servidor (sem linha em `doctors`, `planRowFor` devolve 'free'). A unica tela para a qual ele foi admitido esta escondida atras da bolinha do perfil, em 'Minha clinica'.

**Depois de salvar o perfil (ou cadastrar o endereço) os avisos de pendência continuam os mesmos**  
`src/routes/_authenticated/painel.tsx:9624`  
O médico lê "Faltam 3 informações no seu cadastro", preenche as três e clica Salvar. Aparece "Perfil salvo ✓" e o bloco âmbar continua listando exatamente as mesmas três — `pendencias` só é escrito no useEffect de montagem e o save() nunca refaz getMyDoctor. O mesmo com endereço: ele cadastra o primeiro no EnderecosCard, o card passa a listar, mas o cartão de progresso e a lista de pendências acima continuam cobrando "Endereço do consultório — a paciente precisa saber para onde ir", porque o EnderecosCard recarrega só a própria lista e não avisa o pai. E a bolinha do canto (nome/foto/plano) segue com os dados velhos, porque `euMedico` foi carregado uma vez no painel. Só um F5 conta a verdade — e o médico conclui que salvar não funcionou.

**O teto de pacientes do ConsumoCard é inalcançável e o aviso de trial diz um limite que não existe**  
`src/routes/_authenticated/painel.tsx:9087`  
maxPatients é null em TODOS os planos (o eixo saiu do produto), então `semTeto` é sempre true e `cheio`/`perto` nunca são verdadeiros: os dois botões do card — "Aumentar meu limite →" e "Encerrar um acompanhamento" — e as duas tarjas (rosa e âmbar) são código que nenhum caminho renderiza. Já o aviso de fim de teste, esse aparece, e afirma ao médico que "quando o teste acabar, o plano vira Free: 5 pacientes e sem IA no app" — a metade das 5 pacientes é falsa desde que o teto saiu, e é justamente a frase que pode empurrá-lo a assinar por um motivo inexistente.

**✅ "Ver cobrança" na bolinha do canto não rola até a cobrança na primeira abertura**  
`src/routes/_authenticated/painel.tsx:969`  
O médico abre o menu da bolinha e escolhe a entrada de cobrança. O handler troca de aba e espera UM quadro para rolar até a âncora #cobranca — mas nesse quadro MeuPerfilSection ainda está em `loading` e renderiza só um esqueleto, então getElementById("cobranca") devolve null e a rolagem não acontece. Ele aterrissa no topo do Meu Perfil e precisa procurar o cartão de assinatura, que fica depois do aviso de SOS, do progresso, das pendências e de dois cartões de consumo. Nas idas seguintes (seção já carregada) funciona — o que faz parecer intermitente.

**getMyBilling está pronta e não tem um chamador — a tela de cobrança não mostra status nem próxima cobrança**  
`src/lib/billing.functions.ts:245`  
A função de servidor que lê as assinaturas do usuário (product, plan, status, source, current_period_end) não é importada por nenhuma tela do repositório. O DoctorBilling decide tudo por `doctors.plan` + `doctors.active`: escreve "Assinatura ativa · plano mensagens" e para por aí. O médico não vê quando vai ser cobrado, quanto, nem se a última fatura falhou — a única forma de descobrir é sair do produto e abrir o portal da Stripe. É o padrão de função escrita, testada e inalcançável que esta base já teve quatro vezes.

**"Foto atualizada ✓" antes de a foto entrar no perfil**  
`src/components/campo-foto.tsx:88`  
O médico escolhe a foto, ela sobe para o bucket e o toast diz "Foto atualizada ✓". Mas o `onChange` só mexe no estado do formulário: a coluna doctors.photo_url só é escrita quando ele clica "Salvar perfil" depois. Se ele trocar de aba, fechar o painel ou o save falhar (ver o achado do 42703, em que photo_url é justamente uma das colunas que derrubam o update), o arquivo fica órfão no Storage e a paciente continua vendo o círculo com a inicial — depois de a tela ter confirmado a troca.
