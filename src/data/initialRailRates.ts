import { RailRate } from '../types/rail';

interface FareSpec {
  routeId: string;
  originStationId: string;
  destinationStationId: string;
  baseFareJPY: number;
  nozomiSuperExpressJPY: number;
  hikariSuperExpressJPY: number;
  greenSurchargeJPY: number;
}

const FARE_SPECS: FareSpec[] = [
  {
    routeId: 'JP-RT-TOKYO-KYOTO',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-KYOTO',
    baseFareJPY: 8360,
    nozomiSuperExpressJPY: 5610, // 8360 + 5610 = 13,970 regular smartEX one-way fare
    hikariSuperExpressJPY: 5490,
    greenSurchargeJPY: 4870
  },
  {
    routeId: 'JP-RT-TOKYO-SHIN-OSAKA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-SHIN-OSAKA',
    baseFareJPY: 8910,
    nozomiSuperExpressJPY: 5810,
    hikariSuperExpressJPY: 5490,
    greenSurchargeJPY: 4870
  },
  {
    routeId: 'JP-RT-TOKYO-NAGOYA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-NAGOYA',
    baseFareJPY: 6380,
    nozomiSuperExpressJPY: 4920,
    hikariSuperExpressJPY: 4710,
    greenSurchargeJPY: 3660
  },
  {
    routeId: 'JP-RT-TOKYO-HIROSHIMA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-HIROSHIMA',
    baseFareJPY: 11990,
    nozomiSuperExpressJPY: 7450,
    hikariSuperExpressJPY: 6920,
    greenSurchargeJPY: 7540
  },
  {
    routeId: 'JP-RT-TOKYO-HAKATA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-HAKATA',
    baseFareJPY: 14240,
    nozomiSuperExpressJPY: 9150,
    hikariSuperExpressJPY: 8520,
    greenSurchargeJPY: 8040
  },
  {
    routeId: 'JP-RT-TOKYO-SHIN-KOBE',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-SHIN-KOBE',
    baseFareJPY: 9460,
    nozomiSuperExpressJPY: 5920,
    hikariSuperExpressJPY: 5600,
    greenSurchargeJPY: 4870
  },
  {
    routeId: 'JP-RT-TOKYO-SHIN-YOKOHAMA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-SHIN-YOKOHAMA',
    baseFareJPY: 510,
    nozomiSuperExpressJPY: 870,
    hikariSuperExpressJPY: 870,
    greenSurchargeJPY: 1300
  },
  {
    routeId: 'JP-RT-TOKYO-ODAWARA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-ODAWARA',
    baseFareJPY: 1520,
    nozomiSuperExpressJPY: 1760,
    hikariSuperExpressJPY: 1760,
    greenSurchargeJPY: 1300
  },
  {
    routeId: 'JP-RT-TOKYO-SHIZUOKA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-SHIZUOKA',
    baseFareJPY: 3410,
    nozomiSuperExpressJPY: 2530,
    hikariSuperExpressJPY: 2530,
    greenSurchargeJPY: 2090
  },
  {
    routeId: 'JP-RT-TOKYO-HAMAMATSU',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-HAMAMATSU',
    baseFareJPY: 4510,
    nozomiSuperExpressJPY: 3390,
    hikariSuperExpressJPY: 3390,
    greenSurchargeJPY: 2800
  },
  {
    routeId: 'JP-RT-TOKYO-OKAYAMA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-OKAYAMA',
    baseFareJPY: 10670,
    nozomiSuperExpressJPY: 6860,
    hikariSuperExpressJPY: 6330,
    greenSurchargeJPY: 6020
  },
  {
    routeId: 'JP-RT-TOKYO-HIMEJI',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-HIMEJI',
    baseFareJPY: 10010,
    nozomiSuperExpressJPY: 6340,
    hikariSuperExpressJPY: 5810,
    greenSurchargeJPY: 5400
  },
  {
    routeId: 'JP-RT-SHIN-OSAKA-KYOTO',
    originStationId: 'JP-ST-SHIN-OSAKA',
    destinationStationId: 'JP-ST-KYOTO',
    baseFareJPY: 570,
    nozomiSuperExpressJPY: 2500,
    hikariSuperExpressJPY: 2500,
    greenSurchargeJPY: 1300
  },
  {
    routeId: 'JP-RT-SHIN-OSAKA-HIROSHIMA',
    originStationId: 'JP-ST-SHIN-OSAKA',
    destinationStationId: 'JP-ST-HIROSHIMA',
    baseFareJPY: 5720,
    nozomiSuperExpressJPY: 5030,
    hikariSuperExpressJPY: 4510,
    greenSurchargeJPY: 4390
  },
  {
    routeId: 'JP-RT-SHIN-OSAKA-HAKATA',
    originStationId: 'JP-ST-SHIN-OSAKA',
    destinationStationId: 'JP-ST-HAKATA',
    baseFareJPY: 9790,
    nozomiSuperExpressJPY: 5810,
    hikariSuperExpressJPY: 5280,
    greenSurchargeJPY: 6090
  },
  {
    routeId: 'JP-RT-SHIN-OSAKA-NAGOYA',
    originStationId: 'JP-ST-SHIN-OSAKA',
    destinationStationId: 'JP-ST-NAGOYA',
    baseFareJPY: 3410,
    nozomiSuperExpressJPY: 3270,
    hikariSuperExpressJPY: 3060,
    greenSurchargeJPY: 2990
  },
  {
    routeId: 'JP-RT-SHIN-OSAKA-OKAYAMA',
    originStationId: 'JP-ST-SHIN-OSAKA',
    destinationStationId: 'JP-ST-OKAYAMA',
    baseFareJPY: 3080,
    nozomiSuperExpressJPY: 3270,
    hikariSuperExpressJPY: 2740,
    greenSurchargeJPY: 2990
  },
  {
    routeId: 'JP-RT-SHIN-OSAKA-KUMAMOTO',
    originStationId: 'JP-ST-SHIN-OSAKA',
    destinationStationId: 'JP-ST-KUMAMOTO',
    baseFareJPY: 11990,
    nozomiSuperExpressJPY: 7550,
    hikariSuperExpressJPY: 7020,
    greenSurchargeJPY: 7600
  },
  {
    routeId: 'JP-RT-SHIN-OSAKA-KAGOSHIMA-CHUO',
    originStationId: 'JP-ST-SHIN-OSAKA',
    destinationStationId: 'JP-ST-KAGOSHIMA-CHUO',
    baseFareJPY: 12540,
    nozomiSuperExpressJPY: 8400,
    hikariSuperExpressJPY: 7870,
    greenSurchargeJPY: 8200
  },
  {
    routeId: 'JP-RT-KYOTO-HIROSHIMA',
    originStationId: 'JP-ST-KYOTO',
    destinationStationId: 'JP-ST-HIROSHIMA',
    baseFareJPY: 6600,
    nozomiSuperExpressJPY: 5100,
    hikariSuperExpressJPY: 4580,
    greenSurchargeJPY: 4390
  },
  {
    routeId: 'JP-RT-KYOTO-NAGOYA',
    originStationId: 'JP-ST-KYOTO',
    destinationStationId: 'JP-ST-NAGOYA',
    baseFareJPY: 2640,
    nozomiSuperExpressJPY: 3300,
    hikariSuperExpressJPY: 3090,
    greenSurchargeJPY: 2990
  },
  {
    routeId: 'JP-RT-KYOTO-HAKATA',
    originStationId: 'JP-ST-KYOTO',
    destinationStationId: 'JP-ST-HAKATA',
    baseFareJPY: 9900,
    nozomiSuperExpressJPY: 5930,
    hikariSuperExpressJPY: 5400,
    greenSurchargeJPY: 6090
  },
  {
    routeId: 'JP-RT-NAGOYA-HIROSHIMA',
    originStationId: 'JP-ST-NAGOYA',
    destinationStationId: 'JP-ST-HIROSHIMA',
    baseFareJPY: 8710,
    nozomiSuperExpressJPY: 5810,
    hikariSuperExpressJPY: 5280,
    greenSurchargeJPY: 4870
  },
  {
    routeId: 'JP-RT-NAGOYA-HAKATA',
    originStationId: 'JP-ST-NAGOYA',
    destinationStationId: 'JP-ST-HAKATA',
    baseFareJPY: 11110,
    nozomiSuperExpressJPY: 7450,
    hikariSuperExpressJPY: 6920,
    greenSurchargeJPY: 7540
  },
  {
    routeId: 'JP-RT-HIROSHIMA-HAKATA',
    originStationId: 'JP-ST-HIROSHIMA',
    destinationStationId: 'JP-ST-HAKATA',
    baseFareJPY: 5170,
    nozomiSuperExpressJPY: 4500,
    hikariSuperExpressJPY: 3980,
    greenSurchargeJPY: 3660
  },
  {
    routeId: 'JP-RT-HAKATA-KUMAMOTO',
    originStationId: 'JP-ST-HAKATA',
    destinationStationId: 'JP-ST-KUMAMOTO',
    baseFareJPY: 2170,
    nozomiSuperExpressJPY: 2960,
    hikariSuperExpressJPY: 2960,
    greenSurchargeJPY: 2600
  },
  {
    routeId: 'JP-RT-HAKATA-KAGOSHIMA-CHUO',
    originStationId: 'JP-ST-HAKATA',
    destinationStationId: 'JP-ST-KAGOSHIMA-CHUO',
    baseFareJPY: 5610,
    nozomiSuperExpressJPY: 4640,
    hikariSuperExpressJPY: 4640,
    greenSurchargeJPY: 4000
  }
];

