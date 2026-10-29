import { CONTATO_EMAIL } from "~/config";
import type { DocumentoJuridico } from "~/lib/juridico/documento";

/**
 * OS TERMOS DE USO DO APP (fase 4) — escritos para o app de hoje: comunidade
 * de gestantes e mães + jogo de cuidado diário, sem orientação médica (decisão
 * do dono de 21/10/2026), com o SOS, as Amigas e as sementinhas.
 *
 * ⚠️ Mudou algo relevante? Mude `VERSAO_DOS_TERMOS` (todas aceitam de novo) e
 * rode `bun scripts/gerar-juridico.ts` (as cópias de `docs/juridico/`).
 * ⚠️ Escrito a partir do que o app faz — e precisa da revisão de um advogado
 * antes da loja (ver `docs/juridico/LEIA-ME.md`).
 */
export const TERMOS: DocumentoJuridico = {
  titulo: "Termos de uso",
  resumo:
    "O Obstétrica é uma comunidade de gestantes e mães, com um jogo de cuidado diário. Ele não dá orientação médica e não substitui quem acompanha a sua gestação. Usando o app, você concorda com estes termos, com a Política de privacidade e com as regras da Comunidade.",
  secoes: [
    {
      titulo: "1. Quem oferece o app",
      blocos: [
        `O app Obstétrica é oferecido por Dr. Clóvis Bacha, ginecologista e obstetra (CRM-MG 22.333). Contato: ${CONTATO_EMAIL}.`,
      ],
    },
    {
      titulo: "2. O que é o app",
      blocos: [
        "Uma comunidade para gestantes e mães, com:",
        {
          lista: [
            "o cuidado do dia: uma aula curta, um momento para respirar, uma história lida para o bebê, uma coisa boa guardada e um movimento leve;",
            "o jogo: sementinhas, conquistas, a chama dos dias seguidos, os marcos e o Cantinho para enfeitar;",
            "a Comunidade, as Amigas e a dupla;",
            "o acompanhamento do bebê: a semana a semana, os movimentos, o álbum, a agenda das suas consultas e, depois do nascimento, as 12 primeiras semanas;",
            "o SOS;",
            "o Modo Cuidado, para quando a gestação não seguiu.",
          ],
        },
      ],
    },
    {
      titulo: "3. O app não dá orientação médica",
      blocos: [
        "O conteúdo do app é de informação e de bem-estar. Ele não faz diagnóstico, não indica tratamento, exame, remédio, suplemento ou dieta, não interpreta sintomas nem números e não substitui consulta. Siga sempre a orientação de quem acompanha a sua gestação.",
        "Em emergência, ligue 192 (SAMU) ou vá ao pronto-socorro mais próximo — os sinais de alerta estão no SOS. Não espere uma resposta pelo app.",
      ],
    },
    {
      titulo: "4. O SOS",
      blocos: [
        'O SOS liga para o 192 pelo seu telefone. E, quando você toca em "Pedir socorro agora", ele avisa o contato de emergência e quem acompanha a sua gestação, com a sua ficha e — se você permitir o acesso à localização — com a sua localização: o servidor manda por e-mail e, quando esses canais estão ligados, por WhatsApp ou SMS; e o app abre no seu celular uma mensagem de WhatsApp ou de SMS já escrita — quem envia é você.',
        "O SOS depende do seu aparelho, da rede e de outros serviços (operadora, e-mail, WhatsApp). Ele ajuda, mas não garante que o aviso chegue nem que alguém responda. Em emergência, ligue 192 sempre.",
        "Mantenha os dados do SOS em dia, em Perfil → Seus dados e o SOS, e avise as pessoas de que elas são os seus contatos.",
      ],
    },
    {
      titulo: "5. A sua conta",
      blocos: [
        {
          lista: [
            "O app é para maiores de 18 anos.",
            "Use dados verdadeiros e mantenha a sua senha só com você. Uma conta é de uma pessoa.",
            "Você é responsável pelo que acontece na sua conta. Se perceber um uso que não foi seu, escreva para nós.",
          ],
        },
      ],
    },
    {
      titulo: "6. A Comunidade",
      blocos: [
        "Antes de publicar, comentar ou reagir pela primeira vez, você aceita as regras da Comunidade. Elas valem para todas:",
        {
          lista: [
            "Tolerância zero com conteúdo ofensivo, abusivo, de assédio, discriminatório, violento, sexual, ilegal, enganoso ou de spam.",
            "Nada de conselho de saúde: aqui a gente conta a própria experiência — quem orienta é quem acompanha cada uma.",
            "Respeite a privacidade das outras pessoas: não publique dados, fotos ou conversas de alguém sem a permissão dela, e cuide das imagens de crianças.",
            "Não venda, não faça propaganda e não se passe por outra pessoa.",
          ],
        },
        "Você escolhe quem vê cada publicação: todo mundo, quem te acompanha ou só as suas amigas. O que você publica continua sendo seu; você nos dá a permissão necessária para guardar, mostrar e enviar esse conteúdo às pessoas que você escolheu, enquanto ele estiver publicado.",
        "O texto das publicações e dos comentários passa por filtros automáticos (palavras ofensivas e uma triagem que recusa conselho de saúde e situações de emergência). Toda publicação, perfil e comentário tem Denunciar e Bloquear. O que é denunciado é revisto em até 24 horas; o que quebra as regras é removido, e a conta pode ser suspensa ou excluída.",
      ],
    },
    {
      titulo: "7. As Amigas e os convites",
      blocos: [
        "Você pode convidar amigas pelo seu código ou link e pedir amizade pelo código ou pelo e-mail de alguém que já está no app. A amiga que entra pelo seu convite fica ligada a você, e vocês passam a se seguir na Comunidade. Use os convites com quem você conhece: convite em massa é spam.",
      ],
    },
    {
      titulo: "8. Sementinhas, conquistas e o Cantinho",
      blocos: [
        "As sementinhas são pontos do jogo, ganhos com as atividades do app. Elas não têm valor em dinheiro, não podem ser compradas, vendidas, trocadas por dinheiro nem levadas para fora do app. Os itens do Cantinho são enfeites virtuais.",
        "As regras do jogo (quanto cada atividade vale, os limites por dia, as conquistas) podem mudar para mantê-lo justo. Abusos — contas falsas, automação, combinação para ganhar pontos — podem zerar o saldo e levar à suspensão da conta.",
      ],
    },
    {
      titulo: "9. O que não é permitido",
      blocos: [
        {
          lista: [
            "Usar o app para algo ilegal ou que prejudique outras pessoas.",
            "Tentar acessar dados de outras pessoas, burlar a segurança ou sobrecarregar o serviço.",
            "Copiar, extrair em massa ou fazer engenharia reversa do app.",
          ],
        },
      ],
    },
    {
      titulo: "10. O conteúdo do app",
      blocos: [
        "Os textos, as aulas, as artes, as vozes, a marca e o código do app são protegidos por direitos autorais e são para o seu uso pessoal dentro do app.",
      ],
    },
    {
      titulo: "11. Excluir a conta",
      blocos: [
        "Você pode excluir a sua conta quando quiser, dentro do app, em Perfil → Excluir minha conta. A exclusão é definitiva e apaga os seus dados, como explica a Política de privacidade. Podemos suspender ou excluir contas que quebrem estes termos.",
      ],
    },
    {
      titulo: "12. Responsabilidade",
      blocos: [
        "Fazemos o possível para o app funcionar bem, mas ele pode ficar fora do ar, ter erros ou depender de serviços de terceiros. Não respondemos por decisões de saúde tomadas com base no app nem pelo que outras usuárias publicam — e nada aqui afasta os direitos que a lei garante a você como consumidora.",
      ],
    },
    {
      titulo: "13. Mudanças nestes termos",
      blocos: [
        "Quando estes termos mudarem de forma relevante, o app avisa e pede o seu aceite de novo antes de continuar. A data da versão em vigor fica no topo.",
      ],
    },
    {
      titulo: "14. Lei e foro",
      blocos: [
        "Estes termos seguem as leis do Brasil, inclusive o Código de Defesa do Consumidor e a Lei Geral de Proteção de Dados. Qualquer questão pode ser levada ao foro da cidade onde você mora.",
      ],
    },
  ],
};
