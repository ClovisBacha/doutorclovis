import { Link } from "@tanstack/react-router";
import { Phone, Mail, MapPin, Instagram } from "lucide-react";
import { DOCTOR } from "@/lib/doctor.config";
import logo from "@/assets/logo-obstetrica.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-secondary/40 pb-[72px] md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-4">
        {/* Brand */}
        <div className="md:col-span-1">
          <img
            src={logo}
            alt="Obstétrica — Excelência no atendimento à gestante"
            className="h-9 w-auto"
          />
          <p className="mt-2 text-xs text-muted-foreground">o app da sua gestação</p>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Acompanhamento semana a semana, com o cuidado do seu médico — do positivo ao pós-parto.
          </p>
          <a
            href={DOCTOR.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Instagram className="h-3.5 w-3.5" />{" "}
            {`@${DOCTOR.instagram.replace(/\/$/, "").split("/").pop()}`}
          </a>
        </div>

        {/* Contato */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Contato
          </p>
          <ul className="mt-3 space-y-2 text-sm text-foreground">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 flex-shrink-0 text-primary" />
              <a
                href={DOCTOR.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                {DOCTOR.whatsappDisplay}{" "}
                <span className="text-xs text-muted-foreground">(WhatsApp)</span>
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <div className="min-w-0">
                <a
                  href={`mailto:${DOCTOR.supportEmail}`}
                  className="hover:text-primary transition-colors"
                >
                  {DOCTOR.supportEmail}
                </a>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">
                  Suporte: comece pelo <strong>chat do app</strong> (na hora); se precisar, e-mail
                  com resposta em até 1 dia útil.
                </p>
              </div>
            </li>
            {DOCTOR.address && (
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                <span>{DOCTOR.address}</span>
              </li>
            )}
          </ul>
        </div>

        {/* Navegação */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            App
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                to="/auth"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Entrar / Criar conta
              </Link>
            </li>
            <li>
              <Link
                to="/agendamento"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Agendar consulta
              </Link>
            </li>
            <li>
              <Link
                to="/gestacao"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Gestação semana a semana
              </Link>
            </li>
            <li>
              <Link
                to="/calculadora"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Calculadora gestacional
              </Link>
            </li>
            <li>
              <Link
                to="/experiencia"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Experiência 3D
              </Link>
            </li>
            <li>
              <Link
                to="/empresas"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Para empresas
              </Link>
            </li>
          </ul>
        </div>

        {/* Sobre */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Institucional
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                to="/sobre"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Sobre nós — nossa história
              </Link>
            </li>
            <li>
              <Link
                to="/hospitais"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Hospitais de atendimento
              </Link>
            </li>
            <li>
              <Link
                to="/lives"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Lives e conteúdo
              </Link>
            </li>
            <li>
              <Link
                to="/depoimentos"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Depoimentos
              </Link>
            </li>
            <li>
              <Link
                to="/bastidores"
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                Gestação de alto risco
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* LGPD + copyright */}
      <div className="border-t border-border/60 px-5 py-5">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <p>© {new Date().getFullYear()} Obstétrica · Todos os direitos reservados</p>
          <p className="max-w-sm">
            Os dados inseridos no app são protegidos pela <strong>LGPD (Lei 13.709/2018)</strong> e
            utilizados exclusivamente para acompanhamento de saúde. Não compartilhamos informações
            com terceiros.{" "}
            <Link to="/privacidade" className="underline hover:text-primary transition-colors">
              Política de Privacidade
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
