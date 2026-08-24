/**
 * Telefone digitado por gente → links que o celular entende.
 *
 * Os telefones do app vêm de campos de texto livre: a paciente escreve o
 * contato de emergência como "(31) 98888-7777" e o médico cadastra o WhatsApp
 * dele como "31 98634-2903", "+55 31 986342903" ou "5531986342903". Nada
 * disso é um link.
 *
 * Aqui só sobram os dígitos, e o DDI 55 entra quando falta. Números que não
 * cabem em nenhum formato brasileiro devolvem `null` — de propósito: quem
 * chama precisa saber que não dá para ligar, e não receber um link quebrado.
 * Numa tela de emergência, um botão que não faz nada é pior que um botão a
 * menos.
 *
 * 10 dígitos = DDD + fixo · 11 = DDD + celular · 12/13 = os mesmos com DDI.
 */

function digitos(tel?: string | null): string | null {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length === 12 || d.length === 13) return d;
  return null;
}

/** `https://wa.me/55...` — ou `null` se o número não for utilizável. */
export function linkWhatsApp(tel?: string | null): string | null {
  const d = digitos(tel);
  return d ? `https://wa.me/${d}` : null;
}

/**
 * `whatsapp://send?phone=…` — o ESQUEMA DO APLICATIVO, e não o link web.
 *
 * A diferença importa numa situação só, e ela é a do SOS: o esquema **não
 * navega a página**. O sistema entrega ao WhatsApp e a página que disparou
 * continua viva — o que permite a ela se fechar sozinha depois.
 *
 * Com `https://wa.me/…` a página NAVEGA, e aí quem a abriu perde o controle
 * dela: foi assim que a tela verde "Abrindo o WhatsApp…" ficava para sempre no
 * app instalado, sem barra de navegador e sem botão de voltar.
 *
 * Não substitui o link web: se o WhatsApp não estiver instalado, o esquema não
 * faz nada, e aí o `wa.me` é o recuo. Ver `emergency-sheet.tsx`.
 */
export function esquemaWhatsApp(tel?: string | null, texto?: string): string | null {
  const d = digitos(tel);
  if (!d) return null;
  const t = texto ? `&text=${encodeURIComponent(texto)}` : "";
  return `whatsapp://send?phone=${d}${t}`;
}

/**
 * `tel:+55...` — o toque abre o discador com o número já preenchido.
 *
 * Não existe "discar sozinho": iOS e Android exigem que a pessoa confirme a
 * chamada, no navegador e no app instalado. É regra do sistema, não escolha
 * nossa — e é a mesma coisa que acontece quando se toca num telefone dentro
 * do Google Maps ou do WhatsApp.
 */
export function linkTel(tel?: string | null): string | null {
  const d = digitos(tel);
  return d ? `tel:+${d}` : null;
}

/** "(31) 98634-2903" para exibição. Devolve o original se não reconhecer. */
export function formataTelefone(tel?: string | null): string {
  const d = digitos(tel);
  if (!d) return (tel ?? "").trim();
  const local = d.slice(2); // sem o DDI
  const ddd = local.slice(0, 2);
  const resto = local.slice(2);
  const meio = resto.length === 9 ? resto.slice(0, 5) : resto.slice(0, 4);
  const fim = resto.length === 9 ? resto.slice(5) : resto.slice(4);
  return `(${ddd}) ${meio}-${fim}`;
}
