/**
 * Value formatting for cells.
 *
 * A cell stores a raw entry (a literal or a formula). HyperFormula turns that
 * into a computed value. This module turns the computed value into the string
 * the user sees, according to the cell's chosen format and the workbook's
 * format settings.
 *
 * @module engine/formats
 */

/** The formats a user can pick from the toolbar. */
export const CELL_FORMATS = [
  { id: 'auto', label: 'Automatic' },
  { id: 'string', label: 'Text' },
  { id: 'number', label: 'Number' },
  { id: 'currency', label: 'Currency' },
  { id: 'percent', label: 'Percentage' },
  { id: 'date', label: 'Date' },
  { id: 'time', label: 'Time' },
  { id: 'datetime', label: 'Date and time' },
];

/** Formats for which the thousands separator and decimal place controls apply. */
export const NUMERIC_FORMATS = new Set(['number', 'currency', 'percent']);

/** Default workbook format settings. */
export const DEFAULT_SETTINGS = {
  dateFormat: 'dd/MM/yyyy',
  timeFormat: 'HH:mm:ss',
  dateTimeFormat: 'dd/MM/yyyy HH:mm:ss',
  currencySymbol: '£',
  currencyDecimals: 2,
};

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

/**
 * Convert an Excel style serial number to a JS Date (UTC based).
 *
 * @param {number} serial
 * @returns {Date}
 */
export function serialToDate(serial) {
  return new Date(EXCEL_EPOCH_UTC + Math.round(serial * 86400000));
}

/**
 * Convert a JS Date to an Excel style serial number.
 *
 * @param {Date} date
 * @returns {number}
 */
export function dateToSerial(date) {
  return (date.getTime() - EXCEL_EPOCH_UTC) / 86400000;
}

const pad = (n, len = 2) => String(n).padStart(len, '0');

/**
 * Format a Date with a small subset of the usual tokens:
 * yyyy yy MM M dd d HH H hh h mm m ss s tt
 *
 * @param {Date} d Date whose UTC parts are read.
 * @param {string} pattern
 * @returns {string}
 */
export function formatDate(d, pattern) {
  const hours24 = d.getUTCHours();
  const hours12 = hours24 % 12 || 12;
  const map = {
    yyyy: d.getUTCFullYear(),
    yy: pad(d.getUTCFullYear() % 100),
    MM: pad(d.getUTCMonth() + 1),
    M: d.getUTCMonth() + 1,
    dd: pad(d.getUTCDate()),
    d: d.getUTCDate(),
    HH: pad(hours24),
    H: hours24,
    hh: pad(hours12),
    h: hours12,
    mm: pad(d.getUTCMinutes()),
    m: d.getUTCMinutes(),
    ss: pad(d.getUTCSeconds()),
    s: d.getUTCSeconds(),
    tt: hours24 < 12 ? 'AM' : 'PM',
  };
  return pattern.replace(/yyyy|yy|MM|M|dd|d|HH|H|hh|h|mm|m|ss|s|tt/g, (t) => String(map[t]));
}

/** Cache of Intl.NumberFormat instances keyed by decimal places. */
const numberFormatters = new Map();

/**
 * Get (and cache) an Intl.NumberFormat for a given fixed decimal count, or
 * `null` for "general" formatting.
 *
 * @param {number | null} decimals
 * @returns {Intl.NumberFormat}
 */
function numberFormatter(decimals, grouping) {
  const key = `${decimals == null ? 'g' : decimals}:${grouping ? 1 : 0}`;
  let fmt = numberFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-GB', {
      useGrouping: grouping !== false,
      ...(decimals == null
        ? { maximumFractionDigits: 10 }
        : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    });
    numberFormatters.set(key, fmt);
  }
  return fmt;
}

/**
 * Format a number with an optional fixed number of decimals and grouping.
 *
 * @param {number} value
 * @param {number | null} decimals
 * @param {boolean} [grouping=true] Whether to show the thousands separator.
 * @returns {string}
 */
export function formatNumber(value, decimals, grouping = true) {
  return numberFormatter(decimals, grouping).format(value);
}

/**
 * Turn a computed value into a display string.
 *
 * @param {*} value Computed value from HyperFormula (number, string, boolean,
 *   null, or a DetailedCellError like object with a `value` property).
 * @param {Object} [opts]
 * @param {string} [opts.format] One of CELL_FORMATS ids. Defaults to 'auto'.
 * @param {number|null} [opts.decimals] Fixed decimal places for number/currency.
 * @param {boolean} [opts.grouping] Show the thousands separator (default true).
 * @param {Object} [opts.settings] Workbook format settings.
 * @param {string} [opts.raw] The raw cell entry, used for date detection in auto mode.
 * @returns {string}
 */
export function formatValue(value, opts = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...(opts.settings || {}) };
  const format = opts.format || 'auto';
  const grouping = opts.grouping !== false;

  if (value === null || value === undefined || value === '') {
    return '';
  }
  // HyperFormula error object.
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return String(value.value);
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  switch (format) {
    case 'string':
      return String(value);

    case 'number':
      return typeof value === 'number'
        ? formatNumber(value, opts.decimals ?? null, grouping)
        : String(value);

    case 'currency': {
      if (typeof value !== 'number') {
        return String(value);
      }
      const dp = opts.decimals ?? settings.currencyDecimals ?? 2;
      const sign = value < 0 ? '-' : '';
      return `${sign}${settings.currencySymbol}${formatNumber(Math.abs(value), dp, grouping)}`;
    }

    case 'percent': {
      if (typeof value !== 'number') {
        return String(value);
      }
      const dp = opts.decimals ?? 0;
      return `${formatNumber(value * 100, dp, grouping)}%`;
    }

    case 'date':
      return typeof value === 'number'
        ? formatDate(serialToDate(value), settings.dateFormat)
        : String(value);

    case 'time':
      return typeof value === 'number'
        ? formatDate(serialToDate(value), settings.timeFormat)
        : String(value);

    case 'datetime':
      return typeof value === 'number'
        ? formatDate(serialToDate(value), settings.dateTimeFormat)
        : String(value);

    case 'auto':
    default: {
      if (typeof value === 'number') {
        // If the raw entry looked like a date, show it as one.
        const raw = (opts.raw || '').trim();
        if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) {
          return formatDate(serialToDate(value), settings.dateFormat);
        }
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) {
          return formatDate(serialToDate(value), settings.timeFormat);
        }
        return formatNumber(value, null, grouping);
      }
      return String(value);
    }
  }
}
