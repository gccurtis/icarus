// CanonicalRational — exact bigint arithmetic.
// Denominator is always positive and coprime with the numerator.
// Zero is always { numerator: 0n, denominator: 1n }.

export interface CanonicalRational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

export function makeRational(n: bigint, d: bigint): CanonicalRational {
  if (d === 0n) throw new RangeError("rational: denominator is zero");
  if (n === 0n) return ZERO;
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n < 0n ? -n : n, d);
  return { numerator: n / g, denominator: d / g };
}

export const ZERO: CanonicalRational = { numerator: 0n, denominator: 1n };
export const ONE: CanonicalRational = { numerator: 1n, denominator: 1n };

export function fromInt(n: bigint): CanonicalRational {
  return n === 0n ? ZERO : n === 1n ? ONE : { numerator: n, denominator: 1n };
}

/** Parse a decimal string like "3", "-0.5", "1.25". */
export function fromDecimalString(s: string): CanonicalRational {
  const dot = s.indexOf(".");
  if (dot === -1) return makeRational(BigInt(s), 1n);
  const intPart = s.slice(0, dot) || "0";
  const fracPart = s.slice(dot + 1);
  if (fracPart.length === 0) return makeRational(BigInt(intPart), 1n);
  const denom = 10n ** BigInt(fracPart.length);
  const negative = intPart.startsWith("-");
  const absInt = BigInt(negative ? intPart.slice(1) : intPart);
  const numer = negative
    ? -(absInt * denom + BigInt(fracPart))
    : absInt * denom + BigInt(fracPart);
  return makeRational(numer, denom);
}

export function toDecimalString(r: CanonicalRational, places: number): string {
  const neg = r.numerator < 0n;
  const absN = neg ? -r.numerator : r.numerator;
  const intPart = absN / r.denominator;
  const rem = absN % r.denominator;
  if (places === 0 || rem === 0n) return (neg ? "-" : "") + intPart.toString();
  const scale = 10n ** BigInt(places);
  const fracDigits = ((rem * scale) / r.denominator).toString().padStart(places, "0");
  const trimmed = fracDigits.replace(/0+$/, "");
  return (neg ? "-" : "") + intPart.toString() + (trimmed ? "." + trimmed : "");
}

export function add(a: CanonicalRational, b: CanonicalRational): CanonicalRational {
  return makeRational(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
}

export function sub(a: CanonicalRational, b: CanonicalRational): CanonicalRational {
  return makeRational(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator);
}

export function mul(a: CanonicalRational, b: CanonicalRational): CanonicalRational {
  return makeRational(a.numerator * b.numerator, a.denominator * b.denominator);
}

export function div(a: CanonicalRational, b: CanonicalRational): CanonicalRational {
  if (b.numerator === 0n) throw new RangeError("rational: divide by zero");
  return makeRational(a.numerator * b.denominator, a.denominator * b.numerator);
}

export function mod(a: CanonicalRational, b: CanonicalRational): CanonicalRational {
  if (b.numerator === 0n) throw new RangeError("rational: mod by zero");
  const q = makeRational(a.numerator * b.denominator, a.denominator * b.numerator);
  const qFloor = floorR(q);
  return sub(a, mul(b, qFloor));
}

export function negate(r: CanonicalRational): CanonicalRational {
  return r.numerator === 0n ? ZERO : { numerator: -r.numerator, denominator: r.denominator };
}

export function absR(r: CanonicalRational): CanonicalRational {
  return r.numerator < 0n ? { numerator: -r.numerator, denominator: r.denominator } : r;
}

export function compare(a: CanonicalRational, b: CanonicalRational): -1 | 0 | 1 {
  const diff = a.numerator * b.denominator - b.numerator * a.denominator;
  if (diff < 0n) return -1;
  if (diff > 0n) return 1;
  return 0;
}

export function eq(a: CanonicalRational, b: CanonicalRational): boolean {
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

export function isZero(r: CanonicalRational): boolean {
  return r.numerator === 0n;
}

export function isInteger(r: CanonicalRational): boolean {
  return r.denominator === 1n;
}

export function floorR(r: CanonicalRational): CanonicalRational {
  const q = r.numerator / r.denominator;
  if (r.numerator < 0n && r.numerator % r.denominator !== 0n) return fromInt(q - 1n);
  return fromInt(q);
}

export function ceilR(r: CanonicalRational): CanonicalRational {
  const q = r.numerator / r.denominator;
  if (r.numerator > 0n && r.numerator % r.denominator !== 0n) return fromInt(q + 1n);
  return fromInt(q);
}

export function roundR(r: CanonicalRational, places: number): CanonicalRational {
  const scale = 10n ** BigInt(places);
  const scaled = makeRational(r.numerator * scale, r.denominator);
  const fv = floorR(scaled);
  const rem = sub(scaled, fv);
  const half: CanonicalRational = { numerator: 1n, denominator: 2n };
  const rounded = compare(rem, half) >= 0 ? add(fv, ONE) : fv;
  return makeRational(rounded.numerator, scale);
}

export function powR(base: CanonicalRational, exp: CanonicalRational): CanonicalRational {
  if (!isInteger(exp)) throw new RangeError("rational: non-integer exponent");
  const e = exp.numerator;
  if (e === 0n) return ONE;
  if (e < 0n) {
    if (isZero(base)) throw new RangeError("rational: divide by zero");
    const p = powR(base, fromInt(-e));
    return makeRational(p.denominator, p.numerator);
  }
  return makeRational(base.numerator ** e, base.denominator ** e);
}

/** Wire form — strings for JSON safety. */
export interface RationalWire {
  readonly numerator: string;
  readonly denominator: string;
}

export function toWire(r: CanonicalRational): RationalWire {
  return { numerator: r.numerator.toString(), denominator: r.denominator.toString() };
}

export function fromWire(w: RationalWire): CanonicalRational {
  return makeRational(BigInt(w.numerator), BigInt(w.denominator));
}
