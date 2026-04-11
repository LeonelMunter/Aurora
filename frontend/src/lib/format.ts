const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const EMPTY_VALUE = '-';

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return EMPTY_VALUE;
  }

  return currencyFormatter.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return EMPTY_VALUE;
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${percentFormatter.format(value)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return EMPTY_VALUE;
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return EMPTY_VALUE;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return EMPTY_VALUE;
  }

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatDateInput(value: string | Date | null | undefined): string {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) {
    return EMPTY_VALUE;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return EMPTY_VALUE;
  }

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);

  if (absMs >= 86400000) {
    return formatDate(date);
  }

  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['hour', 3600000],
    ['minute', 60000],
    ['second', 1000],
  ];

  for (const [unit, size] of units) {
    if (absMs >= size || unit === 'second') {
      return rtf.format(Math.round(diffMs / size), unit);
    }
  }

  return formatDate(date);
}

export function normalizeNullable(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return EMPTY_VALUE;
  }

  return String(value);
}

export function normalizeLatinText(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  let next = value
    .replace(/ï¿½/g, '-')
    .replace(/â€”/g, '—')
    .replace(/â€“/g, '–')
    .replace(/â€œ/g, '“')
    .replace(/â€/g, '”')
    .replace(/â€˜/g, '‘')
    .replace(/â€™/g, '’')
    .replace(/Â/g, '');

  if (/[Ãâ]/.test(next)) {
    try {
      const bytes = Uint8Array.from(Array.from(next).map((char) => char.charCodeAt(0) & 0xff));
      const decoded = new TextDecoder('utf-8').decode(bytes);
      if (decoded && decoded !== next) {
        next = decoded;
      }
    } catch {
      // noop
    }
  }

  return next.replace(/\uFFFD/g, '');
}
