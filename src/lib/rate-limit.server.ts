/**
 * Rate limit em memória para os endpoints públicos de IA.
 *
 * Compartilhado pelos 4 endpoints (chat, transcribe, nutrition, carta-semanal).
 * Continua sendo uma proteção BÁSICA (memória não compartilhada entre
 * instâncias/cold starts), mas corrige dois problemas da versão anterior:
 *
 * 1. Chave de IP confiável: preferimos `x-real-ip` (setado pela plataforma
 *    Vercel, não controlável pelo cliente) ao `x-forwarded-for`, que um
 *    atacante pode rotacionar à vontade para burlar o limite.
 * 2. O Map agora é PODADO (entradas expiradas saem quando ele cresce), em vez
 *    de crescer sem limite até o fim da instância.
 */

/** IP do cliente a partir de headers confiáveis (Vercel seta x-real-ip). */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

const PRUNE_AT = 1000; // acima disso, remove entradas expiradas

/** Cria um limitador: `limited(ip)` → true quando estourou o limite/janela. */
export function makeRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return function limited(ip: string): boolean {
    const now = Date.now();
    if (hits.size > PRUNE_AT) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    const entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return false;
    }
    entry.count += 1;
    return entry.count > limit;
  };
}
