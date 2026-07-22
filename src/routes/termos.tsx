import { createFileRoute } from "@tanstack/react-router";
import { DOCTOR } from "@/lib/doctor.config";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Obstétrica" },
      {
        name: "description",
        content:
          "Termos e condições de uso do aplicativo Obstétrica: contas, serviços, pagamentos e responsabilidades.",
      },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Legal</p>
      <h1 className="mt-3 font-serif text-4xl">Termos de Uso</h1>
      <p className="mt-3 text-sm text-muted-foreground">Última atualização: julho de 2026</p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground">
        <Block title="1. Aceitação dos termos">
          <p>
            Ao criar uma conta ou usar o aplicativo <strong>Obstétrica</strong> (o "app"), você
            concorda com estes Termos de Uso e com a nossa{" "}
            <a href="/privacidade" className="text-primary hover:underline">
              Política de Privacidade
            </a>
            . Se você não concordar, não utilize o app.
          </p>
        </Block>

        <Block title="2. O que é o app">
          <p>
            O Obstétrica é uma ferramenta digital de apoio ao pré-natal que ajuda a gestante a
            acompanhar a gestação (cálculos gestacionais, diário, checklist, registros de saúde) e
            facilita o acompanhamento pelo médico (agenda, teleconsulta, perguntas, materiais). O
            app é operado por <strong>{DOCTOR.name}</strong>, {DOCTOR.title}.
          </p>
        </Block>

        <Block title="3. Aviso médico importante">
          <p>
            O app é uma <strong>ferramenta de apoio e organização</strong> e{" "}
            <strong>não substitui</strong> a consulta médica, o diagnóstico ou o tratamento por um
            profissional de saúde. As informações e cálculos exibidos são estimativas educativas.
          </p>
          <p className="mt-3">
            <strong>Em caso de emergência</strong> (sangramento, dor intensa, redução dos movimentos
            do bebê, entre outros), ligue para o <strong>192 (SAMU)</strong> ou procure o
            pronto-socorro imediatamente. Não use o app para decisões de urgência.
          </p>
        </Block>

        <Block title="4. Conta e responsabilidade do usuário">
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Você deve fornecer informações verdadeiras e manter seus dados atualizados.</li>
            <li>
              Você é responsável por manter a confidencialidade da sua senha e por toda atividade na
              sua conta.
            </li>
            <li>É proibido usar a conta de outra pessoa sem autorização.</li>
            <li>
              O app destina-se a maiores de 18 anos ou a menores com consentimento do responsável.
            </li>
          </ul>
        </Block>

        <Block title="5. Médicos assinantes">
          <p>
            Médicos podem criar um perfil profissional e assinar um plano para acompanhar suas
            pacientes. O médico é responsável pela veracidade dos dados do seu perfil (CRM,
            especialidade) e pela conduta clínica com suas pacientes. A conexão opcional da Google
            Agenda serve apenas para hospedar teleconsultas, conforme a{" "}
            <a href="/privacidade" className="text-primary hover:underline">
              Política de Privacidade
            </a>{" "}
            (seção 6).
          </p>
        </Block>

        <Block title="6. Pagamentos e assinaturas">
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Planos pagos são cobrados de forma recorrente (mensal ou anual) através do provedor de
              pagamento <strong>Stripe</strong>.
            </li>
            <li>
              A assinatura renova automaticamente até o cancelamento, que pode ser feito a qualquer
              momento pelo portal de cobrança.
            </li>
            <li>
              Períodos de avaliação gratuita ("trial") têm duração informada no momento da
              contratação e podem virar cobrança ao final, salvo cancelamento.
            </li>
            <li>Preços podem mudar mediante aviso prévio.</li>
          </ul>
        </Block>

        <Block title="7. Uso aceitável">
          <p>Você concorda em não:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>usar o app para fins ilegais ou que violem direitos de terceiros;</li>
            <li>tentar acessar dados de outras pessoas ou burlar mecanismos de segurança;</li>
            <li>enviar conteúdo ofensivo, fraudulento ou que não seja seu;</li>
            <li>sobrecarregar, copiar ou fazer engenharia reversa do serviço.</li>
          </ul>
        </Block>

        <Block title="8. Propriedade intelectual">
          <p>
            O app, sua marca, textos, layout e código são protegidos por direitos autorais. Os dados
            que você insere continuam sendo seus; você nos concede apenas a licença necessária para
            operar o serviço para você.
          </p>
        </Block>

        <Block title="9. Limitação de responsabilidade">
          <p>
            O app é fornecido "no estado em que se encontra". Na máxima extensão permitida por lei,
            não nos responsabilizamos por decisões tomadas com base nas informações do app, por
            indisponibilidades temporárias ou por danos indiretos. Nada nestes termos limita
            responsabilidades que não possam ser excluídas pela legislação aplicável.
          </p>
        </Block>

        <Block title="10. Encerramento">
          <p>
            Você pode encerrar sua conta a qualquer momento. Podemos suspender ou encerrar contas
            que violem estes termos. Após o encerramento, tratamos seus dados conforme a Política de
            Privacidade.
          </p>
        </Block>

        <Block title="11. Alterações destes termos">
          <p>
            Estes termos podem ser atualizados periodicamente. Mudanças relevantes serão comunicadas
            no app ou por e-mail. A data de última atualização estará sempre no topo desta página.
          </p>
        </Block>

        <Block title="12. Lei aplicável e contato">
          <p>
            Estes termos são regidos pelas leis do Brasil. Dúvidas ou solicitações:{" "}
            <a href={`mailto:${DOCTOR.email}`} className="text-primary hover:underline">
              {DOCTOR.email}
            </a>
            .
          </p>
        </Block>
      </div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-xl text-foreground">{title}</h2>
      <div className="mt-3 text-muted-foreground">{children}</div>
    </div>
  );
}
