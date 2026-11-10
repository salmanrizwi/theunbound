import { inventoryDiscoveryService } from '../services/inventoryDiscoveryService';
import { AppDatabase } from '../services/db';
import { Product, Hotel, Destination, CityHub } from '../types';

export function runInventoryDiscoverySearchFirstAudit(): {
  total: number;
  passed: number;
  failed: number;
  results: { test: string; status: 'PASS' | 'FAIL'; message?: string }[];
} {
  const results: { test: string; status: 'PASS' | 'FAIL'; message?: string }[] = [];
  const db = AppDatabase.getInstance();

  const mockDestinations: Destination[] = [
    {
      id: 'dest-tokyo',
      name: 'Tokyo',
      slug: 'tokyo',
      regionId: 'reg-kanto',
      regionName: 'Kanto',
      country: 'Japan',
      description: 'Capital city',
      imageUrl: '',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    } as any,
    {
      id: 'dest-kyoto',
      name: 'Kyoto',
      slug: 'kyoto',
      regionId: 'reg-kansai',
      regionName: 'Kansai',
      country: 'Japan',
      description: 'Cultural heart',
      imageUrl: '',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    } as any
  ];

  const mockCityHubs: CityHub[] = [
    {
      id: 'hub-ginza',
      name: 'Ginza & Marunouchi',
      destinationId: 'dest-tokyo',
      regionId: 'reg-kanto',
      code: 'GNZ',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    } as any,
    {
      id: 'hub-gion',
      name: 'Gion & Higashiyama',
      destinationId: 'dest-kyoto',
      regionId: 'reg-kansai',
      code: 'GIO',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    } as any
  ];

  const mockProducts: Product[] = [
    {
      id: 'prod-tokyo-food',
      sku: 'TYO-FOOD-001',
      name: 'Ginza Michelin Culinary Walk',
      title: 'Ginza Michelin Culinary Walk',
      destinationId: 'dest-tokyo',
      destination: 'Tokyo',
      hubId: 'hub-ginza',
      hubName: 'Ginza & Marunouchi',
      category: 'Food & Dining',
      status: 'ACTIVE',
      validFrom: '2026-01-01',
      validTo: '2026-12-31',
      basePrice: 25000,
      currency: 'JPY',
      rates: [{ id: 'r1', name: 'Standard', netPrice: 25000 }]
    } as any,
    {
      id: 'prod-tokyo-shinkansen',
      sku: 'TYO-RAIL-002',
      name: 'Tokyo to Kyoto Gran Class Shinkansen',
      title: 'Tokyo to Kyoto Gran Class Shinkansen',
      destinationId: 'dest-tokyo',
      destination: 'Tokyo',
      hubId: 'hub-ginza',
      fromHubId: 'hub-ginza',
      toHubId: 'hub-gion',
      category: 'Rail & Bullet Trains',
      status: 'ACTIVE',
      validFrom: '2026-01-01',
      validTo: '2026-12-31',
      basePrice: 32000,
      currency: 'JPY',
      rates: [{ id: 'r2', name: 'Gran Class', netPrice: 32000 }]
    } as any,
    {
      id: 'prod-kyoto-tea',
      sku: 'KYO-TEA-001',
      name: 'Gion Private Geisha Tea Ceremony',
      title: 'Gion Private Geisha Tea Ceremony',
      destinationId: 'dest-kyoto',
      destination: 'Kyoto',
      hubId: 'hub-gion',
      hubName: 'Gion & Higashiyama',
      category: 'Cultural Experiences',
      status: 'ACTIVE',
      validFrom: '2026-04-01',
      validTo: '2026-10-31', // Not valid in November
      basePrice: 40000,
      currency: 'JPY',
      rates: [{ id: 'r3', name: 'Private Ceremony', netPrice: 40000 }]
    } as any
  ];

  const mockHotels: Hotel[] = [
    {
      id: 'hotel-tokyo-capitol',
      name: 'The Capitol Hotel Tokyu',
      destinationId: 'dest-tokyo',
      destination: 'Tokyo',
      cityName: 'Tokyo',
      hubId: 'hub-ginza',
      starRating: 5,
      validFrom: '2026-01-01',
      validTo: '2026-12-31',
      currency: 'JPY',
      startingSellingPrice: 65000,
      roomTypes: [
        {
          id: 'rt-deluxe',
          roomName: 'Deluxe King Room',
          maxOccupancy: 3,
          rates: [
            {
              id: 'rate-bb',
              rateName: 'Bed & Breakfast Rate',
              nightlyNetCost: 50000,
              currency: 'JPY'
            }
          ]
        }
      ]
    } as any,
    {
      id: 'hotel-kyoto-hoshinoya',
      name: 'Hoshinoya Kyoto',
      destinationId: 'dest-kyoto',
      destination: 'Kyoto',
      cityName: 'Kyoto',
      hubId: 'hub-gion',
      starRating: 5,
      validFrom: '2026-01-01',
      validTo: '2026-08-31', // Expired for late 2026
      currency: 'JPY',
      startingSellingPrice: 120000,
      roomTypes: [
        {
          id: 'rt-pavilion',
          roomName: 'Riverside Pavilion',
          maxOccupancy: 2,
          rates: [
            {
              id: 'rate-kaiseki',
              rateName: 'Half Board Kaiseki',
              nightlyNetCost: 100000,
              currency: 'JPY'
            }
          ]
        }
      ]
    } as any
  ];

  // TEST 1: Destination filtering in Products Search
  try {
    const tokyoResults = inventoryDiscoveryService.searchProducts(
      { destinationId: 'dest-tokyo' },
      mockProducts
    );
    if (tokyoResults.totalCount === 2 && tokyoResults.items.every(p => p.destinationId === 'dest-tokyo')) {
      results.push({ test: 'Product Search by Destination', status: 'PASS' });
    } else {
      results.push({ test: 'Product Search by Destination', status: 'FAIL', message: `Expected 2 Tokyo products, got ${tokyoResults.totalCount}` });
    }
  } catch (err: any) {
    results.push({ test: 'Product Search by Destination', status: 'FAIL', message: err.message });
  }

  // TEST 2: Cascading Hub filtering in Products Search
  try {
    const ginzaResults = inventoryDiscoveryService.searchProducts(
      { destinationId: 'dest-tokyo', hubId: 'hub-ginza' },
      mockProducts
    );
    if (ginzaResults.totalCount === 2) {
      results.push({ test: 'Product Search by Cascading Hub', status: 'PASS' });
    } else {
      results.push({ test: 'Product Search by Cascading Hub', status: 'FAIL', message: `Expected 2 Ginza products, got ${ginzaResults.totalCount}` });
    }
  } catch (err: any) {
    results.push({ test: 'Product Search by Cascading Hub', status: 'FAIL', message: err.message });
  }

  // TEST 3: Category filtering in Products Search
  try {
    const foodResults = inventoryDiscoveryService.searchProducts(
      { category: 'Food & Dining' },
      mockProducts
    );
    if (foodResults.totalCount === 1 && foodResults.items[0].id === 'prod-tokyo-food') {
      results.push({ test: 'Product Search by Category', status: 'PASS' });
    } else {
      results.push({ test: 'Product Search by Category', status: 'FAIL', message: `Expected 1 Food product, got ${foodResults.totalCount}` });
    }
  } catch (err: any) {
    results.push({ test: 'Product Search by Category', status: 'FAIL', message: err.message });
  }

  // TEST 4: Date Validity filtering in Products Search
  try {
    // 2026-11-15 is after validTo (2026-10-31) for Kyoto Tea Ceremony
    const novResults = inventoryDiscoveryService.searchProducts(
      { date: '2026-11-15' },
      mockProducts
    );
    const hasKyotoTea = novResults.items.some(p => p.id === 'prod-kyoto-tea');
    if (!hasKyotoTea && novResults.totalCount === 2) {
      results.push({ test: 'Product Search Date Validity Exclusion', status: 'PASS' });
    } else {
      results.push({ test: 'Product Search Date Validity Exclusion', status: 'FAIL', message: 'Kyoto Tea should be excluded on 2026-11-15 due to inventory validity' });
    }
  } catch (err: any) {
    results.push({ test: 'Product Search Date Validity Exclusion', status: 'FAIL', message: err.message });
  }

  // TEST 5: Hotel Search Validation - Check-out must be strictly after Check-in
  try {
    let threw = false;
    try {
      inventoryDiscoveryService.searchHotels(
        {
          checkInDate: '2026-11-20',
          checkOutDate: '2026-11-18', // invalid
          adults: 2,
          children: 0,
          roomsCount: 1
        },
        mockHotels
      );
    } catch {
      threw = true;
    }

    if (threw) {
      results.push({ test: 'Hotel Stay Dates Strict Validation', status: 'PASS' });
    } else {
      results.push({ test: 'Hotel Stay Dates Strict Validation', status: 'FAIL', message: 'Expected error when check-out is before check-in' });
    }
  } catch (err: any) {
    results.push({ test: 'Hotel Stay Dates Strict Validation', status: 'FAIL', message: err.message });
  }

  // TEST 6: Hotel Search Date Validity and Occupancy
  try {
    const hotelResults = inventoryDiscoveryService.searchHotels(
      {
        checkInDate: '2026-11-20',
        checkOutDate: '2026-11-23',
        adults: 2,
        children: 0,
        roomsCount: 1
      },
      mockHotels
    );
    // Hoshinoya Kyoto validTo is 2026-08-31, so Capitol Hotel should match
    if (hotelResults.totalCount === 1 && hotelResults.items[0].id === 'hotel-tokyo-capitol') {
      results.push({ test: 'Hotel Search Stay Validity and Results', status: 'PASS' });
    } else {
      results.push({ test: 'Hotel Search Stay Validity and Results', status: 'FAIL', message: `Expected 1 hotel (Capitol Hotel), got ${hotelResults.totalCount}` });
    }
  } catch (err: any) {
    results.push({ test: 'Hotel Search Stay Validity and Results', status: 'FAIL', message: err.message });
  }

  // TEST 7: Pagination Mechanics
  try {
    const page1 = inventoryDiscoveryService.searchProducts(
      { page: 1, pageSize: 2 },
      mockProducts
    );
    const page2 = inventoryDiscoveryService.searchProducts(
      { page: 2, pageSize: 2 },
      mockProducts
    );

    if (page1.items.length === 2 && page2.items.length === 1 && page1.hasMore === true && page2.hasMore === false) {
      results.push({ test: 'Inventory Discovery Pagination (Pages & Slices)', status: 'PASS' });
    } else {
      results.push({ test: 'Inventory Discovery Pagination (Pages & Slices)', status: 'FAIL', message: 'Pagination count or slice mismatch' });
    }
  } catch (err: any) {
    results.push({ test: 'Inventory Discovery Pagination (Pages & Slices)', status: 'FAIL', message: err.message });
  }

  // TEST 8: Admin CMS Independence - Admin CMS continues accessing full collections directly
  try {
    const allProds = db.getProducts();
    const allHotels = db.getHotels();
    if (Array.isArray(allProds) && Array.isArray(allHotels)) {
      results.push({ test: 'Admin CMS Direct Inventory Integrity Preserved', status: 'PASS' });
    } else {
      results.push({ test: 'Admin CMS Direct Inventory Integrity Preserved', status: 'FAIL', message: 'Admin db access returned invalid array' });
    }
  } catch (err: any) {
    results.push({ test: 'Admin CMS Direct Inventory Integrity Preserved', status: 'FAIL', message: err.message });
  }

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  return {
    total: results.length,
    passed,
    failed,
    results
  };
}
