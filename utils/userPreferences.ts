export type ToxinBrand = 'Botox' | 'Dysport' | 'Xeomin';
export type UnitSystem = 'allergan' | 'speywood';
export type DoseOption = 'min' | 'max';
export type AppLanguage = 'es' | 'en';

export interface UserPreferences {
  default_brand: ToxinBrand;
  unit_system: UnitSystem;
  default_dose_option: DoseOption;
  default_dilution: string;
  language: AppLanguage;
  dark_mode: boolean;
  font_size?: string;
  primary_color?: string;
  secondary_color?: string;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  default_brand: 'Botox',
  unit_system: 'allergan',
  default_dose_option: 'min',
  default_dilution: '2.5',
  language: 'es',
  dark_mode: false,
};

export const BRAND_LABELS: Record<ToxinBrand, string> = {
  Botox: 'Botox (Onabotulinumtoxina A)',
  Dysport: 'Dysport (Abobotulinumtoxina A)',
  Xeomin: 'Xeomin (Incobotulinumtoxina A)',
};

export const UNIT_SYSTEM_LABELS: Record<UnitSystem, string> = {
  allergan: 'Unidades Allergan',
  speywood: 'Unidades Speywood',
};

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  es: 'Español',
  en: 'English',
};

export const applyBrandColors = (primary?: string | null, secondary?: string | null) => {
  if (primary) document.documentElement.style.setProperty('--color-primary', primary);
  if (secondary) document.documentElement.style.setProperty('--color-secondary', secondary);
};

export const applyFontSize = (size?: string | null) => {
  document.body.classList.remove('font-small', 'font-large');
  if (size === 'small') document.body.classList.add('font-small');
  if (size === 'large') document.body.classList.add('font-large');
};

export const applyDarkMode = (enabled: boolean) => {
  if (enabled) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};
