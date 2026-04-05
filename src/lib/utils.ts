import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isAfter } from "date-fns";
import { es } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, fmt = "dd/MM/yyyy") {
  return format(new Date(date), fmt, { locale: es });
}

export function timeAgo(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
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
