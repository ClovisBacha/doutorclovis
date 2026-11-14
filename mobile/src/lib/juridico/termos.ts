import { CONTATO_EMAIL } from "~/config";
import type { DocumentoJuridico } from "~/lib/juridico/documento";

/**
 * OS TERMOS DE USO DO APP — escritos para o app de 11/11/2026 (decisão do
 * dono): um jogo para aprender sobre a gestação, um pouco por dia, como um
 * Duolingo para gestantes, com as Amigas e o acompanhamento do bebê. Sem
 * orientação médica (21/10/2026), sem o SOS e sem a Comunidade (as chaves
 * `SOS_NO_APP` e `COMUNIDADE_NO_APP` de `config.ts`).
 *
 * ⚠️ Religou o SOS ou a Comunidade? Estes termos voltam a descrevê-los (o
 * histórico está no git, versão de 29/10/2026), e `VERSAO_DOS_TERMOS` muda.
 * ⚠️ Mudou algo relevante? Mude `VERSAO_DOS_TERMOS` (todas aceitam de novo) e
 * rode `bun scripts/gerar-juridico.ts` (as cópias de `docs/juridico/`).
 * ⚠️ Escrito a partir do que o app faz — e precisa da revisão de um advogado
 * antes da loja (ver `docs/juridico/LEIA-ME.md`).
 */
export const TERMOS: DocumentoJuridico = {
  titulo: "Termos de uso",
  resumo:
    "O app Mãe Esperta é um jogo para aprender sobre a gestação, um pouco por dia — como um Duolingo para gestantes. Ele não dá orientação médica e não substitui quem acompanha a sua gestação. Usando o app, você concorda com estes termos e com a Política de privacidade.",
  secoes: [
    {
      titulo: "1. Quem oferece o app",
      blocos: [
        `O app Mãe Esperta é oferecido por Dr. Clóvis Bacha, ginecologista e obstetra (CRM-MG 22.333). Contato: ${CONTATO_EMAIL}.`,
      ],
    },
    {
      titulo: "2. O que é o app",
      blocos: [
        "Um jogo de aprendizado para gestantes e mães, que segue a semana da sua gestação, com:",
        {
          lista: [
            "a trilha: uma aula curta por dia, escrita para a semana em que você está, e o cuidado do dia — um momento para respirar, uma história lida para o bebê, uma coisa boa guardada e um movimento leve;",
            "o jogo: sementinhas, conquistas, a chama dos dias seguidos, os marcos e o Cantinho para enfeitar;",
            "as Amigas e a dupla;",
            "o acompanhamento do bebê: a semana a semana, os movimentos, o álbum, a agenda das suas consultas, o contato de quem acompanha a sua gestação e, depois do nascimento, as 12 primeiras semanas;",
            "o Modo Cuidado, para quando a gestação não seguiu.",
          ],
        },
      ],
    },
    {
      titulo: "3. O app não dá orientação médica",
      blocos: [
        "O conteúdo do app é de informação e de bem-estar. Ele não faz diagnóstico, não indica tratamento, exame, remédio, suplemento ou dieta, não interpreta sintomas nem números e não substitui consulta. Siga sempre a orientação de quem acompanha a sua gestação.",
        "Em emergência, ligue 192 (SAMU) ou vá ao pronto-socorro mais próximo. Não espere uma resposta pelo app.",
      ],
    },
    {
      titulo: "4. A sua conta",
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
      titulo: "5. As Amigas e os convites",
      blocos: [
        "Você pode convidar amigas pelo seu código ou link e pedir amizade pelo código ou pelo e-mail de alguém que já está no app. A amiga que entra pelo seu convite fica ligada a você. As suas amigas veem o seu nome, a sua foto, o nome do bebê, o seu Cantinho, os seus troféus e a sua chama; você pode desfazer uma amizade quando quiser.",
        "Use um nome e uma foto respeitosos: nome ou foto ofensivos, de outra pessoa ou de propaganda são removidos, e a conta pode ser suspensa. Use os convites com quem você conhece: convite em massa é spam.",
      ],
    },
    {
      titulo: "6. Sementinhas, conquistas e o Cantinho",
      blocos: [
        "As sementinhas são pontos do jogo, ganhos com as atividades do app. Elas não têm valor em dinheiro, não podem ser compradas, vendidas, trocadas por dinheiro nem levadas para fora do app. Os itens do Cantinho são enfeites virtuais.",
        "As regras do jogo (quanto cada atividade vale, os limites por dia, as conquistas) podem mudar para mantê-lo justo. Abusos — contas falsas, automação, combinação para ganhar pontos — podem zerar o saldo e levar à suspensão da conta.",
      ],
    },
    {
      titulo: "7. O que não é permitido",
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
      titulo: "8. O conteúdo do app",
      blocos: [
        "Os textos, as aulas, as artes, as vozes, a marca e o código do app são protegidos por direitos autorais e são para o seu uso pessoal dentro do app.",
      ],
    },
    {
      titulo: "9. Excluir a conta",
      blocos: [
        "Você pode excluir a sua conta quando quiser, dentro do app, em Perfil → Excluir minha conta. A exclusão é definitiva e apaga os seus dados, como explica a Política de privacidade. Podemos suspender ou excluir contas que quebrem estes termos.",
      ],
    },
    {
      titulo: "10. Responsabilidade",
      blocos: [
        "Fazemos o possível para o app funcionar bem, mas ele pode ficar fora do ar, ter erros ou depender de serviços de terceiros. Não respondemos por decisões de saúde tomadas com base no app — e nada aqui afasta os direitos que a lei garante a você como consumidora.",
      ],
    },
    {
      titulo: "11. Mudanças nestes termos",
      blocos: [
        "Quando estes termos mudarem de forma relevante, o app avisa e pede o seu aceite de novo antes de continuar. A data da versão em vigor fica no topo.",
      ],
    },
    {
      titulo: "12. Lei e foro",
      blocos: [
        "Estes termos seguem as leis do Brasil, inclusive o Código de Defesa do Consumidor e a Lei Geral de Proteção de Dados. Qualquer questão pode ser levada ao foro da cidade onde você mora.",
      ],
    },
  ],
};
