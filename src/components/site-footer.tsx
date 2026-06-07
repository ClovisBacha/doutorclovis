import { Link } from "@tanstack/react-router";
import { Phone, Mail, MapPin } from "lucide-react";
import { WHATSAPP_URL, WHATSAPP_DISPLAY } from "@/components/whatsapp-button";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-secondary/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-3">
        <div>
          <p className="font-serif text-2xl text-primary">Dr. Clóvis Bacha</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Ginecologia, obstetrícia e gestação de alto risco com cuidado humanizado.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Contato
          </p>
          <ul className="mt-3 space-y-2 text-sm text-foreground">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                {WHATSAPP_DISPLAY} (WhatsApp)
              </a>
            </li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> contato@drclovisbacha.com</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Rua exemplo, 000 — sua cidade</li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Navegação</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link to="/sobre" className="hover:text-primary">Sobre o doutor</Link></li>
            <li><Link to="/bastidores" className="hover:text-primary">Gestação de alto risco</Link></li>
            <li><Link to="/depoimentos" className="hover:text-primary">Depoimentos</Link></li>
            <li><Link to="/agendamento" className="hover:text-primary">Agendar consulta</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Dr. Clóvis Bacha · CRM 00000-00 · Todos os direitos reservados
      </div>
    </footer>
  );
}