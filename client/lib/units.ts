import { OdometerUnit } from '@/types';

const MI_TO_KM = 1.60934;
const KM_TO_MI = 0.621371;

export const ODOMETER_JUMP_THRESHOLD = 5000;

export function convertOdometer(value: number, from: OdometerUnit, to: OdometerUnit): number {
  if (from === to) return value;
  if (from === 'mi' && to === 'km') {
    return Math.round(value * MI_TO_KM);
  }
  return Math.round(value * KM_TO_MI);
}

export function formatOdometer(value: number, unit: OdometerUnit): string {
  return `${value.toLocaleString()} ${unit}`;
}

export function getUnitLabel(unit: OdometerUnit): string {
  return unit === 'mi' ? 'miles' : 'kilometers';
}

export function getUnitShort(unit: OdometerUnit): string {
  return unit;
}
