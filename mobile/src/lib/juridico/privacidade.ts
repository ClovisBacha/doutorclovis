import { CONTATO_EMAIL } from "~/config";
import type { DocumentoJuridico } from "~/lib/juridico/documento";

/**
 * A POLÍTICA DE PRIVACIDADE DO APP (fase 4) — escrita a partir do que o app
 * coleta de fato (o inventário de 28/10/2026, no diário, "build 42" e "build
 * 43"): as tabelas que ele grava pelo cliente, as funções de servidor que chama,
 * o SOS (o que o servidor grava e para quem manda, por quais canais), as
 * permissões, o que fica só no aparelho, quem da equipe acessa, e o que a
 * exclusão apaga e o que sobra.
 *
 * ⚠️ Se o app passar a coletar outra coisa (um SDK, uma tabela, uma
 * permissão, um canal do SOS), ESTE texto muda junto — e `VERSAO_DOS_TERMOS`
 * também.
 * ⚠️ Escrita a partir do código, não por advogado: revisão jurídica antes da
 * loja (`docs/juridico/LEIA-ME.md`).
 */
export const PRIVACIDADE: DocumentoJuridico = {
  titulo: "Política de privacidade",
  resumo:
    "Guardamos o necessário para o app funcionar: a sua conta, a datação da gestação, o cartão do SOS, os movimentos do bebê, a sua jornada e o que você publica na Comunidade. Não vendemos dados, não usamos para publicidade e não rastreamos você em outros apps. Você pode baixar uma cópia dos seus dados e excluir tudo quando quiser, no Perfil.",
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
            "A sua conta: nome, e-mail e senha (guardada cifrada pelo serviço de autenticação) — ou, se você entra com a Apple, o nome e o e-mail que a Apple manda (ela pode esconder o seu e-mail atrás de um endereço próprio). Para criar e proteger a sua conta, e registrar quando você aceitou estes documentos.",
            "A gestação e o bebê: a data da última menstruação ou do ultrassom (com as semanas dele), a data provável do parto, o nome do bebê, os movimentos que você contar e, depois do nascimento, a data e — se você contar — a hora, o peso e o comprimento do bebê. Para mostrar a semana, o cuidado do dia e o acompanhamento do bebê.",
            "O Modo Cuidado: se você o ligar (para quando a gestação não seguiu), essa escolha e a data. Para o app parar de falar do bebê.",
            "O cartão do SOS: o contato de emergência (nome, telefone e e-mail), o tipo sanguíneo, as alergias, as medicações em uso e quem acompanha a sua gestação (nome, celular e e-mail). Para o SOS.",
            'O SOS: quando você toca em "Pedir socorro agora", a sua localização (se você permitir o acesso) e o registro do acionamento — quando foi, para quem o aviso saiu e uma cópia da ficha naquele momento. Para avisar quem você cadastrou e guardar o que aconteceu.',
            "O cronômetro de contrações: os horários e a intensidade que você marcar.",
            "A sua jornada: o que você fez a cada dia (as atividades, as aulas e as respostas, como você estava), o registro das meditações, as sementinhas, as conquistas, os enfeites do Cantinho, as linhas que você guarda (as coisas boas e as cartas para o bebê) e a agenda (as consultas, os ultrassons, os exames e as vacinas que você marcar, com o local e a anotação). Para o jogo e para você não perder nada ao trocar de aparelho.",
            "A Comunidade: o seu perfil (nome, @, foto, bio, se é público, se mostra a semana e o nome do bebê), o que você publica (textos, fotos e a descrição delas), os comentários, as reações, as publicações salvas, quem você segue e quem segue você, os bloqueios, as denúncias e os avisos (quem reagiu, comentou ou pediu para seguir). Para a rede funcionar e para a moderação.",
            'As Amigas: as amizades e os pedidos, a dupla e a última vez em que você abriu o app (as amigas veem "vista há…"). Se você pedir amizade pelo e-mail de alguém, o e-mail serve só para encontrar a conta dela — a resposta é a mesma, achando ou não.',
            "Os convites: o seu código de convite, quem convidou você e, se você usar o código de uma embaixadora ou de uma médica, esse vínculo.",
            'O depoimento, se você escrever um: o texto e o nome que você escolher. Depois de revisto, ele pode aparecer na página pública de depoimentos do site, com esse nome (ou "Paciente").',
          ],
        },
        "A datação da gestação também serve para sugerir pessoas numa fase parecida com a sua — só quando você liga esse filtro, e sem mostrar a fase de ninguém.",
        "O app não pede peso, altura, pressão, glicemia, exames, sintomas ou diagnósticos. O que você tenha registrado antes, no site, continua na sua conta até você excluí-la ou pedir a exclusão.",
      ],
    },
    {
      titulo: "3. O que fica no seu aparelho",
      blocos: [
        {
          lista: [
            "A sua sessão (o acesso à conta), no armazenamento do app.",
            "Uma cópia da jornada, da agenda, do cartão do SOS e do contato de quem acompanha a sua gestação, para o app — e o SOS — funcionarem sem internet. O cartão do SOS fica na sua conta e também no aparelho.",
            "Os lembretes: são notificações agendadas no próprio aparelho. O app não registra o seu aparelho para receber avisos do servidor.",
          ],
        },
        "Ao sair da conta ou excluí-la, o app apaga essas cópias do aparelho.",
      ],
    },
    {
      titulo: "4. Dado de saúde e de gestação",
      blocos: [
        "A datação da gestação, o nascimento, os movimentos do bebê, as contrações, o Modo Cuidado e o cartão do SOS são dados sensíveis (Lei Geral de Proteção de Dados, art. 5º, II). O app os trata com o seu consentimento, pedido de forma separada e destacada no cadastro (art. 11, I), para o SOS e para o acompanhamento do bebê. No SOS, o envio da sua localização e da sua ficha também protege a sua vida (art. 11, II, e).",
        "Esses dados nunca são usados para propaganda nem compartilhados para fins comerciais. Você pode retirar o consentimento quando quiser — como o app não funciona sem eles, retirar é excluir a conta (ou pedir pelo e-mail do encarregado).",
      ],
    },
    {
      titulo: "5. As outras bases da lei",
      blocos: [
        {
          lista: [
            "A execução do serviço que você contratou ao criar a conta (art. 7º, V): a conta, a jornada, o jogo, a Comunidade e as Amigas.",
            "O legítimo interesse (art. 7º, IX): a segurança do serviço, a prevenção de abuso, a moderação da Comunidade (os filtros automáticos e o registro das denúncias) e números de uso para melhorar o app (por exemplo, quantas pessoas fizeram o cuidado do dia).",
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
            'Outras usuárias: o que você publica, só para quem você escolheu (todo mundo, quem te acompanha ou só as amigas); o seu perfil, se for público, ou só para quem você aceitou, se for fechado; o seu nome e a sua foto onde você comenta; e, para as amigas, o seu nome, o nome do bebê, o seu Cantinho, os troféus, a chama e o "vista há…". Nenhum dado de saúde aparece para outra usuária; no perfil da Comunidade, a semana e o nome do bebê só aparecem se você ligar.',
            'As pessoas do SOS: quando você toca em "Pedir socorro agora", o contato de emergência e quem acompanha a sua gestação recebem um aviso com a sua ficha e, se você permitir, a sua localização — por e-mail e, quando esses canais estão ligados, por WhatsApp ou SMS enviados pelo servidor. O app também abre no seu celular uma mensagem de WhatsApp ou de SMS já escrita, que é você quem envia.',
            "A embaixadora ou a médica, se você usar o código dela: o seu primeiro nome numa lista. Nada do seu acompanhamento.",
            "Se a sua conta foi vinculada a um médico pelo site (o app não faz esse vínculo): esse médico recebe os avisos do SOS e vê os acionamentos, as contrações, os movimentos e o que você registrou nos últimos dias, para o acompanhamento.",
            "A nossa equipe: pessoas autorizadas podem acessar dados para suporte, segurança e moderação, e esse acesso fica registrado.",
            "Os serviços que fazem o app funcionar, só para isso: Supabase (banco de dados, autenticação, arquivos e os e-mails da conta), Vercel (os servidores do app), Resend (os e-mails do SOS), Meta (o WhatsApp do SOS, quando ligado), o serviço de SMS do SOS (quando ligado) e Apple (se você entra com a Apple).",
            "Autoridades, quando a lei ou uma ordem judicial exigir.",
          ],
        },
        "O texto das publicações, dos comentários e da bio passa por filtros automáticos no nosso servidor (palavras ofensivas e uma triagem que recusa conselho de saúde e situações de emergência) — por regras, sem inteligência artificial e sem terceiros. Os trechos recusados ficam guardados para a revisão da equipe.",
        "Não vendemos nem alugamos dados. O app não tem ferramenta de anúncios, de análise de terceiros ou de rastreamento.",
      ],
    },
    {
      titulo: "7. Onde os dados ficam",
      blocos: [
        "O banco de dados e os servidores do app ficam no Brasil (Supabase e Vercel, na região de São Paulo). Saem do país os e-mails do SOS (Resend, nos Estados Unidos), o WhatsApp do SOS, quando ligado (Meta), e o login com a Apple. Essa transferência segue o art. 33 da Lei Geral de Proteção de Dados, nos termos dos contratos e das políticas de proteção de dados desses fornecedores.",
      ],
    },
    {
      titulo: "8. Por quanto tempo",
      blocos: [
        "Enquanto a sua conta existir. Arquivar uma publicação ou apagar um comentário tira o conteúdo da vista de todas, mas ele fica guardado na sua conta até você excluí-la.",
        "Ao excluir a conta (Perfil → Excluir minha conta), o seu perfil, a jornada, os dados de saúde, o que você publicou, os comentários, as amizades e as fotos são apagados. Ficam só: os registros que a lei manda guardar, pelo prazo dela (como os de acesso, por 6 meses); o registro dos acessos da equipe; os avisos do SOS já entregues, com quem os recebeu; e as cópias de segurança, que se renovam sozinhas com o tempo.",
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
            "levar os seus dados com você (portabilidade);",
            "saber com quem os compartilhamos;",
            "retirar o consentimento e excluir a conta.",
          ],
        },
        `No app: Perfil → Baixar uma cópia dos meus dados (um arquivo com o que você registrou), Perfil → Excluir minha conta, o perfil fechado, o Modo Cuidado e o bloqueio na Comunidade. Para o resto — inclusive o que não estiver no arquivo —, escreva para ${CONTATO_EMAIL}: respondemos em até 15 dias. Se não ficar satisfeita, você pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).`,
      ],
    },
    {
      titulo: "10. Segurança",
      blocos: [
        "As conexões são cifradas, cada usuária só acessa os próprios dados (regras de acesso no banco), as fotos da Comunidade ficam num local privado e abrem por endereços temporários, e o acesso da equipe é registrado. Nenhum sistema é infalível: se acontecer um incidente que possa trazer risco a você, avisaremos você e a ANPD.",
      ],
    },
    {
      titulo: "11. Menores de idade",
      blocos: [
        "O app é para maiores de 18 anos. Os dados do bebê são informados pela mãe, só para o acompanhamento dentro do app.",
      ],
    },
    {
      titulo: "12. As permissões do iPhone",
      blocos: [
        {
          lista: [
            "Localização: só enquanto o app está aberto. Ela é lida quando você abre a tela do SOS, para estar pronta, e só sai do aparelho quando você pede socorro.",
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
