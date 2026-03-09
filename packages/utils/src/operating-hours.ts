import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type DayHours = {
  open: string; // "HH:mm"
  close: string; // "HH:mm"
  isOpen: boolean;
};

type OperatingHours = Record<string, DayHours>;

const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/**
 * Verifica se o restaurante está aberto agora.
 */
export function isRestaurantOpen(
  operatingHours: OperatingHours | null | undefined,
  now: Date = new Date()
): boolean {
  if (!operatingHours) return false;

  const dayName = DAYS[now.getDay()];
  if (!dayName) return false;

  const dayConfig = operatingHours[dayName];
  if (!dayConfig || !dayConfig.isOpen) return false;

  const currentTime = format(now, "HH:mm");
  return currentTime >= dayConfig.open && currentTime <= dayConfig.close;
}

/**
 * Retorna o próximo horário de abertura.
 */
export function getNextOpenTime(
  operatingHours: OperatingHours | null | undefined,
  now: Date = new Date()
): string | null {
  if (!operatingHours) return null;

  const dayName = DAYS[now.getDay()];
  if (!dayName) return null;

  const todayConfig = operatingHours[dayName];
  if (todayConfig?.isOpen) {
    const currentTime = format(now, "HH:mm");
    if (currentTime < todayConfig.open) {
      return `Abre hoje às ${todayConfig.open}`;
    }
  }

  // Procura o próximo dia aberto
  for (let i = 1; i <= 7; i++) {
    const nextDayIndex = (now.getDay() + i) % 7;
    const nextDayName = DAYS[nextDayIndex];
    if (!nextDayName) continue;

    const nextConfig = operatingHours[nextDayName];
    if (nextConfig?.isOpen) {
      const dayLabel =
        i === 1
          ? "amanhã"
          : format(
              new Date(now.getTime() + i * 86400000),
              "EEEE",
              { locale: ptBR }
            );
      return `Abre ${dayLabel} às ${nextConfig.open}`;
    }
  }

  return null;
}
