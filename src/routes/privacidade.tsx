import { createFileRoute } from "@tanstack/react-router";
import { DOCTOR } from "@/lib/doctor.config";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Obstétrica by Dr. Clóvis" },
      {
        name: "description",
        content:
          "Como coletamos, usamos e protegemos seus dados no app Obstétrica, em conformidade com a LGPD.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Legal</p>
      <h1 className="mt-3 font-serif text-4xl">Política de Privacidade</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Última atualização: junho de 2026 · Em conformidade com a Lei Geral de Proteção de Dados
        (LGPD — Lei nº 13.709/2018)
      </p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground">
        <Block title="1. Quem somos">
          <p>
            O aplicativo <strong>Obstétrica by Dr. Clóvis</strong> é operado por{" "}
            <strong>{DOCTOR.name}</strong>, {DOCTOR.title}, com contato disponível em{" "}
            <a href={`mailto:${DOCTOR.email}`} className="text-primary hover:underline">
              {DOCTOR.email}
            </a>
            . Somos o controlador dos dados pessoais coletados neste aplicativo.
          </p>
        </Block>

        <Block title="2. Quais dados coletamos">
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Dados de cadastro:</strong> nome, endereço de e-mail e senha (armazenada com
              hash — nunca em texto puro).
            </li>
            <li>
              <strong>Dados de saúde gestacional:</strong> data da última menstruação, data provável
              do parto, peso, altura, tipo sanguíneo, alergias, medicamentos em uso e nome do bebê —
              fornecidos voluntariamente pela usuária para funcionamento do app.
            </li>
            <li>
              <strong>Registros do diário:</strong> anotações pessoais, registros de humor, contagem
              de movimentos fetais e logs de saúde inseridos pela usuária.
            </li>
            <li>
              <strong>Dados de contato de emergência:</strong> nome e telefone de familiar ou
              responsável, para uso exclusivo na carteirinha de emergência digital.
            </li>
            <li>
              <strong>Dados técnicos:</strong> endereço IP, tipo de navegador e logs de acesso,
              coletados automaticamente para segurança e diagnóstico de erros.
            </li>
          </ul>
          <p className="mt-3 text-muted-foreground">
            Não coletamos dados desnecessários. Todos os campos opcionais são claramente
            identificados no app.
          </p>
        </Block>

        <Block title="3. Para que usamos seus dados">
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Fornecer as funcionalidades do app (cálculos gestacionais, diário, checklist,
              agendamento).
            </li>
            <li>Permitir que o médico acompanhe o pré-natal de forma organizada.</li>
            <li>Enviar notificações sobre consultas agendadas (com seu consentimento).</li>
            <li>Melhorar a segurança e estabilidade do sistema.</li>
            <li>Cumprir obrigações legais aplicáveis.</li>
          </ul>
          <p className="mt-3 text-muted-foreground">
            <strong>Não utilizamos seus dados para publicidade.</strong> Não vendemos, alugamos nem
            compartilhamos dados pessoais com terceiros para fins comerciais.
          </p>
        </Block>

        <Block title="4. Base legal (LGPD — Art. 7º e 11º)">
          <p>O tratamento de dados neste app se apoia nas seguintes bases legais:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Consentimento</strong> (Art. 7º, I): para coleta de dados de saúde e envio de
              comunicações.
            </li>
            <li>
              <strong>Execução de contrato</strong> (Art. 7º, V): para prestação dos serviços do
              app.
            </li>
            <li>
              <strong>Tutela da saúde</strong> (Art. 11º, II, f): para dados de saúde usados
              exclusivamente no contexto do acompanhamento médico.
            </li>
            <li>
              <strong>Legítimo interesse</strong> (Art. 7º, IX): para segurança do sistema e
              prevenção de fraudes.
            </li>
          </ul>
        </Block>

        <Block title="5. Com quem compartilhamos">
          <p>
            Seus dados podem ser acessados pelos seguintes prestadores de serviço, exclusivamente
            para operação do app:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Supabase Inc.</strong> (banco de dados e autenticação) — servidores na AWS
              região us-east-1.
            </li>
            <li>
              <strong>Vercel Inc.</strong> (hospedagem do app) — infraestrutura nos EUA.
            </li>
            <li>
              <strong>Google LLC</strong> (API de inteligência artificial para o chatbot) — os dados
              enviados ao chat são processados conforme a política do Google AI.
            </li>
            <li>
              <strong>Resend Inc.</strong> (envio de e-mails transacionais) — somente e-mail e nome
              para envio de confirmações.
            </li>
          </ul>
          <p className="mt-3 text-muted-foreground">
            Todos os parceiros acima possuem políticas de privacidade próprias e são contratualmente
            obrigados a manter a confidencialidade dos dados.
          </p>
        </Block>

        <Block title="6. Por quanto tempo guardamos seus dados">
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Dados de conta e saúde: enquanto a conta estiver ativa, e por até{" "}
              <strong>5 anos</strong> após o encerramento (prazo mínimo para dados de saúde,
              conforme CFM).
            </li>
            <li>
              Logs técnicos: até <strong>90 dias</strong>.
            </li>
            <li>
              Dados de agendamento: até <strong>5 anos</strong> após a consulta realizada.
            </li>
          </ul>
          <p className="mt-3 text-muted-foreground">
            Após esses prazos, os dados são anonimizados ou excluídos de forma segura.
          </p>
        </Block>

        <Block title="7. Seus direitos (LGPD — Art. 18)">
          <p>Você tem direito a:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Confirmar a existência de tratamento e acessar seus dados.</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
            <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários.</li>
            <li>Revogar o consentimento a qualquer momento.</li>
            <li>Solicitar a portabilidade dos seus dados.</li>
            <li>Obter informações sobre compartilhamento com terceiros.</li>
          </ul>
          <p className="mt-3">
            Para exercer qualquer direito, entre em contato:{" "}
            <a href={`mailto:${DOCTOR.email}`} className="text-primary hover:underline">
              {DOCTOR.email}
            </a>
            . Responderemos em até 15 dias úteis.
          </p>
        </Block>

        <Block title="8. Segurança">
          <p>
            Adotamos medidas técnicas e organizacionais para proteger seus dados: conexões
            criptografadas (TLS/HTTPS), senhas armazenadas com hash bcrypt, Row-Level Security no
            banco de dados (cada usuária acessa apenas seus próprios dados), e monitoramento de
            acessos suspeitos.
          </p>
        </Block>

        <Block title="9. Cookies e armazenamento local">
          <p>
            Utilizamos cookies de sessão essenciais para autenticação. Não utilizamos cookies de
            rastreamento ou publicidade. O app pode armazenar dados localmente no seu dispositivo
            (localStorage/IndexedDB) exclusivamente para funcionamento offline.
          </p>
        </Block>

        <Block title="10. Alterações nesta política">
          <p>
            Esta política pode ser atualizada periodicamente. Quando isso ocorrer, notificaremos por
            e-mail cadastrado ou via aviso no app. A data de última atualização sempre estará
            indicada no topo desta página.
          </p>
        </Block>

        <Block title="11. Contato e DPO">
          <p>
            Encarregado de proteção de dados (DPO):{" "}
            <a href={`mailto:${DOCTOR.email}`} className="text-primary hover:underline">
              {DOCTOR.email}
            </a>
            <br />
            Para reclamações à autoridade competente:{" "}
            <a
              href="https://www.gov.br/anpd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              ANPD — Autoridade Nacional de Proteção de Dados
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
