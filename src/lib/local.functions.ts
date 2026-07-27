import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Localização APROXIMADA da paciente, deduzida do IP.
 *
 * Existe por causa de um buraco de experiência: o céu, o clima e (em breve) a
 * chuva do app dependem de onde a pessoa está. Quem recusa — ou simplesmente
 * IGNORA — o pedido de localização do navegador caía numa cidade fixa, e o app
 * passava a mentir em silêncio: sol às 19h, céu de tarde em plena noite, chuva
 * na tela num dia seco. Pior, quem ignora o pedido só descobre isso depois do
 * timeout de 8s do `getCurrentPosition`, porque o navegador não chama nenhum
 * dos dois callbacks enquanto a caixa de diálogo está aberta.
 *
 * A Vercel já anexa a geolocalização de borda em todo request, então este dado
 * chega DE GRAÇA e NA HORA: sem pedir permissão, sem chamada a serviço
 * terceiro, sem expor o IP para fora da infra que já o recebe. A precisão é de
 * cidade — mais que suficiente para nascer do sol, pôr do sol e chuva, que não
 * mudam de rua para rua.
 *
 * NÃO substitui o GPS: é o piso, para a tela nunca começar errada. Quando a
 * paciente concede a permissão, o GPS assume e manda.
 *
 * Em desenvolvimento os cabeçalhos não existem e a função devolve `null` — daí
 * o app cai no último recurso, que é a cidade da clínica.
 */
export type LocalAprox = {
  lat: number;
  lon: number;
  /** Nome da cidade, quando a borda soube dizer — usado para explicar a origem. */
  cidade: string | null;
};

export const getApproxLocation = createServerFn({ method: "GET" }).handler(
  async (): Promise<LocalAprox | null> => {
    const req = getRequest();
    const h = req?.headers;
    if (!h) return null;

    const lat = Number(h.get("x-vercel-ip-latitude"));
    const lon = Number(h.get("x-vercel-ip-longitude"));
    // `Number("")` é 0 e 0,0 é um ponto válido no Atlântico — por isso o teste
    // é de finitude E de conteúdo, não `if (lat)`.
    const temCoord =
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      h.get("x-vercel-ip-latitude") !== null &&
      h.get("x-vercel-ip-longitude") !== null;
    if (!temCoord) return null;

    // A cidade vem percent-encoded (ex.: "S%C3%A3o%20Paulo").
    const bruta = h.get("x-vercel-ip-city");
    let cidade: string | null = null;
    if (bruta) {
      try {
        cidade = decodeURIComponent(bruta);
      } catch {
        cidade = bruta;
      }
    }
    return { lat, lon, cidade };
  },
);
