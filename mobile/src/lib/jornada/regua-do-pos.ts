/**
 * A RÉGUA DO CONTEÚDO DO PÓS-PARTO — o que nenhum texto do 4º trimestre diz
 * (21/10/2026: rede social + gamificação, não conselho médico). É o roteiro
 * clínico do site, palavra por palavra: mamadas, lóquios, coto, vacinas,
 * consulta puerperal, contracepção, "marcos esperados", e o corpo dela
 * (sono, recuperação, peso). "Banho" entra só como o do bebê: um banho sem
 * pressa é gentileza com ela.
 *
 * Mora fora dos testes porque duas catracas a usam: a dos desafios e textos da
 * semana (`pos-parto.test.ts`) e a das falas da Bolha no pós
 * (`bolha/conversa.test.ts`). Nenhuma tela a importa.
 */
export const CONDUTA_DO_POS =
  /\b(m[eé]dic[oa]s?|pediatra|consultas?|exames?|vacinas?|rem[eé]dios?|suplement\w*|vitaminas?|puerp\w*|amament\w*|mamadas?|mamar|peito|leite|pega|mamilos?|ordenh\w*|mastite|mamadeiras?|banho (do|no) beb[eê]|dar banho|coto|umbig\w*|c[oó]licas?|febre|icter[ií]cia|chupeta|ber[cç]o|cadeirinha|bru[cç]os|teste do \w+|l[oó]quios?|sangr\w*|pontos|cicatriz\w*|assoalho|p[eé]lvic\w*|abd[oô]m\w*|contracep\w*|anticoncep\w*|exerc[ií]cios?|treinar|treino|liberad[oa]|liberou|recupera\w*|baby blues|depress\w*|ansiedade|tristeza|psic[oó]\w*|terapia|procure|diagn[oó]stic\w*|ferro|nutri\w*|dieta|hidrat\w*|dormir|durma|sono|soneca|cochil\w*|acalm\w*|ninar|normal|esperad[oa]s?|deveria|desenvolvimento|peso|gramas?|quilos?)\b/i;
