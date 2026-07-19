import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isAfter } from "date-fns";
import { enUS, es, ptBR } from "date-fns/locale";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFnsLocales = { es, en: enUS, "pt-BR": ptBR } satisfies Record<Locale, typeof es>;

export function formatDate(date: Date | string, fmt = "dd/MM/yyyy", locale: Locale = DEFAULT_LOCALE) {
  return format(new Date(date), fmt, { locale: dateFnsLocales[locale] });
}

export function timeAgo(date: Date | string, locale: Locale = DEFAULT_LOCALE) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: dateFnsLocales[locale] });
}

export function isOverdue(date: Date | string) {
  return isAfter(new Date(), new Date(date));
}

export function riskScore(probability: number, impact: number) {
  return probability * impact;
}

export function riskLevel(score: number): "critical" | "high" | "medium" | "low" {
  if (score >= 15) return "critical";
  if (score >= 8) return "high";
  if (score >= 4) return "medium";
  return "low";
}

export function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function generateCode(prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}
