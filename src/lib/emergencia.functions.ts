/**
 * Disparo de emergência — o que acontece quando ela toca no SOS.
 *
 * O botão antigo montava uma mensagem e abria o WhatsApp: quem enviava era
 * ela. Numa emergência de verdade isso é frágil — quem está passando mal, com
 * a visão embaçada ou prestes a desmaiar, pode não concluir. E o app dizia
 * "enviado" mesmo assim.
 *
 * Agora o envio é do SERVIDOR, num toque só, por todos os canais que existirem
 * para aquela paciente:
 *
 *   1. PUSH para o médico dela — chega no celular dele em segundos;
 *   2. E-MAIL para o médico dela — o canal que não depende de ele ter
 *      autorizado notificação no navegador;
 *   3. E-MAIL para o contato de emergência — se ela cadastrou o e-mail dele;
 *   4. SMS/WhatsApp para o contato — via webhook configurável (ver abaixo).
 *
 * A resposta diz QUAIS canais saíram, e a tela mostra isso. Nada de "enviado"
 * genérico: se só o médico foi avisado, ela precisa saber que o marido ainda
 * não sabe — e é aí que o WhatsApp manual continua valendo, agora como o que
 * FALTA e não como o que foi feito.
 *
 * ── Webhook de SMS/WhatsApp (opcional) ────────────────────────────────────
 * `SOS_SMS_WEBHOOK_URL` recebe um POST `{ "to": "+5531...", "text": "..." }`,
 * com `Authorization: Bearer SOS_SMS_WEBHOOK_TOKEN` se o token existir.
 * É de propósito genérico: aponte para o Twilio, Zenvia, WhatsApp Cloud API ou
 * um n8n/Zapier no meio. Sem a variável, o canal simplesmente não existe e a
 * tela avisa que falta o contato — nunca finge que mandou.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CanaisAviso = {
  /** Quantos aparelhos do médico receberam o push. */
  medicoPush: number;
  medicoEmail: boolean;
  contatoEmail: boolean;
  sms: boolean;
  /**
   * Quem recebeu, e ONDE. A tela lista isto tal como voltou.
   *
   * O `via` existe porque "SOS enviado" sozinho não prova nada: ver o próprio
   * e-mail do marido escrito na confirmação é o que diz à paciente que o aviso
   * saiu para a pessoa certa — e, se estiver errado, que ela precisa corrigir
   * o cadastro antes da próxima vez.
   */
  destinos: { nome: string; via: string }[];
  /** Nome do contato que NÃO recebeu nada — a tela oferece o WhatsApp dele. */
  faltou: string | null;
};

/**
 * A ficha que vai junto do pedido de socorro.
 *
 * É a MESMA carteirinha de emergência que ela mostraria no hospital, só que em
 * texto: quem chega para ajudar precisa saber tipo sanguíneo e alergia antes
 * de chamar o resgate, e o resgate precisa disso antes de medicar. Mandar só
 * "preciso de ajuda" com um mapa desperdiça o único momento em que esses
 * dados valem mais do que em qualquer outro.
 */
export type Ficha = {
  nome: string;
  /** O telefone DELA — o primeiro número que quem recebe o socorro tenta. */
  telefone: string | null;
  bebe: string | null;
  semana: string | null;
  dpp: string | null;
  sangue: string | null;
  alergias: string | null;
  medicamentos: string | null;
  /** Nome + CRM. O telefone vai em `medicoTel`, separado, para virar link. */
  medico: string | null;
  /** Em +55 31 98634-2903: e assim que o WhatsApp reconhece e vira "ligar". */
  medicoTel: string | null;
  /** Hospitais onde o médico atende, como ele cadastrou. */
  hospitais: string | null;
  endereco: string | null;
  mapa: string | null;
  /** Busca de hospitais no mapa a partir da coordenada dela. */
  hospitaisPerto: string | null;
};

function linhasDaFicha(f: Ficha): [string, string][] {
  const todas: [string, string | null][] = [
    ["Gestante", f.nome],
    ["Telefone dela", f.telefone],
    ["Bebê", f.bebe],
    ["Idade gestacional", f.semana],
    ["DPP", f.dpp],
    ["Tipo sanguíneo", f.sangue],
    ["Alergias", f.alergias || "nenhuma informada"],
    ["Medicamentos", f.medicamentos || "nenhum informado"],
    ["Médico", f.medico],
    ["Telefone do médico", f.medicoTel],
    ["Onde o médico atende", f.hospitais],
    ["Local", f.endereco],
  ];
  return todas.filter((l): l is [string, string] => !!l[1]);
}

