import { Settings } from "luxon";

export const DEFAULT_TIMEZONE = "Europe/Moscow";

let currentTimezone: string = DEFAULT_TIMEZONE;

export function initializeTimezone(timezone: string): void {
  currentTimezone = timezone;
  Settings.defaultZone = timezone;
}

export function getTimezone(): string {
  return currentTimezone;
}
