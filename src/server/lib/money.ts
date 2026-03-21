import { Decimal } from 'decimal.js';

export const MONEY_PRECISION = new Decimal(0.01);

export const decimalOf = (value: Decimal.Value | null | undefined): Decimal =>
  new Decimal(value ?? 0);

export const roundMoney = (value: Decimal.Value): Decimal =>
  decimalOf(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const moneyNumber = (value: Decimal.Value): number => roundMoney(value).toNumber();

export const percentage = (value: Decimal.Value): Decimal =>
  decimalOf(value).div(100);

export const clamp = (value: Decimal.Value, min: Decimal.Value, max: Decimal.Value): Decimal =>
  Decimal.max(decimalOf(min), Decimal.min(decimalOf(max), decimalOf(value)));

export const safeRatio = (numerator: Decimal.Value, denominator: Decimal.Value): Decimal => {
  const denominatorDecimal = decimalOf(denominator);
  if (denominatorDecimal.isZero()) return new Decimal(0);
  return decimalOf(numerator).div(denominatorDecimal);
};
