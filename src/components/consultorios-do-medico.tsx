/**
 * ONDE O MEU MÉDICO ATENDE — a lista que a paciente nunca via.
 *
 * ⚠️ **O MÉDICO CADASTRA VÁRIOS CONSULTÓRIOS E ELA VIA UM CAMPO DE TEXTO.**
 *
 * `doctor_addresses` existe desde `APLICAR_MEDICO.sql`, o painel tem tela de
 * gerenciamento (endereço, telefone, observações, principal), e
 * `listDoctorAddresses` — a função PÚBLICA, feita para ser lida pela paciente —
 * tinha **zero chamadores no app**. O que ela via era `doctors.endereco`, um
 * campo solto do perfil, e só na lista do diretório: o cartão do médico DELA,
 * depois de vinculada, não mostrava endereço nenhum.
 *
 * ⚠️ **O custo disso é ela ir ao lugar errado.** Um obstetra com consultório na
 * segunda e na quinta em endereços diferentes é o caso comum; a paciente de
 * alto risco que atravessa a cidade grávida e chega na porta errada perde a
 * consulta — e a régua deste repositório sobre isso já está escrita: falta em
 * consultório de alto risco é vaga perdida duas vezes.
 *
 * ⚠️ **Ela é PÚBLICA de propósito, e por isso não pede sessão.** A função
 * recorta pelo médico e devolve `[]` quando ele está inativo — quem decide o
 * que é visível é o servidor, e uma segunda régua aqui divergiria dele.
 */
import { useEffect, useState } from "react";

import type { DoctorAddress } from "@/lib/doctor-addresses.functions";

type Estado = "carregando" | "pronto" | "falhou";

/** Uma linha só, para o mapa e para o olho. */
function umaLinha(a: DoctorAddress): string {
  return [a.street, a.city, a.state && a.state.toUpperCase(), a.zip].filter(Boolean).join(", ");
}

export function ConsultoriosDoMedico({
  doctorId,
  bancada,
}: {
  doctorId: string;
  /** Só a bancada: injeta o DADO nos mesmos estados da produção. */
  bancada?: { enderecos: DoctorAddress[]; estado: Estado };
}) {
  const ehBancada = !!bancada;
  const [lista, setLista] = useState<DoctorAddress[]>(bancada?.enderecos ?? []);
  const [estado, setEstado] = useState<Estado>(bancada?.estado ?? "carregando");

  async function carregar() {
    setEstado("carregando");
    try {
      const { listDoctorAddresses } = await import("@/lib/doctor-addresses.functions");
      const r = await listDoctorAddresses({ data: { doctorId } });
      /* ⚠️ `ok: false` chega numa resposta 200 normal — o `catch` não pega. E
         "não consegui ler" NÃO pode virar "ele não tem consultório": ela
         concluiria que precisa perguntar o endereço, ou pior, iria ao antigo. */
      if (!r.ok) {
        setEstado("falhou");
        return;
      }
      setLista(r.addresses);
      setEstado("pronto");
    } catch {
      setEstado("falhou");
    }
  }

  useEffect(() => {
    if (ehBancada) return;
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, ehBancada]);

  if (estado === "carregando") return <div className="skeleton mt-4 h-14 rounded-xl" />;

  if (estado === "falhou") {
    return (
      <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:bg-amber-500/10">
        <p className="text-[13px] text-amber-900/90 dark:text-amber-100/90">
          Não consegui carregar os endereços agora.
        </p>
        <button
          type="button"
          onClick={() => void carregar()}
          className="mt-2 min-h-[44px] rounded-full border border-amber-400 px-4 text-sm font-medium text-amber-900 dark:text-amber-100"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  /* ⚠️ Sem endereço cadastrado a seção NÃO existe — nunca um "nenhum
     consultório cadastrado". Ela não pode fazer nada com essa frase, e ela
     insinua um problema com o médico dela que provavelmente não existe. */
  if (lista.length === 0) return null;

  /* O principal primeiro, depois a ordem que ele escolheu. */
  const ordenados = [...lista].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position,
  );

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Onde ele atende
      </p>
      <div className="mt-2 space-y-2">
        {ordenados.map((a) => {
          const linha = umaLinha(a);
          return (
            <div key={a.id} className="rounded-xl border border-border bg-secondary/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{a.label || "Consultório"}</p>
                {a.is_primary && ordenados.length > 1 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    principal
                  </span>
                )}
              </div>
              {linha && (
                <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{linha}</p>
              )}
              {a.notes && (
                <p className="mt-1 text-[12px] leading-snug text-muted-foreground/80">{a.notes}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {linha && (
                  /* ⚠️ `https://` e nunca um esquema nativo (`geo:`, `maps:`):
                     o nativo não existe no navegador e num PWA instalado o link
                     simplesmente não faria nada, sem erro nenhum. O `https` do
                     Google abre o app de mapas no celular e continua sendo
                     página útil em qualquer outro lugar. É a mesma lição do
                     `itms-apps://` da tela de assinatura. */
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(linha)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center rounded-full border border-border px-3 text-[13px] font-medium text-foreground"
                  >
                    Ver no mapa
                  </a>
                )}
                {a.phone && (
                  <a
                    href={`tel:${a.phone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-border px-3 text-[13px] font-medium text-foreground"
                  >
                    Ligar {a.phone}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
