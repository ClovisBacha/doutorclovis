/**
 * CRM em duas partes: UF e número.
 *
 * O registro é estadual — o mesmo número existe em conselhos diferentes, e
 * "CRM 12345" sozinho não identifica ninguém. Um campo de texto livre aceitava
 * "crm mg 12345", "12345/MG", "CRMMG12345": tudo isso é o mesmo médico escrito
 * de seis formas, e nenhuma delas serve para conferir no portal do conselho ou
 * comparar dois cadastros.
 *
 * Na tela viram dois controles (uma lista de UFs e um número). No banco
 * continua UMA coluna `crm`, no formato canônico `CRM-MG 12345`: é o que a
 * carteirinha de emergência imprime e o que o aviso do SOS manda, e trocar o
 * formato guardado exigiria reescrever os dois — sem ganho para quem lê.
 */

export const UFS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
] as const;

export type UF = (typeof UFS)[number];

/**
 * Lê um CRM guardado e devolve as duas partes.
 *
 * Tolerante de propósito: os cadastros que já existem foram digitados à mão,
 * em formatos que ninguém combinou. Pega a UF de qualquer lugar da string
 * (`CRM-MG 123`, `123/MG`, `crm mg 123`) e o número dos dígitos restantes.
 */
export function separarCrm(crm?: string | null): { uf: string; numero: string } {
  const bruto = (crm ?? "").trim();
  if (!bruto) return { uf: "", numero: "" };
  const achada = UFS.find((uf) => new RegExp(`(^|[^A-Z])${uf}([^A-Z]|$)`, "i").test(bruto));
  const numero = bruto.replace(/\D/g, "");
  return { uf: achada ?? "", numero };
}

/** Junta as duas partes no formato canônico. Vazio se faltar alguma. */
export function juntarCrm(uf: string, numero: string): string {
  const n = (numero ?? "").replace(/\D/g, "");
  if (!uf || !n) return "";
  return `CRM-${uf.toUpperCase()} ${n}`;
}
