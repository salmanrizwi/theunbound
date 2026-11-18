import { RailSeasonAdjustment, RailSeasonCalendarPeriod, RailSeasonType } from '../types/rail';

export const RAIL_SEASON_ADJUSTMENTS: Record<RailSeasonType, RailSeasonAdjustment> = {
  REGULAR: {
    seasonType: 'REGULAR',
    label: 'Regular Season',
    adultAdjustmentJPY: 0,
    childAdjustmentJPY: 0,
    description: 'Standard baseline fare period across Japan Rail network.'
  },
  LOW: {
    seasonType: 'LOW',
    label: 'Off-Peak / Low Season',
    adultAdjustmentJPY: -200,
    childAdjustmentJPY: -100,
    description: 'Off-peak discount of ¥200 per adult (¥100 per child) on reserved seat surcharge.'
  },
  HIGH: {
    seasonType: 'HIGH',
    label: 'Peak Season',
    adultAdjustmentJPY: 200,
    childAdjustmentJPY: 100,
    description: 'High season surcharge of +¥200 per adult (+¥100 per child) on reserved seat surcharge.'
  },
  PEAK_HIGH: {
    seasonType: 'PEAK_HIGH',
    label: 'Top Peak / Holiday Season',
    adultAdjustmentJPY: 400,
    childAdjustmentJPY: 200,
    description: 'Golden Week, Obon, and New Year holiday rush surcharge of +¥400 per adult (+¥200 per child).'
  },
  HOLIDAY: {
    seasonType: 'HOLIDAY',
    label: 'National Holiday Surge',
    adultAdjustmentJPY: 400,
    childAdjustmentJPY: 200,
    description: 'Designated national public holidays and three-day weekend travel rushes.'
  },
  SPECIAL: {
    seasonType: 'SPECIAL',
    label: 'Special Event / Seasonal Extra',
    adultAdjustmentJPY: 300,
    childAdjustmentJPY: 150,
    description: 'Special festival or temporary capacity surcharge block.'
  }
};

export interface SeasonMatchResult {
  seasonType: RailSeasonType;
  seasonLabel: string;
  seasonPeriod?: RailSeasonCalendarPeriod;
  adultAdjustmentJPY: number;
  childAdjustmentJPY: number;
  pricingMultiplier: number;
}

const SEASON_TYPE_HIERARCHY: Record<RailSeasonType, number> = {
  PEAK_HIGH: 60,
  HOLIDAY: 50,
  HIGH: 40,
  SPECIAL: 30,
  LOW: 20,
  REGULAR: 10
};

export function resolveRailSeasonForDate(
  travelDateStr: string,
  configuredSeasons?: RailSeasonCalendarPeriod[]
): SeasonMatchResult {
  if (!travelDateStr) {
    return {
      seasonType: 'REGULAR',
      seasonLabel: RAIL_SEASON_ADJUSTMENTS.REGULAR.label,
      adultAdjustmentJPY: 0,
      childAdjustmentJPY: 0,
      pricingMultiplier: 1.0
    };
  }

  const d = new Date(travelDateStr);
  if (isNaN(d.getTime())) {
    return {
      seasonType: 'REGULAR',
      seasonLabel: RAIL_SEASON_ADJUSTMENTS.REGULAR.label,
      adultAdjustmentJPY: 0,
      childAdjustmentJPY: 0,
      pricingMultiplier: 1.0
    };
  }

  const dayOfWeek = d.getUTCDay();
  const seasonsToSearch = configuredSeasons && configuredSeasons.length > 0 ? configuredSeasons : [];
  const matchingPeriods: RailSeasonCalendarPeriod[] = [];

  for (const period of seasonsToSearch) {
    if (period.active === false) continue;
    if (travelDateStr >= period.startDate && travelDateStr <= period.endDate) {
      if (period.daysOfWeek && period.daysOfWeek.length > 0) {
        if (period.daysOfWeek.includes(dayOfWeek)) {
          matchingPeriods.push(period);
        }
      } else {
        matchingPeriods.push(period);
      }
    }
  }

  if (matchingPeriods.length === 0) {
    return {
      seasonType: 'REGULAR',
      seasonLabel: RAIL_SEASON_ADJUSTMENTS.REGULAR.label,
      adultAdjustmentJPY: 0,
      childAdjustmentJPY: 0,
      pricingMultiplier: 1.0
    };
  }

  matchingPeriods.sort((a, b) => {
    const priorityA = a.priority ?? 50;
    const priorityB = b.priority ?? 50;
    if (priorityA !== priorityB) return priorityB - priorityA;
    return (SEASON_TYPE_HIERARCHY[b.seasonType] || 0) - (SEASON_TYPE_HIERARCHY[a.seasonType] || 0);
  });

  const bestPeriod = matchingPeriods[0];
  const defaultAdj = RAIL_SEASON_ADJUSTMENTS[bestPeriod.seasonType] || RAIL_SEASON_ADJUSTMENTS.REGULAR;

  return {
    seasonType: bestPeriod.seasonType,
    seasonLabel: bestPeriod.title || defaultAdj.label,
    seasonPeriod: bestPeriod,
    adultAdjustmentJPY: typeof bestPeriod.adultAdjustmentJPY === 'number' ? bestPeriod.adultAdjustmentJPY : defaultAdj.adultAdjustmentJPY,
    childAdjustmentJPY: typeof bestPeriod.childAdjustmentJPY === 'number' ? bestPeriod.childAdjustmentJPY : defaultAdj.childAdjustmentJPY,
    pricingMultiplier: typeof bestPeriod.pricingMultiplier === 'number' ? bestPeriod.pricingMultiplier : 1.0
  };
}

export function determineRailSeason(travelDateStr: string, customSeasons?: RailSeasonCalendarPeriod[]): RailSeasonType {
  return resolveRailSeasonForDate(travelDateStr, customSeasons).seasonType;
}

export interface SeasonOverlapConflict {
  seasonA: RailSeasonCalendarPeriod;
  seasonB: RailSeasonCalendarPeriod;
  conflictType: 'FULL' | 'PARTIAL';
  overlapStartDate: string;
  overlapEndDate: string;
}

export function detectSeasonOverlaps(seasons: RailSeasonCalendarPeriod[]): SeasonOverlapConflict[] {
  const active = seasons.filter(s => s.active !== false);
  const conflicts: SeasonOverlapConflict[] = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const overlapStart = a.startDate > b.startDate ? a.startDate : b.startDate;
      const overlapEnd = a.endDate < b.endDate ? a.endDate : b.endDate;

      if (overlapStart <= overlapEnd) {
        if (a.daysOfWeek && a.daysOfWeek.length > 0 && b.daysOfWeek && b.daysOfWeek.length > 0) {
          const common = a.daysOfWeek.filter(d => b.daysOfWeek!.includes(d));
          if (common.length === 0) continue;
        }
        conflicts.push({
          seasonA: a,
          seasonB: b,
          conflictType: (a.startDate === b.startDate && a.endDate === b.endDate) ? 'FULL' : 'PARTIAL',
          overlapStartDate: overlapStart,
          overlapEndDate: overlapEnd
        });
      }
    }
  }

  return conflicts;
}

