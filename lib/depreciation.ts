import { Asset, DepreciationMethod, DepreciationRateRule, DepreciationRateType } from '../types';
import { today } from './format';

export interface DepreciationRow {
  year: number;
  label: string;
  openingValue: number;
  charge: number;
  closingValue: number;
}

export interface DepreciationSummary {
  cost: number;
  salvageValue: number;
  monthsInService: number;
  accumulated: number;
  netBookValue: number;
  annualCharge: number;
  percentDepreciated: number;
  schedule: DepreciationRow[];
}

const monthsElapsed = (from: string, to: string): number => {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, months + (end.getDate() >= start.getDate() ? 0 : -1));
};

/**
 * Looks up the centrally-managed rate override for an asset's category, if any (see the
 * Depreciation Rate Master section of the Settings page). Returns undefined when the asset's
 * category has no override row for the requested basis, in which case the asset's own stored
 * fields are used as-is. Defaults to Companies Act, the basis that drives book Net Book Value
 * everywhere outside the Reports page's separate Income Tax column. Rows saved before the
 * Companies Act / Income Tax split (no `rateType` stored) are treated as Companies Act.
 */
export const findDepreciationOverride = (
  categoryId: string | undefined,
  overrides: DepreciationRateRule[] | undefined,
  rateType: DepreciationRateType = DepreciationRateType.CompaniesAct,
): DepreciationRateRule | undefined =>
  categoryId
    ? overrides?.find(o => o.categoryId === categoryId && (o.rateType || DepreciationRateType.CompaniesAct) === rateType)
    : undefined;

/**
 * Book value of an asset as on a date. SLM spreads the depreciable amount
 * evenly; WDV applies a rate derived from cost, salvage value and useful life.
 *
 * `overrides` is the optional, centrally-managed Depreciation Rate Master (see Settings page):
 * when the asset's category has a row there, its method/usefulLifeYears/salvageValuePct win over
 * whatever is stored on the individual asset record, so a single admin update retroactively
 * re-prices every asset in that category instead of needing each asset re-saved by hand.
 */
export const computeDepreciation = (
  asset: Asset,
  asOf: string = today(),
  overrides?: DepreciationRateRule[],
  rateType: DepreciationRateType = DepreciationRateType.CompaniesAct,
): DepreciationSummary => {
  const override = findDepreciationOverride(asset.categoryId, overrides, rateType);
  const depreciationMethod = override?.method ?? asset.depreciationMethod;
  const usefulLifeYears = override?.usefulLifeYears ?? asset.usefulLifeYears;
  const salvageValuePct = override?.salvageValuePct ?? asset.salvageValuePct;

  const cost = asset.purchaseCost || 0;
  const salvageValue = (cost * (salvageValuePct || 0)) / 100;
  const life = Math.max(1, usefulLifeYears || 1);
  const start = asset.capitalizedOn || asset.purchaseDate;
  const months = Math.min(monthsElapsed(start, asOf), life * 12);
  const schedule: DepreciationRow[] = [];

  if (depreciationMethod === DepreciationMethod.None) {
    return {
      cost,
      salvageValue,
      monthsInService: monthsElapsed(start, asOf),
      accumulated: 0,
      netBookValue: cost,
      annualCharge: 0,
      percentDepreciated: 0,
      schedule,
    };
  }

  const startYear = new Date(start).getFullYear();
  let accumulated = 0;
  let annualCharge = 0;

  if (depreciationMethod === DepreciationMethod.WDV) {
    const rate = salvageValue > 0 && cost > 0 ? 1 - Math.pow(salvageValue / cost, 1 / life) : 1 - Math.pow(0.05, 1 / life);
    let opening = cost;
    for (let year = 0; year < life; year += 1) {
      const charge = opening * rate;
      schedule.push({
        year: startYear + year,
        label: `Year ${year + 1}`,
        openingValue: opening,
        charge,
        closingValue: opening - charge,
      });
      opening -= charge;
    }
    const fullYears = Math.floor(months / 12);
    const partMonths = months % 12;
    accumulated = schedule.slice(0, fullYears).reduce((total, row) => total + row.charge, 0);
    if (partMonths > 0 && schedule[fullYears]) {
      accumulated += (schedule[fullYears].charge * partMonths) / 12;
    }
    annualCharge = schedule[Math.min(fullYears, schedule.length - 1)]?.charge || 0;
  } else {
    annualCharge = (cost - salvageValue) / life;
    let opening = cost;
    for (let year = 0; year < life; year += 1) {
      schedule.push({
        year: startYear + year,
        label: `Year ${year + 1}`,
        openingValue: opening,
        charge: annualCharge,
        closingValue: opening - annualCharge,
      });
      opening -= annualCharge;
    }
    accumulated = (annualCharge / 12) * months;
  }

  accumulated = Math.min(accumulated, Math.max(0, cost - salvageValue));
  const netBookValue = Math.max(salvageValue, cost - accumulated);

  return {
    cost,
    salvageValue,
    monthsInService: monthsElapsed(start, asOf),
    accumulated,
    netBookValue,
    annualCharge,
    percentDepreciated: cost > 0 ? Math.round((accumulated / cost) * 100) : 0,
    schedule,
  };
};

export const bookValue = (
  asset: Asset, asOf?: string, overrides?: DepreciationRateRule[], rateType?: DepreciationRateType,
): number => computeDepreciation(asset, asOf, overrides, rateType).netBookValue;

export const totalBookValue = (
  assets: Asset[], asOf?: string, overrides?: DepreciationRateRule[], rateType?: DepreciationRateType,
): number => assets.reduce((total, asset) => total + bookValue(asset, asOf, overrides, rateType), 0);