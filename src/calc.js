/**
 * Pure, dependency-free calculator logic (unit-tested, no I/O).
 *
 * Supports + - * / % ^, parentheses, decimals, the constants pi/e, and the
 * functions sqrt sin cos tan asin acos atan abs log (base 10) ln round ceil
 * floor. Identifiers are mapped in a single pass against an allow-list, so an
 * unknown word is rejected instead of being evaluated.
 */
const IDENTS = {
  sqrt: 'M.sqrt',
  sin: 'M.sin',
  cos: 'M.cos',
  tan: 'M.tan',
  asin: 'M.asin',
  acos: 'M.acos',
  atan: 'M.atan',
  abs: 'M.abs',
  round: 'M.round',
  ceil: 'M.ceil',
  floor: 'M.floor',
  log: 'M.log10',
  ln: 'M.log',
  pi: 'M.PI',
  e: 'M.E',
};

const MAX_LEN = 200;

export function evaluateExpression(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error('empty expression');
  }
  if (input.length > MAX_LEN) throw new Error('expression too long (max ' + MAX_LEN + ')');
  if (input.includes('!')) throw new Error('factorial (!) is not supported');

  let expr = input
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\u00f7/g, '/')   // division sign
    .replace(/\u00d7/g, '*')   // multiplication sign
    .replace(/\u03c0/g, 'pi')  // greek pi
    .replace(/\^/g, '**');

  // Only digits, operators, parens, dot and letters may remain at this point.
  if (!/^[0-9a-z+\-*/%().]*$/.test(expr)) {
    throw new Error('invalid characters in expression');
  }

  // Replace identifiers longest-first so "asin" is not mangled by "sin".
  const names = Object.keys(IDENTS).sort((a, b) => b.length - a.length);
  for (const name of names) {
    expr = expr.replace(new RegExp('\\b' + name + '\\b', 'g'), IDENTS[name]);
  }

  // After substitution, only digits/ops/parens/dot and "M.<fn>" may remain.
  const stripped = expr.replace(/M\.(PI|E|sqrt|sin|cos|tan|asin|acos|atan|abs|round|ceil|floor|log10|log)/g, '');
  if (!/^[0-9+\-*/%().]*$/.test(stripped)) {
    throw new Error('unknown identifier in expression');
  }

  let result;
  try {
    // eslint-disable-next-line no-new-func
    result = Function('M', '"use strict"; return (' + expr + ');')(Math);
  } catch (e) {
    throw new Error('could not evaluate expression');
  }
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('result is undefined or infinite');
  }
  return result;
}

export function formatResult(n) {
  if (Number.isInteger(n)) return String(n);
  return Number(n.toFixed(6)).toString();
}

export default { evaluateExpression, formatResult };
