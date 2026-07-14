export const DOCTOR = {
  name: "Dr. Clóvis Bacha",
  title: "Ginecologista e Obstetra",
  specialty: "Especialista em Gestação de Alto Risco",
  /** Número real do CRM-MG — ex: "CRM-MG 12.345" */
  crm: "CRM-MG 22.333",
  /** RQE da especialidade de GO */
  rqe: "",
  /** E-mail profissional público */
  email: "contato@drclovisbacha.com.br",
  /** E-mail de SUPORTE da plataforma Obstétrica (chat primeiro, e-mail depois) */
  supportEmail: "obstetrica.app@gmail.com",
  /** WhatsApp com DDI (usado pelo componente whatsapp-button) */
  whatsappUrl: "https://wa.me/5531986342903",
  whatsappDisplay: "+55 (31) 98634-2903",
  /** Endereço do consultório — deixar vazio para não exibir no rodapé */
  address: "",
  /** URL pública do site (sem barra final) — usada no sitemap e OG */
  siteUrl: "https://obstetrica.com.br",
  instagram: "https://www.instagram.com/drclovisbacha/",
  /** Chave PIX para recebimento de consultas particulares */
  pixKey: "bachaclovis@gmail.com",
  pixName: "Dr. Clóvis Bacha",
};

if (import.meta.env.DEV && (DOCTOR.crm.includes("●") || DOCTOR.whatsappUrl.includes("99999999"))) {
  console.warn(
    "[doctor.config] Valores placeholder detectados (CRM, WhatsApp). Preencha antes do go-live.",
  );
}