// Helper to round JR 50% fares down to nearest 10 JPY
function jrHalf(val: number): number {
  return Math.floor((val * 0.5) / 10) * 10;
}

function generateNormalizedRates(): RailRate[] {
  const rates: RailRate[] = [];

  for (const spec of FARE_SPECS) {
    const services: Array<{ group: 'NOZOMI_MIZUHO' | 'HIKARI_KODAMA_SAKURA_TSUBAME'; expressJPY: number }> = [
      { group: 'NOZOMI_MIZUHO', expressJPY: spec.nozomiSuperExpressJPY },
      { group: 'HIKARI_KODAMA_SAKURA_TSUBAME', expressJPY: spec.hikariSuperExpressJPY }
    ];

    for (const s of services) {
      // 1. Ordinary Car Reserved — Adult
      rates.push({
        rateId: `${spec.routeId}-ORD-${s.group}-ADULT`,
        routeId: spec.routeId,
        originStationId: spec.originStationId,
        destinationStationId: spec.destinationStationId,
        productId: 'RAIL-JP-ORD-RESERVED',
        carType: 'Ordinary',
        seatType: 'Reserved',
        serviceGroup: s.group,
        passengerType: 'ADULT',
        currency: 'JPY',
        baseFareJPY: spec.baseFareJPY,
        superExpressSurchargeJPY: s.expressJPY,
        greenCarSurchargeJPY: 0,
        regularTotalFareJPY: spec.baseFareJPY + s.expressJPY,
        supplierId: 'sup-jp-smartex',
        supplierName: 'smartEX / JR Central & JR West',
        effectiveDate: new Date().toISOString().split('T')[0],
        active: true
      });

      // 2. Ordinary Car Reserved — Child (50% rule)
      const childBase = jrHalf(spec.baseFareJPY);
      const childExpress = jrHalf(s.expressJPY);
      rates.push({
        rateId: `${spec.routeId}-ORD-${s.group}-CHILD`,
        routeId: spec.routeId,
        originStationId: spec.originStationId,
        destinationStationId: spec.destinationStationId,
        productId: 'RAIL-JP-ORD-RESERVED',
        carType: 'Ordinary',
        seatType: 'Reserved',
        serviceGroup: s.group,
        passengerType: 'CHILD',
        currency: 'JPY',
        baseFareJPY: childBase,
        superExpressSurchargeJPY: childExpress,
        greenCarSurchargeJPY: 0,
        regularTotalFareJPY: childBase + childExpress,
        supplierId: 'sup-jp-smartex',
        supplierName: 'smartEX / JR Central & JR West',
        effectiveDate: new Date().toISOString().split('T')[0],
        active: true
      });

      // 3. Green Car — First Class / Reserved — Adult
      rates.push({
        rateId: `${spec.routeId}-GRN-${s.group}-ADULT`,
        routeId: spec.routeId,
        originStationId: spec.originStationId,
        destinationStationId: spec.destinationStationId,
        productId: 'RAIL-JP-GREEN-RESERVED',
        carType: 'Green',
        seatType: 'Reserved',
        serviceGroup: s.group,
        passengerType: 'ADULT',
        currency: 'JPY',
        baseFareJPY: spec.baseFareJPY,
        superExpressSurchargeJPY: s.expressJPY,
        greenCarSurchargeJPY: spec.greenSurchargeJPY,
        regularTotalFareJPY: spec.baseFareJPY + s.expressJPY + spec.greenSurchargeJPY,
        supplierId: 'sup-jp-smartex',
        supplierName: 'smartEX / JR Central & JR West',
        effectiveDate: new Date().toISOString().split('T')[0],
        active: true
      });

      // 4. Green Car — First Class / Reserved — Child
      // In JR, child Green car pays child base + child express + FULL Green surcharge
      rates.push({
        rateId: `${spec.routeId}-GRN-${s.group}-CHILD`,
        routeId: spec.routeId,
        originStationId: spec.originStationId,
        destinationStationId: spec.destinationStationId,
        productId: 'RAIL-JP-GREEN-RESERVED',
        carType: 'Green',
        seatType: 'Reserved',
        serviceGroup: s.group,
        passengerType: 'CHILD',
        currency: 'JPY',
        baseFareJPY: childBase,
        superExpressSurchargeJPY: childExpress,
        greenCarSurchargeJPY: spec.greenSurchargeJPY,
        regularTotalFareJPY: childBase + childExpress + spec.greenSurchargeJPY,
        supplierId: 'sup-jp-smartex',
        supplierName: 'smartEX / JR Central & JR West',
        effectiveDate: new Date().toISOString().split('T')[0],
        active: true
      });
    }
  }

  return rates;
}

