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

/**
 * Dynamically generates initial seed seasons based on data-driven year calculation.
 * Never hardcodes a fixed year; works for current and future years seamlessly.
 */
export function generateInitialRailSeasons(): RailSeasonCalendarPeriod[] {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];
  const list: RailSeasonCalendarPeriod[] = [];

  years.forEach(yr => {
    list.push(
      {
        id: `cal-${yr}-gw-peak-high`,
        seasonType: 'PEAK_HIGH',
        title: `Golden Week Holiday Rush (${yr})`,
        startDate: `${yr}-04-26`,
        endDate: `${yr}-05-06`,
        adultAdjustmentJPY: 400,
        childAdjustmentJPY: 200,
        pricingMultiplier: 1.0,
        active: true,
        priority: 95,
        displayOrder: 1,
        applicableYear: yr,
        notes: 'Major national holiday block across Japan'
      },
      {
        id: `cal-${yr}-obon-peak-high`,
        seasonType: 'PEAK_HIGH',
        title: `Obon Festival Peak (${yr})`,
        startDate: `${yr}-08-08`,
        endDate: `${yr}-08-17`,
        adultAdjustmentJPY: 400,
        childAdjustmentJPY: 200,
        pricingMultiplier: 1.0,
        active: true,
        priority: 95,
        displayOrder: 2,
        applicableYear: yr,
        notes: 'Summer ancestral homecoming travel peak'
      },
      {
        id: `cal-${yr}-nye-peak-high`,
        seasonType: 'PEAK_HIGH',
        title: `Year-End & New Year Shogatsu Peak (${yr})`,
        startDate: `${yr}-12-27`,
        endDate: `${yr + 1}-01-05`,
        adultAdjustmentJPY: 400,
        childAdjustmentJPY: 200,
        pricingMultiplier: 1.0,
        active: true,
        priority: 95,
        displayOrder: 3,
        applicableYear: yr,
        notes: 'New Year celebration and travel rush'
      },
      {
        id: `cal-${yr}-spring-high`,
        seasonType: 'HIGH',
        title: `Spring Sakura Cherry Blossom Peak (${yr})`,
        startDate: `${yr}-03-21`,
        endDate: `${yr}-04-05`,
        adultAdjustmentJPY: 200,
        childAdjustmentJPY: 100,
        pricingMultiplier: 1.0,
        active: true,
        priority: 70,
        displayOrder: 4,
        applicableYear: yr,
        notes: 'Cherry blossom viewing season across Tokyo, Kyoto, and Kansai'
      },
      {
        id: `cal-${yr}-summer-high-1`,
        seasonType: 'HIGH',
        title: `Summer School Holiday Early Peak (${yr})`,
        startDate: `${yr}-07-19`,
        endDate: `${yr}-08-07`,
        adultAdjustmentJPY: 200,
        childAdjustmentJPY: 100,
        pricingMultiplier: 1.0,
        active: true,
        priority: 70,
        displayOrder: 5,
        applicableYear: yr,
        notes: 'Pre-Obon summer vacation travel'
      },
      {
        id: `cal-${yr}-summer-high-2`,
        seasonType: 'HIGH',
        title: `Summer School Holiday Late Peak (${yr})`,
        startDate: `${yr}-08-18`,
        endDate: `${yr}-08-31`,
        adultAdjustmentJPY: 200,
        childAdjustmentJPY: 100,
        pricingMultiplier: 1.0,
        active: true,
        priority: 70,
        displayOrder: 6,
        applicableYear: yr,
        notes: 'Post-Obon summer vacation return'
      },
      {
        id: `cal-${yr}-autumn-high`,
        seasonType: 'HIGH',
        title: `Autumn Foliage (Koyo) Peak (${yr})`,
        startDate: `${yr}-10-11`,
        endDate: `${yr}-11-24`,
        daysOfWeek: [5, 6, 0], // Fri, Sat, Sun
        adultAdjustmentJPY: 200,
        childAdjustmentJPY: 100,
        pricingMultiplier: 1.0,
        active: true,
        priority: 70,
        displayOrder: 7,
        applicableYear: yr,
        notes: 'Weekend autumn leaf viewing peak in Kyoto and Kansai'
      },
      {
        id: `cal-${yr}-winter-low`,
        seasonType: 'LOW',
        title: `Winter Off-Peak Weekdays (${yr})`,
        startDate: `${yr}-01-16`,
        endDate: `${yr}-02-28`,
        daysOfWeek: [1, 2, 3, 4], // Mon to Thu
        adultAdjustmentJPY: -200,
        childAdjustmentJPY: -100,
        pricingMultiplier: 1.0,
        active: true,
        priority: 40,
        displayOrder: 8,
        applicableYear: yr,
        notes: 'Standard JR winter discount days'
      },
      {
        id: `cal-${yr}-june-low`,
        seasonType: 'LOW',
        title: `June Rainy Season Weekdays (${yr})`,
        startDate: `${yr}-06-01`,
        endDate: `${yr}-06-30`,
        daysOfWeek: [1, 2, 3, 4], // Mon to Thu
        adultAdjustmentJPY: -200,
        childAdjustmentJPY: -100,
        pricingMultiplier: 1.0,
        active: true,
        priority: 40,
        displayOrder: 9,
        applicableYear: yr,
        notes: 'Off-peak travel period'
      },
      {
        id: `cal-${yr}-sep-low`,
        seasonType: 'LOW',
        title: `September Autumn Shoulder Weekdays (${yr})`,
        startDate: `${yr}-09-01`,
        endDate: `${yr}-09-30`,
        daysOfWeek: [1, 2, 3, 4], // Mon to Thu
        adultAdjustmentJPY: -200,
        childAdjustmentJPY: -100,
        pricingMultiplier: 1.0,
        active: true,
        priority: 40,
        displayOrder: 10,
        applicableYear: yr,
        notes: 'Off-peak weekday discount'
      },
      {
        id: `cal-${yr}-dec-low`,
        seasonType: 'LOW',
        title: `Early December Pre-Holiday Weekdays (${yr})`,
        startDate: `${yr}-12-01`,
        endDate: `${yr}-12-19`,
        daysOfWeek: [1, 2, 3, 4], // Mon to Thu
        adultAdjustmentJPY: -200,
        childAdjustmentJPY: -100,
        pricingMultiplier: 1.0,
        active: true,
        priority: 40,
        displayOrder: 11,
        applicableYear: yr,
        notes: 'Quiet travel window before holiday rush'
      }
    );
  });

  return list;
}

