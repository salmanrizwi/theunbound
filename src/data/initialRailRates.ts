import { RailRate } from '../types/rail';

interface RouteNettSpec {
  routeId: string;
  originStationId: string;
  destinationStationId: string;
  nozomiOrdAdultJPY: number;
  nozomiOrdChildJPY: number;
  nozomiGrnAdultJPY: number;
  nozomiGrnChildJPY: number;
  hikariOrdAdultJPY: number;
  hikariOrdChildJPY: number;
  hikariGrnAdultJPY: number;
  hikariGrnChildJPY: number;
}

const ROUTE_NETT_SPECS: RouteNettSpec[] = [
  {
    routeId: 'JP-RT-TOKYO-KYOTO',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-KYOTO',
    nozomiOrdAdultJPY: 13970,
    nozomiOrdChildJPY: 6980,
    nozomiGrnAdultJPY: 18840,
    nozomiGrnChildJPY: 11850,
    hikariOrdAdultJPY: 13850,
    hikariOrdChildJPY: 6920,
    hikariGrnAdultJPY: 18720,
    hikariGrnChildJPY: 11790
  },
  {
    routeId: 'JP-RT-TOKYO-SHIN-OSAKA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-SHIN-OSAKA',
    nozomiOrdAdultJPY: 14720,
    nozomiOrdChildJPY: 7350,
    nozomiGrnAdultJPY: 19590,
    nozomiGrnChildJPY: 12220,
    hikariOrdAdultJPY: 14400,
    hikariOrdChildJPY: 7190,
    hikariGrnAdultJPY: 19270,
    hikariGrnChildJPY: 12060
  },
  {
    routeId: 'JP-RT-TOKYO-NAGOYA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-NAGOYA',
    nozomiOrdAdultJPY: 11300,
    nozomiOrdChildJPY: 5650,
    nozomiGrnAdultJPY: 14960,
    nozomiGrnChildJPY: 9310,
    hikariOrdAdultJPY: 11090,
    hikariOrdChildJPY: 5540,
    hikariGrnAdultJPY: 14750,
    hikariGrnChildJPY: 9200
  },
  {
    routeId: 'JP-RT-TOKYO-HIROSHIMA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-HIROSHIMA',
    nozomiOrdAdultJPY: 19440,
    nozomiOrdChildJPY: 9710,
    nozomiGrnAdultJPY: 26980,
    nozomiGrnChildJPY: 17250,
    hikariOrdAdultJPY: 18910,
    hikariOrdChildJPY: 9450,
    hikariGrnAdultJPY: 26450,
    hikariGrnChildJPY: 16990
  },
  {
    routeId: 'JP-RT-TOKYO-HAKATA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-HAKATA',
    nozomiOrdAdultJPY: 23390,
    nozomiOrdChildJPY: 11690,
    nozomiGrnAdultJPY: 31430,
    nozomiGrnChildJPY: 19730,
    hikariOrdAdultJPY: 22760,
    hikariOrdChildJPY: 11380,
    hikariGrnAdultJPY: 30800,
    hikariGrnChildJPY: 19420
  },
  {
    routeId: 'JP-RT-TOKYO-SHIN-KOBE',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-SHIN-KOBE',
    nozomiOrdAdultJPY: 15380,
    nozomiOrdChildJPY: 7690,
    nozomiGrnAdultJPY: 20250,
    nozomiGrnChildJPY: 12560,
    hikariOrdAdultJPY: 15060,
    hikariOrdChildJPY: 7530,
    hikariGrnAdultJPY: 19930,
    hikariGrnChildJPY: 12400
  },
  {
    routeId: 'JP-RT-TOKYO-SHIN-YOKOHAMA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-SHIN-YOKOHAMA',
    nozomiOrdAdultJPY: 1380,
    nozomiOrdChildJPY: 680,
    nozomiGrnAdultJPY: 2680,
    nozomiGrnChildJPY: 1980,
    hikariOrdAdultJPY: 1380,
    hikariOrdChildJPY: 680,
    hikariGrnAdultJPY: 2680,
    hikariGrnChildJPY: 1980
  },
  {
    routeId: 'JP-RT-TOKYO-ODAWARA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-ODAWARA',
    nozomiOrdAdultJPY: 3280,
    nozomiOrdChildJPY: 1640,
    nozomiGrnAdultJPY: 4580,
    nozomiGrnChildJPY: 2940,
    hikariOrdAdultJPY: 3280,
    hikariOrdChildJPY: 1640,
    hikariGrnAdultJPY: 4580,
    hikariGrnChildJPY: 2940
  },
  {
    routeId: 'JP-RT-TOKYO-SHIZUOKA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-SHIZUOKA',
    nozomiOrdAdultJPY: 5940,
    nozomiOrdChildJPY: 2960,
    nozomiGrnAdultJPY: 8030,
    nozomiGrnChildJPY: 5050,
    hikariOrdAdultJPY: 5940,
    hikariOrdChildJPY: 2960,
    hikariGrnAdultJPY: 8030,
    hikariGrnChildJPY: 5050
  },
  {
    routeId: 'JP-RT-TOKYO-HAMAMATSU',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-HAMAMATSU',
    nozomiOrdAdultJPY: 7900,
    nozomiOrdChildJPY: 3940,
    nozomiGrnAdultJPY: 10700,
    nozomiGrnChildJPY: 6740,
    hikariOrdAdultJPY: 7900,
    hikariOrdChildJPY: 3940,
    hikariGrnAdultJPY: 10700,
    hikariGrnChildJPY: 6740
  },
  {
    routeId: 'JP-RT-TOKYO-OKAYAMA',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-OKAYAMA',
    nozomiOrdAdultJPY: 17530,
    nozomiOrdChildJPY: 8760,
    nozomiGrnAdultJPY: 23550,
    nozomiGrnChildJPY: 14780,
    hikariOrdAdultJPY: 17000,
    hikariOrdChildJPY: 8490,
    hikariGrnAdultJPY: 23020,
    hikariGrnChildJPY: 14510
  },
  {
    routeId: 'JP-RT-TOKYO-HIMEJI',
    originStationId: 'JP-ST-TOKYO',
    destinationStationId: 'JP-ST-HIMEJI',
    nozomiOrdAdultJPY: 16350,
    nozomiOrdChildJPY: 8170,
    nozomiGrnAdultJPY: 21750,
    nozomiGrnChildJPY: 13570,
    hikariOrdAdultJPY: 15820,
    hikariOrdChildJPY: 7900,
    hikariGrnAdultJPY: 21220,
    hikariGrnChildJPY: 13300
  },
  {
    routeId: 'JP-RT-SHIN-OSAKA-KYOTO',
    originStationId: 'JP-ST-SHIN-OSAKA',
    destinationStationId: 'JP-ST-KYOTO',
    nozomiOrdAdultJPY: 3070,
    nozomiOrdChildJPY: 1530,
    nozomiGrnAdultJPY: 4370,
    nozomiGrnChildJPY: 2830,
    hikariOrdAdultJPY: 3070,
    hikariOrdChildJPY: 1530,
    hikariGrnAdultJPY: 4370,
    hikariGrnChildJPY: 2830
  },
  {
    routeId: 'JP-RT-SHIN-OSAKA-HIROSHIMA',
    originStationId: 'JP-ST-SHIN-OSAKA',
    destinationStationId: 'JP-ST-HIROSHIMA',
    nozomiOrdAdultJPY: 10750,
    nozomiOrdChildJPY: 5370,
    nozomiGrnAdultJPY: 15140,
    nozomiGrnChildJPY: 9760,
    hikariOrdAdultJPY: 10230,
    hikariOrdChildJPY: 5110,
    hikariGrnAdultJPY: 14620,
    hikariGrnChildJPY: 9500
  },
  {
    routeId: 'JP-RT-SHIN-OSAKA-HAKATA',
    originStationId: 'JP-ST-SHIN-OSAKA',
    destinationStationId: 'JP-ST-HAKATA',
    nozomiOrdAdultJPY: 15600,
    nozomiOrdChildJPY: 7790,
    nozomiGrnAdultJPY: 21690,
    nozomiGrnChildJPY: 13880,
    hikariOrdAdultJPY: 15070,
    hikariOrdChildJPY: 7530,
    hikariGrnAdultJPY: 21160,
    hikariGrnChildJPY: 13620
  },
  {
    routeId: 'JP-RT-SHIN-OSAKA-NAGOYA',
    originStationId: 'JP-ST-SHIN-OSAKA',
    destinationStationId: 'JP-ST-NAGOYA',
    nozomiOrdAdultJPY: 6680,
    nozomiOrdChildJPY: 3330,
    nozomiGrnAdultJPY: 9670,
    nozomiGrnChildJPY: 6320,
    hikariOrdAdultJPY: 6470,
    hikariOrdChildJPY: 3230,
    hikariGrnAdultJPY: 9460,
    hikariGrnChildJPY: 6220
  },
  {
    routeId: 'JP-RT-SHIN-OSAKA-OKAYAMA',
    originStationId: 'JP-ST-SHIN-OSAKA',
    destinationStationId: 'JP-ST-OKAYAMA',
    nozomiOrdAdultJPY: 6350,
    nozomiOrdChildJPY: 3170,
    nozomiGrnAdultJPY: 9340,
    nozomiGrnChildJPY: 6160,
    hikariOrdAdultJPY: 5820,
    hikariOrdChildJPY: 2910,
    hikariGrnAdultJPY: 8810,
    hikariGrnChildJPY: 5900
  },
  {
    routeId: 'JP-RT-SHIN-OSAKA-KUMAMOTO',
    originStationId: 'JP-ST-SHIN-OSAKA',
    destinationStationId: 'JP-ST-KUMAMOTO',
    nozomiOrdAdultJPY: 19540,
    nozomiOrdChildJPY: 9760,
    nozomiGrnAdultJPY: 27140,
    nozomiGrnChildJPY: 17360,
    hikariOrdAdultJPY: 19010,
    hikariOrdChildJPY: 9500,
    hikariGrnAdultJPY: 26610,
    hikariGrnChildJPY: 17100
  },
  {
    routeId: 'JP-RT-SHIN-OSAKA-KAGOSHIMA-CHUO',
    originStationId: 'JP-ST-SHIN-OSAKA',
    destinationStationId: 'JP-ST-KAGOSHIMA-CHUO',
    nozomiOrdAdultJPY: 20940,
    nozomiOrdChildJPY: 10470,
    nozomiGrnAdultJPY: 29140,
    nozomiGrnChildJPY: 18670,
    hikariOrdAdultJPY: 20410,
    hikariOrdChildJPY: 10200,
    hikariGrnAdultJPY: 28610,
    hikariGrnChildJPY: 18400
  },
  {
    routeId: 'JP-RT-KYOTO-HIROSHIMA',
    originStationId: 'JP-ST-KYOTO',
    destinationStationId: 'JP-ST-HIROSHIMA',
    nozomiOrdAdultJPY: 11700,
    nozomiOrdChildJPY: 5850,
    nozomiGrnAdultJPY: 16090,
    nozomiGrnChildJPY: 10240,
    hikariOrdAdultJPY: 11180,
    hikariOrdChildJPY: 5590,
    hikariGrnAdultJPY: 15570,
    hikariGrnChildJPY: 9980
  },
  {
    routeId: 'JP-RT-KYOTO-NAGOYA',
    originStationId: 'JP-ST-KYOTO',
    destinationStationId: 'JP-ST-NAGOYA',
    nozomiOrdAdultJPY: 5940,
    nozomiOrdChildJPY: 2970,
    nozomiGrnAdultJPY: 8930,
    nozomiGrnChildJPY: 5960,
    hikariOrdAdultJPY: 5730,
    hikariOrdChildJPY: 2860,
    hikariGrnAdultJPY: 8720,
    hikariGrnChildJPY: 5850
  },
  {
    routeId: 'JP-RT-KYOTO-HAKATA',
    originStationId: 'JP-ST-KYOTO',
    destinationStationId: 'JP-ST-HAKATA',
    nozomiOrdAdultJPY: 15830,
    nozomiOrdChildJPY: 7910,
    nozomiGrnAdultJPY: 21920,
    nozomiGrnChildJPY: 14000,
    hikariOrdAdultJPY: 15300,
    hikariOrdChildJPY: 7650,
    hikariGrnAdultJPY: 21390,
    hikariGrnChildJPY: 13740
  },
  {
    routeId: 'JP-RT-NAGOYA-HIROSHIMA',
    originStationId: 'JP-ST-NAGOYA',
    destinationStationId: 'JP-ST-HIROSHIMA',
    nozomiOrdAdultJPY: 14520,
    nozomiOrdChildJPY: 7250,
    nozomiGrnAdultJPY: 19390,
    nozomiGrnChildJPY: 12120,
    hikariOrdAdultJPY: 13990,
    hikariOrdChildJPY: 6990,
    hikariGrnAdultJPY: 18860,
    hikariGrnChildJPY: 11860
  },
  {
    routeId: 'JP-RT-NAGOYA-HAKATA',
    originStationId: 'JP-ST-NAGOYA',
    destinationStationId: 'JP-ST-HAKATA',
    nozomiOrdAdultJPY: 18560,
    nozomiOrdChildJPY: 9270,
    nozomiGrnAdultJPY: 26100,
    nozomiGrnChildJPY: 16810,
    hikariOrdAdultJPY: 18030,
    hikariOrdChildJPY: 9010,
    hikariGrnAdultJPY: 25570,
    hikariGrnChildJPY: 16550
  },
  {
    routeId: 'JP-RT-HIROSHIMA-HAKATA',
    originStationId: 'JP-ST-HIROSHIMA',
    destinationStationId: 'JP-ST-HAKATA',
    nozomiOrdAdultJPY: 9670,
    nozomiOrdChildJPY: 4830,
    nozomiGrnAdultJPY: 13330,
    nozomiGrnChildJPY: 8490,
    hikariOrdAdultJPY: 9150,
    hikariOrdChildJPY: 4570,
    hikariGrnAdultJPY: 12810,
    hikariGrnChildJPY: 8230
  },
  {
    routeId: 'JP-RT-HAKATA-KUMAMOTO',
    originStationId: 'JP-ST-HAKATA',
    destinationStationId: 'JP-ST-KUMAMOTO',
    nozomiOrdAdultJPY: 5130,
    nozomiOrdChildJPY: 2560,
    nozomiGrnAdultJPY: 7730,
    nozomiGrnChildJPY: 5160,
    hikariOrdAdultJPY: 5130,
    hikariOrdChildJPY: 2560,
    hikariGrnAdultJPY: 7730,
    hikariGrnChildJPY: 5160
  },
  {
    routeId: 'JP-RT-HAKATA-KAGOSHIMA-CHUO',
    originStationId: 'JP-ST-HAKATA',
    destinationStationId: 'JP-ST-KAGOSHIMA-CHUO',
    nozomiOrdAdultJPY: 10250,
    nozomiOrdChildJPY: 5120,
    nozomiGrnAdultJPY: 14250,
    nozomiGrnChildJPY: 9120,
    hikariOrdAdultJPY: 10250,
    hikariOrdChildJPY: 5120,
    hikariGrnAdultJPY: 14250,
    hikariGrnChildJPY: 9120
  }
];