export const INITIAL_RAIL_RATES: RailRate[] = generateNormalizedRates();

export function findExactRate(
  originStationId: string,
  destStationId: string,
  productId: 'RAIL-JP-ORD-RESERVED' | 'RAIL-JP-GREEN-RESERVED',
  serviceGroup: 'NOZOMI_MIZUHO' | 'HIKARI_KODAMA_SAKURA_TSUBAME',
  passengerType: 'ADULT' | 'CHILD'
): RailRate | undefined {
  // Try forward
  let matched = INITIAL_RAIL_RATES.find(r => 
    r.originStationId === originStationId &&
    r.destinationStationId === destStationId &&
    r.productId === productId &&
    r.serviceGroup === serviceGroup &&
    r.passengerType === passengerType
  );
  if (matched) return matched;

  // Try reverse (fares are identical in both directions)
  matched = INITIAL_RAIL_RATES.find(r => 
    r.originStationId === destStationId &&
    r.destinationStationId === originStationId &&
    r.productId === productId &&
    r.serviceGroup === serviceGroup &&
    r.passengerType === passengerType
  );
  if (matched) return matched;

  // Fallback to closest available service group if Nozomi isn't available on route
  matched = INITIAL_RAIL_RATES.find(r => 
    (r.originStationId === originStationId || r.originStationId === destStationId) &&
    (r.destinationStationId === destStationId || r.destinationStationId === originStationId) &&
    r.productId === productId &&
    r.passengerType === passengerType
  );
  return matched;
}