export function textoDoAviso(f: Ficha): string {
  return [
    `🆘 ${f.nome} acionou o botão de emergência do app Obstétrica.`,
    "",
    ...linhasDaFicha(f).map(([k, v]) => `${k}: ${v}`),
    "",
    f.mapa ? `Onde ela está: ${f.mapa}` : "Não foi possível obter a localização.",
    f.hospitaisPerto ? `Hospitais perto dela: ${f.hospitaisPerto}` : null,
    "",
    "Em caso de risco de vida, ligue 192.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export const dispararEmergencia = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        latitude: z.number().nullable(),
        longitude: z.number().nullable(),
        address: z.string().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const vazio: CanaisAviso = {
      medicoPush: 0,
      medicoEmail: false,
      contatoEmail: false,
      sms: false,
      destinos: [],
      faltou: null,
    };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (!u.user) return { ok: false as const, canais: vazio, mensagem: "" };

      const sb = supabaseAdmin as any;

      /* A ficha é lida em DEGRAUS, e isto é a diferença entre avisar alguém e
         não avisar ninguém.
      
         O PostgREST devolve 42703 para a consulta INTEIRA quando UMA coluna não
         existe. Com um select único de 15 colunas — duas delas criadas só nos
         arquivos APLICAR_SOS/SOS2 — bastava uma migração pendente para `prof`
         virar null; e aí `prof?.doctor_id` é falso (médico não é avisado),
         `emergency_email` é vazio (contato não é avisado), e o handler ainda
         devolvia `ok: true`. O botão dizia "✓ Aviso enviado" e ninguém tinha
         sido avisado. Numa emergência.
      
         Cada degrau abre mão do que é dispensável e mantém o que decide PARA
         QUEM o aviso vai. O último só pede o que existe desde a criação da
         tabela — se nem ele funcionar, o erro é real e vira `ok: false`. */
      const DEGRAUS = [
        "display_name, phone, baby_name, blood_type, allergies, medications, emergency_contact, emergency_phone, emergency_email, doctor_id, due_date, lmp_date, reference_date, reference_weeks, reference_days",
        // Sem `phone` (só em APLICAR_SOS2) nem `reference_*`.
        "display_name, baby_name, blood_type, allergies, medications, emergency_contact, emergency_phone, emergency_email, doctor_id, due_date, lmp_date",
        // Sem `emergency_email` (só em APLICAR_SOS) nem `medications`.
        "display_name, baby_name, blood_type, allergies, emergency_contact, emergency_phone, doctor_id, due_date, lmp_date",
        // Sem `doctor_id` (multi-tenant, migração 20260707200000).
        "display_name, emergency_contact, emergency_phone, doctor_id",
        /* Piso REAL: só o que a tabela tem desde a criação
           (20260607050155). O piso anterior pedia `doctor_id`, que é de uma
           migração posterior — então num banco sem ela os quatro degraus
           falhavam e o SOS inteiro virava erro. Pior que antes: o cliente
           passava a lançar e FECHAVA a aba do WhatsApp já aberta, matando o
           único canal que ainda funcionava naquele estado. */
        "display_name, emergency_contact, emergency_phone",
        "display_name",
      ];
      let prof: any = null;
      let erroFicha: unknown = null;
      for (const cols of DEGRAUS) {
        const r = await sb.from("patient_profiles").select(cols).eq("id", u.user.id).maybeSingle();
        if (!r.error) {
          prof = r.data;
          erroFicha = null;
          break;
        }
        erroFicha = r.error;
        // Só vale descer um degrau quando o problema é coluna inexistente.
        if ((r.error as { code?: string }).code !== "42703") break;
      }
      /* Quais colunas de fato vieram. Sem isto, um degrau que não leu
         `allergies` produzia "Alergias: nenhuma informada" na mensagem que a
         equipe de resgate lê — afirmar ausência de alergia por não ter
         conseguido ler o campo é o pior erro possível nesta tela. */
      const leu = (c: string) => !!prof && Object.prototype.hasOwnProperty.call(prof, c);
      if (erroFicha) {
        console.error("[dispararEmergencia] ficha ilegível", erroFicha);
        return {
          ok: false as const,
          canais: vazio,
          mensagem: "",
          erro: "ficha" as const,
        };
      }

      const nome = (prof?.display_name as string) || "Uma paciente";
      const mapa =
        data.latitude != null && data.longitude != null
          ? `https://maps.google.com/?q=${data.latitude},${data.longitude}`
          : null;

      // A semana sai do mesmo cálculo do app; se não der, o aviso vai sem ela
      // em vez de segurar o disparo.
      let semana: string | null = null;
      try {
        const { computeGestation } = await import("@/lib/gestacao");
        const g = computeGestation({
          lmp: (prof?.lmp_date as string) ?? null,
          referenceDate: (prof?.reference_date as string) ?? null,
          referenceWeeks: (prof?.reference_weeks as number) ?? null,
          referenceDays: (prof?.reference_days as number) ?? null,
        });
        semana = g ? `${g.weeks}s ${g.days}d` : null;
      } catch {
        /* opcional */
      }

      let dpp: string | null = null;
      try {
        const { dueDateFromLmp } = await import("@/lib/gestacao");
        const due =
          (prof?.due_date as string) ??
          (prof?.lmp_date ? dueDateFromLmp(prof.lmp_date as string) : null);
        dpp = due ? new Date(`${due}T00:00:00`).toLocaleDateString("pt-BR") : null;
      } catch {
        /* opcional */
      }

      const ficha: Ficha = {
        nome,
        telefone: paraExibir(prof?.phone as string | null),
        bebe: (prof?.baby_name as string) ?? null,
        semana,
        dpp,
        sangue: (prof?.blood_type as string) ?? null,
        /* "não consegui ler" ≠ "não tem". Quando o degrau usado não trouxe a
           coluna, a mensagem diz isso em vez de afirmar ausência de alergia. */
        alergias: leu("allergies")
          ? ((prof?.allergies as string) ?? null)
          : "NÃO VERIFICADO — confirmar com a paciente",
        medicamentos: leu("medications")
          ? ((prof?.medications as string) ?? null)
          : "NÃO VERIFICADO — confirmar com a paciente",
        medico: null, // preenchidos logo abaixo, quando houver vínculo
        medicoTel: null,
        hospitais: null,
        endereco: data.address,
        mapa,
        /* Link de BUSCA no mapa, e não uma lista vinda de uma API: uma
           chamada a mais no caminho do socorro é uma chance a mais de ele
           demorar ou falhar, e o Google já sabe achar hospital perto de uma
           coordenada melhor do que qualquer lista que a gente mantenha. */
        hospitaisPerto:
          data.latitude != null && data.longitude != null
            ? `https://www.google.com/maps/search/hospital/@${data.latitude},${data.longitude},14z`
            : null,
      };

      const canais: CanaisAviso = { ...vazio };

      /* ── 1 e 2. O MÉDICO DELA ─────────────────────────────────────────
         Quem recebe o alerta é o médico que acompanha aquela gestação, lido de
         `patient_profiles.doctor_id`. Mais ninguém.

         Não existe cair no dono da instalação: a Obstétrica é a PLATAFORMA, e
         quem atende uma emergência obstétrica é o obstetra daquela paciente.
         Mandar o alerta para o e-mail administrativo criaria a pior das
         ilusões — alguém "avisado" que não tem como agir, e a paciente
         achando que o médico dela já sabe.

         Sem vínculo, o campo fica vazio e a tela DIZ que nenhum médico foi
         avisado. É informação, não falha silenciosa: é o que faz ela procurar
         o 192 em vez de esperar. */
      let medicoNome: string | null = null;
      let medicoUserId: string | null = null;
      if (prof?.doctor_id) {
        const { data: d } = await sb
          .from("doctors")
          .select("display_name, crm, whatsapp, hospitals")
          .eq("id", prof.doctor_id)
          .maybeSingle();
        medicoNome = (d?.display_name as string) || "seu médico";
        medicoUserId = prof.doctor_id as string;
        ficha.medico =
          [d?.display_name, d?.crm ? `(${d.crm})` : null].filter(Boolean).join(" ") || null;
        ficha.medicoTel = paraExibir(d?.whatsapp as string | null);
        ficha.hospitais = ((d?.hospitals as string) || "").trim() || null;
      }
      /* Só agora: a linha do médico faz parte da ficha que vai no aviso. */
      const texto = textoDoAviso(ficha);

      if (medicoUserId) {
        try {
          const { sendPushToUser } = await import("@/lib/push.server");
          const r = await sendPushToUser(medicoUserId, {
            title: `🆘 ${nome} acionou o SOS`,
            body: texto.split("\n").slice(1, 3).join(" "),
            url: "/painel",
          });
          canais.medicoPush = r.sent;
        } catch {
          /* melhor esforço */
        }
        try {
          const { data: dUser } = await supabaseAdmin.auth.admin.getUserById(medicoUserId);
          const email = dUser?.user?.email;
          if (email) {
            const { sendEmail } = await import("@/lib/email.server");
            canais.medicoEmail = await sendEmail({
              to: email,
              subject: `🆘 EMERGÊNCIA — ${nome} acionou o SOS`,
              html: emailHtml(nome, ficha),
            });
          }
        } catch {
          /* melhor esforço */
        }
      }

      if ((canais.medicoPush > 0 || canais.medicoEmail) && medicoNome) {
        const vias = [
          canais.medicoPush > 0 ? "notificação no celular" : null,
          canais.medicoEmail ? "e-mail" : null,
        ].filter(Boolean);
        canais.destinos.push({ nome: medicoNome, via: vias.join(" e ") });
      }

      /* ── 3. O contato de emergência, por e-mail ───────────────────────── */
      const contatoNome = ((prof?.emergency_contact as string) || "").trim();
      const contatoEmail = ((prof?.emergency_email as string) || "").trim();
      if (contatoEmail) {
        try {
          const { sendEmail } = await import("@/lib/email.server");
          canais.contatoEmail = await sendEmail({
            to: contatoEmail,
            subject: `🆘 ${nome} precisa de ajuda agora`,
            html: emailHtml(nome, ficha),
          });
        } catch {
          /* melhor esforço */
        }
      }

      /* ── 4a. WhatsApp Cloud API, que a instalação já usa ──────────────── */
      const contatoTel = ((prof?.emergency_phone as string) || "").replace(/\D/g, "");
      const contatoE164 = contatoTel.length <= 11 ? `55${contatoTel}` : contatoTel;
      if (contatoTel.length >= 10) {
        try {
          const { waConfigured, waSendText, waSendTemplate } =
            await import("@/lib/whatsapp.server");
          if (waConfigured()) {
            /* MODELO aprovado quando houver: texto livre só chega se a pessoa
               tiver escrito para o número nas últimas 24h, e o contato de
               emergência nunca escreveu. Sem modelo configurado tentamos o
               texto assim mesmo — em alguns casos (ela já conversou com a
               clínica) ele passa, e falhar aqui não custa nada. */
            const modelo = process.env.SOS_WA_TEMPLATE;
            if (modelo) {
              await waSendTemplate(
                contatoE164,
                modelo,
                process.env.SOS_WA_TEMPLATE_LANG || "pt_BR",
                [nome, semana ?? "—", mapa ?? "localização indisponível"],
              );
            } else {
              await waSendText(contatoE164, texto);
            }
            canais.sms = true;
          }
        } catch {
          /* cai no webhook genérico abaixo */
        }
      }

      /* ── 4b. SMS/WhatsApp pelo webhook genérico, se configurado ───────── */
      const hook = process.env.SOS_SMS_WEBHOOK_URL;
      if (!canais.sms && hook && contatoTel.length >= 10) {
        try {
          const res = await fetch(hook, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(process.env.SOS_SMS_WEBHOOK_TOKEN
                ? { authorization: `Bearer ${process.env.SOS_SMS_WEBHOOK_TOKEN}` }
                : {}),
            },
            body: JSON.stringify({ to: `+${contatoE164}`, text: texto }),
          });
          canais.sms = res.ok;
        } catch {
          /* melhor esforço */
        }
      }

      /* O contato aparece com o endereço/número de verdade: é a única forma de
         ela conferir, na hora, que o aviso foi para quem ela cadastrou. */
      if (canais.contatoEmail || canais.sms) {
        const vias = [
          canais.contatoEmail ? contatoEmail : null,
          canais.sms ? formatarTelefone(contatoE164) : null,
        ].filter(Boolean);
        canais.destinos.push({
          nome: contatoNome || "seu contato de emergência",
          via: vias.join(" · "),
        });
      }
      // Só é "faltou" quando existe um contato cadastrado e nada chegou nele.
      if (contatoNome && !canais.contatoEmail && !canais.sms) canais.faltou = contatoNome;
      /* ── Registro, com o que saiu ─────────────────────────────────────── */
      try {
        await sb.from("panic_events").insert({
          user_id: u.user.id,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address,
          channels: canais,
        });
      } catch {
        /* a coluna `channels` pode não existir ainda; o evento importa mais */
        try {
          await sb.from("panic_events").insert({
            user_id: u.user.id,
            latitude: data.latitude,
            longitude: data.longitude,
            address: data.address,
          });
        } catch {
          /* melhor esforço */
        }
      }

      return { ok: true as const, canais, mensagem: texto };
    } catch {
      return { ok: false as const, canais: vazio, mensagem: "" };
    }
  });