export const INITIAL_RAIL_SEASON_CALENDAR: RailSeasonCalendarPeriod[] = generateInitialRailSeasons();

export interface SeasonOverlapConflict {
  seasonA: RailSeasonCalendarPeriod;
  seasonB: RailSeasonCalendarPeriod;
  conflictType: 'FULL' | 'PARTIAL';
  overlapStartDate: string;
  overlapEndDate: string;
}

/**
 * Detects overlapping date ranges among active seasons to alert the administrator.
 */
export function detectSeasonOverlaps(seasons: RailSeasonCalendarPeriod[]): SeasonOverlapConflict[] {
  const active = seasons.filter(s => s.active !== false);
  const conflicts: SeasonOverlapConflict[] = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];

      // Overlap condition: max(startA, startB) <= min(endA, endB)
      const overlapStart = a.startDate > b.startDate ? a.startDate : b.startDate;
      const overlapEnd = a.endDate < b.endDate ? a.endDate : b.endDate;

      if (overlapStart <= overlapEnd) {
        // If both specify days of week, ensure there is an intersecting day
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

/**
 * Authoritative dynamic season matcher.
 * Matches any travel date against configured season periods with priority resolution for overlaps.
 */
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

  const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const seasonsToSearch = configuredSeasons && configuredSeasons.length > 0
    ? configuredSeasons
    : INITIAL_RAIL_SEASON_CALENDAR;

  // Find all active matching periods
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

  // Sort by priority descending. If priority equal, sort by hierarchy.
  matchingPeriods.sort((a, b) => {
    const priorityA = a.priority ?? 50;
    const priorityB = b.priority ?? 50;
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }
    return (SEASON_TYPE_HIERARCHY[b.seasonType] || 0) - (SEASON_TYPE_HIERARCHY[a.seasonType] || 0);
  });

  const bestPeriod = matchingPeriods[0];
  const defaultAdj = RAIL_SEASON_ADJUSTMENTS[bestPeriod.seasonType] || RAIL_SEASON_ADJUSTMENTS.REGULAR;

  const adultAdjustmentJPY = typeof bestPeriod.adultAdjustmentJPY === 'number'
    ? bestPeriod.adultAdjustmentJPY
    : defaultAdj.adultAdjustmentJPY;

  const childAdjustmentJPY = typeof bestPeriod.childAdjustmentJPY === 'number'
    ? bestPeriod.childAdjustmentJPY
    : defaultAdj.childAdjustmentJPY;

  const pricingMultiplier = typeof bestPeriod.pricingMultiplier === 'number'
    ? bestPeriod.pricingMultiplier
    : 1.0;

  return {
    seasonType: bestPeriod.seasonType,
    seasonLabel: bestPeriod.title || defaultAdj.label,
    seasonPeriod: bestPeriod,
    adultAdjustmentJPY,
    childAdjustmentJPY,
    pricingMultiplier
  };
}

/**
 * Backward-compatible helper returning RailSeasonType
 */
export function determineRailSeason(travelDateStr: string, customSeasons?: RailSeasonCalendarPeriod[]): RailSeasonType {
  return resolveRailSeasonForDate(travelDateStr, customSeasons).seasonType;
}
