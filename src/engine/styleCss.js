/**
 * Turn a style patch (bg, color, bold, italic, underline, font, size, align)
 * into a React inline style object.
 *
 * Per cell colours and fonts are genuinely dynamic (the user picks any hex
 * value or family), so they cannot live in the stylesheet. This is the one
 * place the app builds inline styles.
 *
 * @module engine/styleCss
 */

import { fontStack } from './fonts.js';

/**
 * @param {Object} style Merged style patch.
 * @returns {import('react').CSSProperties}
 */
export function styleToCss(style) {
  if (!style) {
    return {};
  }
  const css = {};
  if (style.bg) {
    css.backgroundColor = style.bg;
  }
  if (style.color) {
    css.color = style.color;
  }
  if (style.bold) {
    css.fontWeight = 'bold';
  }
  if (style.italic) {
    css.fontStyle = 'italic';
  }
  if (style.underline) {
    css.textDecoration = 'underline';
  }
  if (style.font) {
    css.fontFamily = fontStack(style.font);
  }
  if (style.size) {
    css.fontSize = `${style.size}px`;
  }
  if (style.align) {
    css.textAlign = style.align;
    css.justifyContent =
      style.align === 'right' ? 'flex-end' : style.align === 'center' ? 'center' : 'flex-start';
  }
  if (style.valign) {
    css.alignItems =
      style.valign === 'top' ? 'flex-start' : style.valign === 'bottom' ? 'flex-end' : 'center';
  }
  if (style.border) {
    const line = `1px solid ${style.bc || '#7a7a7a'}`;
    if (style.border.includes('t')) {
      css.borderTop = line;
    }
    if (style.border.includes('r')) {
      css.borderRight = line;
    }
    if (style.border.includes('b')) {
      css.borderBottom = line;
    }
    if (style.border.includes('l')) {
      css.borderLeft = line;
    }
  }
  return css;
}
