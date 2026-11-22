export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  colorClass: string;
  barClass: string;
  checks: {
    minLength: boolean;
    hasLetter: boolean;
    hasNumber: boolean;
    hasUpperOrSymbol: boolean;
  };
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    minLength: password.length >= 8,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasUpperOrSymbol: /[A-Z]/.test(password) || /[^a-zA-Z0-9]/.test(password),
  };

  if (!password) {
    return {
      score: 0,
      label: '',
      colorClass: 'text-slate-400',
      barClass: 'bg-slate-200 dark:bg-slate-700',
      checks,
    };
  }

  let score = 0;
  if (checks.minLength) score += 1;
  if (checks.hasLetter && checks.hasNumber) score += 1;
  if (checks.hasUpperOrSymbol) score += 1;
  if (password.length >= 12) score += 1;

  if (score <= 1) {
    return {
      score: 1,
      label: 'Débil',
      colorClass: 'text-red-600 dark:text-red-400',
      barClass: 'bg-red-500',
      checks,
    };
  }
  if (score === 2) {
    return {
      score: 2,
      label: 'Aceptable',
      colorClass: 'text-amber-600 dark:text-amber-400',
      barClass: 'bg-amber-500',
      checks,
    };
  }
  if (score === 3) {
    return {
      score: 3,
      label: 'Buena',
      colorClass: 'text-sky-600 dark:text-sky-400',
      barClass: 'bg-sky-500',
      checks,
    };
  }
  return {
    score: 4,
    label: 'Segura',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    barClass: 'bg-emerald-500',
    checks,
  };
}

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export interface TranslatedAuthError {
  message: string;
  code?: 'email_not_confirmed' | 'already_registered' | 'invalid_credentials' | 'rate_limit' | 'generic';
}

export function translateAuthError(rawMessage?: string | null): TranslatedAuthError {
  const msg = (rawMessage || '').trim();
  const lower = msg.toLowerCase();

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return {
      code: 'invalid_credentials',
      message: 'Correo o contraseña incorrectos. Verifica tus datos o restablece tu contraseña.',
    };
  }
  if (lower.includes('email not confirmed')) {
    return {
      code: 'email_not_confirmed',
      message: 'Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada o reenvía el enlace de activación.',
    };
  }
  if (
    lower.includes('user already registered') ||
    lower.includes('already been registered') ||
    lower.includes('already exists')
  ) {
    return {
      code: 'already_registered',
      message: 'Ya existe una cuenta registrada con este correo electrónico. Inicia sesión para continuar.',
    };
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('for security purposes')) {
    return {
      code: 'rate_limit',
      message: 'Demasiados intentos en poco tiempo. Espera unos segundos antes de volver a intentarlo.',
    };
  }
  if (lower.includes('password should be at least')) {
    return {
      code: 'generic',
      message: 'La contraseña debe tener al menos 8 caracteres.',
    };
  }
  if (lower.includes('unable to validate email address') || lower.includes('invalid email')) {
    return {
      code: 'generic',
      message: 'Ingresa un correo electrónico válido (ejemplo: doctor@clinica.com).',
    };
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return {
      code: 'generic',
      message: 'No pudimos conectar con el servidor. Revisa tu conexión a internet e intenta de nuevo.',
    };
  }

  return {
    code: 'generic',
    message: msg || 'Ocurrió un error al procesar tu solicitud. Intenta nuevamente.',
  };
}
