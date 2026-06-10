import { MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "5531986342903";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Olá, Dr. Clóvis! Vim pelo site e gostaria de mais informações.",
);

export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;
export const WHATSAPP_DISPLAY = "(31) 98634-2903";

export function WhatsAppFloating() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conversar no WhatsApp"
      className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-medium text-white shadow-lg transition-transform hover:-translate-y-0.5"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
