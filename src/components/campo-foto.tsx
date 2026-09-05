/**
 * Foto do médico.
 *
 * Duas decisões que valem mais que o componente.
 *
 * **Redimensiona ANTES de enviar.** A câmera de um celular produz 4 MB; o card
 * mostra 48 pixels. Enviar o original gasta a franquia dele, demora no 4G do
 * consultório e não melhora nada — o navegador vai encolher a imagem de todo
 * jeito na hora de desenhar. 512px de lado e JPEG a 82% dão ~40 KB e cobrem até
 * telas retina.
 *
 * **Corta em quadrado, no centro.** O card é redondo. Sem cortar, uma foto
 * deitada vira uma faixa espremida e uma foto em pé corta a testa — e o médico
 * descobre isso quando a paciente já viu.
 */

import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const LADO = 512;

/** Lê o arquivo, corta no quadrado central e devolve um JPEG pequeno. */
async function prepararImagem(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const lado = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - lado) / 2;
    const sy = (bitmap.height - lado) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = LADO;
    canvas.height = LADO;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, LADO, LADO);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82));
  } catch {
    return null;
  }
}

export function CampoFoto({
  url,
  onChange,
  nome,
  classeLabel,
}: {
  url: string;
  onChange: (u: string) => void;
  /** Para a inicial, enquanto não há foto. */
  nome: string;
  classeLabel: string;
}) {
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inicial =
    nome
      .replace(/^(Dr|Dra)\.?\s*/i, "")
      .charAt(0)
      .toUpperCase() || "?";

  async function escolher(file: File) {
    setEnviando(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) {
        toast.error("Sua sessão expirou. Entre novamente.");
        return;
      }
      const blob = await prepararImagem(file);
      if (!blob) {
        toast.error("Não consegui ler essa imagem. Tente outra.");
        return;
      }
      /* Caminho `<uid>/foto.jpg`: a política do bucket confere o primeiro
         segmento contra o uid, então este nome é o que impede um médico de
         escrever na pasta de outro. `upsert` porque trocar a foto é o caso
         comum — sem ele, a segunda tentativa falharia com "já existe". */
      const caminho = `${uid}/foto.jpg`;
      const { error } = await supabase.storage
        .from("medicos")
        .upload(caminho, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) {
        toast.error(
          error.message.includes("Bucket not found")
            ? "Rode o APLICAR_MEDICO.sql — o espaço das fotos ainda não existe."
            : "Não foi possível enviar a foto agora.",
        );
        return;
      }
      const { data: pub } = supabase.storage.from("medicos").getPublicUrl(caminho);
      /* `?v=` com a hora: a URL é sempre a mesma, então sem isso o navegador
         (e o CDN) continuariam mostrando a foto antiga depois da troca. */
      onChange(`${pub.publicUrl}?v=${Date.now()}`);
      toast.success("Foto atualizada ✓");
    } catch {
      toast.error("Falha ao enviar a foto.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <label className={classeLabel}>Sua foto</label>
      <div className="mt-2 flex items-center gap-4">
        {url ? (
          <img
            src={url}
            alt="Sua foto"
            className="size-20 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
          />
        ) : (
          <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-primary/12 font-serif text-2xl text-primary ring-2 ring-primary/20">
            {inicial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // Zera o input: escolher o MESMO arquivo de novo não dispararia
              // `change` sem isto, e trocar por engano viraria "não funciona".
              e.target.value = "";
              if (f) void escolher(f);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={enviando}
              onClick={() => inputRef.current?.click()}
              className="rounded-full border border-primary/40 px-4 py-2 text-sm font-medium text-primary disabled:opacity-50"
            >
              {enviando ? "Enviando…" : url ? "Trocar foto" : "Escolher foto"}
            </button>
            {url && !enviando && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground"
              >
                Remover
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
            Um rosto é a maior diferença entre dois cards. A imagem é cortada em quadrado e reduzida
            no seu aparelho — não gasta seus dados.
          </p>
        </div>
      </div>
    </div>
  );
}