function generateNormalizedRates(): RailRate[] {
  const rates: RailRate[] = [];
  const effectiveDate = new Date().toISOString().split('T')[0];

  for (const spec of ROUTE_NETT_SPECS) {
    const services: Array<{
      group: 'NOZOMI_MIZUHO' | 'HIKARI_KODAMA_SAKURA_TSUBAME';
      ordAdult: number;
      ordChild: number;
      grnAdult: number;
      grnChild: number;
    }> = [
      {
        group: 'NOZOMI_MIZUHO',
        ordAdult: spec.nozomiOrdAdultJPY,
        ordChild: spec.nozomiOrdChildJPY,
        grnAdult: spec.nozomiGrnAdultJPY,
        grnChild: spec.nozomiGrnChildJPY
      },
      {
        group: 'HIKARI_KODAMA_SAKURA_TSUBAME',
        ordAdult: spec.hikariOrdAdultJPY,
        ordChild: spec.hikariOrdChildJPY,
        grnAdult: spec.hikariGrnAdultJPY,
        grnChild: spec.hikariGrnChildJPY
      }
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
        nettPrice: s.ordAdult,
        nativeCurrency: 'JPY',
        currency: 'JPY',
        supplierId: 'sup-jp-smartex',
        supplierName: 'smartEX / JR Central & JR West',
        effectiveDate,
        active: true
      });

      // 2. Ordinary Car Reserved — Child
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
        nettPrice: s.ordChild,
        nativeCurrency: 'JPY',
        currency: 'JPY',
        supplierId: 'sup-jp-smartex',
        supplierName: 'smartEX / JR Central & JR West',
        effectiveDate,
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
        nettPrice: s.grnAdult,
        nativeCurrency: 'JPY',
        currency: 'JPY',
        supplierId: 'sup-jp-smartex',
        supplierName: 'smartEX / JR Central & JR West',
        effectiveDate,
        active: true
      });

      // 4. Green Car — First Class / Reserved — Child
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
        nettPrice: s.grnChild,
        nativeCurrency: 'JPY',
        currency: 'JPY',
        supplierId: 'sup-jp-smartex',
        supplierName: 'smartEX / JR Central & JR West',
        effectiveDate,
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
