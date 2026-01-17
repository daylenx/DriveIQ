import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  ACTIVE_VEHICLE_ID: '@driveiq/active_vehicle_id',
  THEME_MODE: '@driveiq/theme_mode',
  SHOW_TIPS: '@driveiq/show_tips',
};

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export async function getActiveVehicleId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_VEHICLE_ID);
  } catch {
    return null;
  }
}

export async function setActiveVehicleId(vehicleId: string | null): Promise<void> {
  if (vehicleId) {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_VEHICLE_ID, vehicleId);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_VEHICLE_ID);
  }
}

export async function getThemeMode(): Promise<'light' | 'dark' | 'pink' | null> {
  try {
    const mode = await AsyncStorage.getItem(STORAGE_KEYS.THEME_MODE);
    return mode as 'light' | 'dark' | 'pink' | null;
  } catch {
    return null;
  }
}

export async function setThemeMode(mode: 'light' | 'dark' | 'pink'): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.THEME_MODE, mode);
}

export async function getShowTips(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.SHOW_TIPS);
    return value !== 'false';
  } catch {
    return true;
  }
}

export async function setShowTips(show: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.SHOW_TIPS, show.toString());
}

export function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatMiles(miles: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(miles));
}
