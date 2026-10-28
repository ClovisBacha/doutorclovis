import { CONTATO_EMAIL } from "~/config";
import type { DocumentoJuridico } from "~/lib/juridico/documento";

/**
 * A POLÍTICA DE PRIVACIDADE DO APP (fase 4) — escrita a partir do que o app
 * coleta de fato (inventário de 28/10/2026, no diário): as tabelas que ele grava
 * pelo cliente, as funções de servidor que chama, o SOS, as permissões e o que
 * fica só no aparelho.
 *
 * ⚠️ Se o app passar a coletar outra coisa (um SDK, uma tabela, uma
 * permissão), ESTE texto muda junto — e `VERSAO_DOS_TERMOS` também.
 * ⚠️ Escrita a partir do código, não por advogado: revisão jurídica antes da
 * loja (`docs/juridico/LEIA-ME.md`).
 */
export const PRIVACIDADE: DocumentoJuridico = {
  titulo: "Política de privacidade",
  resumo:
    "Guardamos o necessário para o app funcionar: a sua conta, a datação da gestação, o cartão do SOS, os movimentos do bebê, a sua jornada e o que você publica na Comunidade. Não vendemos dados, não usamos para publicidade e não rastreamos você em outros apps. Você pode excluir tudo quando quiser, no Perfil.",
  secoes: [
    {
      titulo: "1. Quem cuida dos seus dados",
      blocos: [
        `O controlador dos dados é Dr. Clóvis Bacha, ginecologista e obstetra (CRM-MG 22.333), que oferece o app Obstétrica. O encarregado pelo tratamento de dados pessoais atende em ${CONTATO_EMAIL}.`,
      ],
    },
    {
      titulo: "2. O que o app guarda, e para quê",
      blocos: [
        {
          lista: [
            "A sua conta: nome, e-mail e senha (guardada pelo serviço de autenticação, cifrada) — ou, se você entra com a Apple, a identificação que a Apple manda (ela pode esconder o seu e-mail). Para criar e proteger a sua conta.",
            "A gestação e o bebê: a data da última menstruação ou do ultrassom (com as semanas dele), a data provável do parto, a data do nascimento, o nome do bebê e os movimentos que você contar. Para mostrar a semana, o cuidado do dia e o acompanhamento do bebê.",
            "O cartão do SOS: o contato de emergência (nome, telefone e e-mail), o tipo sanguíneo, as alergias, as medicações em uso e quem acompanha a sua gestação (nome, celular e e-mail). Para o SOS.",
            "O SOS: quando você o aciona, a sua localização (latitude, longitude e o endereço aproximado) e o registro do acionamento (quando foi e para quem o aviso saiu). Para avisar quem você cadastrou e guardar o que aconteceu.",
            "O cronômetro de contrações: os horários que você marcar.",
            "A sua jornada: o que você fez a cada dia (as atividades, as aulas e as respostas, como você estava), as sementinhas, as conquistas, os enfeites do Cantinho, as linhas que você guarda (as coisas boas e as cartas para o bebê) e a agenda das suas consultas. Para o jogo e para você não perder nada ao trocar de aparelho.",
            "A Comunidade: o seu perfil (nome, @, foto, bio, se é público, se mostra a semana e o nome do bebê), o que você publica (textos, fotos e a descrição delas), os comentários, as reações, quem você segue e quem segue você, os bloqueios, as denúncias e os avisos (quem reagiu, comentou ou pediu para seguir). Para a rede funcionar e para a moderação.",
            'As Amigas: as amizades e os pedidos, a dupla e a última vez em que você abriu o app (as amigas veem "vista há…").',
            "Os convites: o seu código de convite, quem convidou você e, se você usar o código de uma embaixadora, esse vínculo.",
            "O depoimento, se você escrever um: o texto e o nome que você escolher.",
          ],
        },
        "O app não pede, nem guarda, peso, pressão, glicemia, exames, sintomas ou diagnósticos.",
      ],
    },
    {
      titulo: "3. O que fica só no seu aparelho",
      blocos: [
        {
          lista: [
            "A sua sessão, no armazenamento seguro do iPhone.",
            "Uma cópia da jornada, da agenda e do cartão do SOS, para o app — e o SOS — funcionarem sem internet.",
            "Os lembretes: são notificações agendadas no próprio aparelho. O app não registra o seu aparelho para receber avisos do servidor.",
          ],
        },
        "Ao sair da conta ou excluí-la, o app apaga essas cópias do aparelho.",
      ],
    },
    {
      titulo: "4. Dado de saúde e de gestação",
      blocos: [
        "A datação da gestação, o nascimento, os movimentos do bebê e o cartão do SOS são dados sensíveis (Lei Geral de Proteção de Dados, art. 5º, II). O app os trata com o seu consentimento, pedido de forma separada e destacada no cadastro (art. 11, I), só para o SOS e para o acompanhamento do bebê. No SOS, o envio da sua localização e da sua ficha também protege a sua vida (art. 11, II, e).",
        "Esses dados nunca são usados para propaganda nem compartilhados para fins comerciais. Você pode retirar o consentimento quando quiser — como o app não funciona sem eles, retirar é excluir a conta (ou pedir pelo e-mail do encarregado).",
      ],
    },
    {
      titulo: "5. As outras bases da lei",
      blocos: [
        {
          lista: [
            "A execução do serviço que você contratou ao criar a conta (art. 7º, V): a conta, a jornada, o jogo, a Comunidade e as Amigas.",
            "O legítimo interesse (art. 7º, IX): a segurança do serviço, a prevenção de abuso e a moderação da Comunidade (os filtros automáticos e o registro das denúncias).",
            "O cumprimento de obrigação legal (art. 7º, II): os registros de acesso (data, hora e endereço IP), guardados por 6 meses, como exige o Marco Civil da Internet.",
          ],
        },
      ],
    },
    {
      titulo: "6. Quem recebe os seus dados",
      blocos: [
        {
          lista: [
            'Outras usuárias: o que você publica, só para quem você escolheu (todo mundo, quem te acompanha ou só as amigas); o seu perfil, se for público, ou só para quem você aceitou, se for fechado; e, para as amigas, o seu nome, o nome do bebê, o seu Cantinho, os troféus, a chama e o "vista há…". Nenhum dado de saúde aparece para outra usuária; no perfil da Comunidade, a semana e o nome do bebê só aparecem se você ligar.',
            "As pessoas do SOS: quando você aciona o SOS, o contato de emergência e quem acompanha a sua gestação recebem o e-mail de emergência com a sua localização e a sua ficha. As mensagens de SMS e de WhatsApp são enviadas por você, do seu celular.",
            "A embaixadora, se você usar o código dela: o seu primeiro nome numa lista. Nada do seu acompanhamento.",
            "Os serviços que fazem o app funcionar, só para isso: Supabase (banco de dados, autenticação e arquivos), Vercel (os servidores do app), Resend (os e-mails do SOS e da conta) e Apple (se você entra com a Apple).",
            "Autoridades, quando a lei ou uma ordem judicial exigir.",
          ],
        },
        "O texto das publicações e dos comentários passa por filtros automáticos no nosso servidor (palavras ofensivas e uma triagem que recusa conselho de saúde e situações de emergência) — sem inteligência artificial de terceiros. Trechos recusados podem ficar guardados para a revisão da equipe.",
        "Não vendemos nem alugamos dados. O app não tem ferramenta de anúncios, de análise de uso ou de rastreamento.",
      ],
    },
    {
      titulo: "7. Dados fora do Brasil",
      blocos: [
        "Os serviços acima ficam nos Estados Unidos. A transferência segue o art. 33 da Lei Geral de Proteção de Dados, nos termos dos contratos e das políticas de proteção de dados desses fornecedores.",
      ],
    },
    {
      titulo: "8. Por quanto tempo",
      blocos: [
        "Enquanto a sua conta existir. Ao excluí-la (Perfil → Excluir minha conta), o seu perfil, a jornada, os dados de saúde, o que você publicou e as conversas são apagados. Ficam só os registros que a lei manda guardar pelo prazo dela (como os de acesso, por 6 meses) e as cópias de segurança, que se renovam sozinhas com o tempo.",
      ],
    },
    {
      titulo: "9. Os seus direitos",
      blocos: [
        "Você pode, a qualquer momento (Lei Geral de Proteção de Dados, art. 18):",
        {
          lista: [
            "saber se tratamos dados seus e ter acesso a eles;",
            "corrigir o que estiver errado — quase tudo se corrige no próprio app, no Perfil;",
            "pedir a anonimização, o bloqueio ou a eliminação do que for desnecessário;",
            "pedir a portabilidade dos seus dados;",
            "saber com quem os compartilhamos;",
            "retirar o consentimento e excluir a conta.",
          ],
        },
        `No app: Perfil (editar e excluir a conta), o perfil fechado, o Modo Cuidado e o bloqueio na Comunidade. Para o resto, escreva para ${CONTATO_EMAIL}: respondemos em até 15 dias. Se não ficar satisfeita, você pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).`,
      ],
    },
    {
      titulo: "10. Segurança",
      blocos: [
        "As conexões são cifradas, cada usuária só acessa os próprios dados (regras de acesso no banco), a sessão fica no armazenamento seguro do aparelho e as fotos da Comunidade abrem por endereços temporários. Nenhum sistema é infalível: se acontecer um incidente que possa trazer risco a você, avisaremos você e a ANPD.",
      ],
    },
    {
      titulo: "11. Menores de idade",
      blocos: [
        "O app é para maiores de 18 anos. Os dados do bebê (nome, nascimento e movimentos) são informados pela mãe, só para o acompanhamento dentro do app.",
      ],
    },
    {
      titulo: "12. As permissões do iPhone",
      blocos: [
        {
          lista: [
            "Localização: pedida só quando você aciona o SOS, e só enquanto o app está aberto.",
            "Câmera e fotos: para você publicar na Comunidade e escolher a foto do perfil — só o que você escolher sai do aparelho.",
            "Movimento: para o leve efeito 3D dos cartões. Nada é guardado.",
            "Notificações: para os lembretes que você ligar.",
          ],
        },
      ],
    },
    {
      titulo: "13. Mudanças nesta política",
      blocos: [
        "Quando esta política mudar de forma relevante, o app avisa e pede o seu aceite de novo antes de continuar. A data da versão em vigor fica no topo.",
      ],
    },
  ],
};
