import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isThisWeek, isSaturday, nextSaturday } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export function formatTripDate(date: Date | string | undefined | null): string {
  if (!date) return "This Saturday";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "This Saturday";
  return format(d, "EEEE, MMMM d, yyyy");
}

export function getThisSaturday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (isSaturday(today)) return today;
  return nextSaturday(today);
}

export function formatSaturday(date: Date): string {
  return format(date, "MMM d, yyyy");
}

// Simple admin passcode check (replace with proper auth in production)
export const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || "baps2024";

export function isValidAdminCode(code: string): boolean {
  return code === ADMIN_PASSCODE;
}