function emailHtml(nome: string, ficha: Ficha): string {
  const linhas = linhasDaFicha(ficha)
    .map(
      ([k, v]) => `<tr>
        <td style="padding:6px 12px 6px 0;font-size:13px;color:#6b7280;white-space:nowrap;vertical-align:top">${escapar(k)}</td>
        <td style="padding:6px 0;font-size:15px;color:#111827;font-weight:600">${escapar(v)}</td>
      </tr>`,
    )
    .join("");
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.18em;color:#be123c;font-weight:800">
        ALERTA DE EMERGENCIA
      </p>
      <h1 style="margin:0 0 6px;font-size:24px;line-height:1.2;color:#111827">
        ${escapar(nome)} acionou o SOS
      </h1>
      <p style="margin:0 0 18px;font-size:14px;color:#6b7280">
        Enviado automaticamente no momento do acionamento.
      </p>
      ${
        ficha.mapa
          ? `<a href="${ficha.mapa}" style="display:inline-block;background:#be123c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;font-size:15px;margin:0 8px 10px 0">Ver a localizacao no mapa</a>`
          : `<p style="margin:0 0 18px;padding:10px 14px;background:#fef3c7;border-radius:10px;font-size:14px;color:#92400e">Nao foi possivel obter a localizacao.</p>`
      }
      ${
        ficha.hospitaisPerto
          ? `<a href="${ficha.hospitaisPerto}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;font-size:15px;margin:0 0 18px">Hospitais perto dela</a>`
          : ""
      }
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:.14em;color:#6b7280;font-weight:700">
        FICHA DE EMERGENCIA
      </p>
      <table style="border-collapse:collapse;width:100%;border-top:1px solid #e5e7eb">${linhas}</table>
      <p style="margin:20px 0 0;padding:12px 14px;background:#fef2f2;border-radius:10px;font-size:14px;color:#991b1b;font-weight:600">
        Em caso de risco de vida, ligue 192 (SAMU).
      </p>
      <p style="margin:14px 0 0;font-size:11px;color:#9ca3af">
        Mensagem automatica do app Obstetrica.
      </p>
    </div>`;
}

/**
 * Telefone no formato que o WhatsApp reconhece e transforma em "ligar":
 * `+55 31 98634-2903`. Sem o `+55` ele fica texto morto na mensagem, e quem
 * precisa ligar teria que digitar o número na mão — exatamente no momento em
 * que ninguém digita nada direito.
 */
function paraExibir(tel?: string | null): string | null {
  const d = (tel ?? "").replace(/\D/g, "");
  if (!d) return null;
  const cheio = d.length === 10 || d.length === 11 ? `55${d}` : d;
  if (cheio.length < 12) return null;
  const local = cheio.slice(2);
  const ddd = local.slice(0, 2);
  const resto = local.slice(2);
  const meio = resto.length === 9 ? resto.slice(0, 5) : resto.slice(0, 4);
  const fim = resto.length === 9 ? resto.slice(5) : resto.slice(4);
  return `+55 ${ddd} ${meio}-${fim}`;
}

/** "(31) 98888-7777" a partir do E.164 sem o +. */
function formatarTelefone(e164: string): string {
  const local = e164.startsWith("55") ? e164.slice(2) : e164;
  const ddd = local.slice(0, 2);
  const resto = local.slice(2);
  if (resto.length < 8) return `+${e164}`;
  const meio = resto.length === 9 ? resto.slice(0, 5) : resto.slice(0, 4);
  const fim = resto.length === 9 ? resto.slice(5) : resto.slice(4);
  return `(${ddd}) ${meio}-${fim}`;
}

function escapar(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}
