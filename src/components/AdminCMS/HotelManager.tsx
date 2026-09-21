import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { Hotel, HotelRoomType, HotelRate, HotelDailyPriceOverride, Destination, MealPlanCode, DestinationRegionItem, CityHub, MasterRegion } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ImageUploadOrUrlInput } from '../ImageUploadOrUrlInput';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { EntitySEOSettingsTab } from './EntitySEOSettingsTab';
import { 
  Hotel as HotelIcon, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  MapPin, 
  Bed, 
  DollarSign, 
  Calendar as CalendarIcon, 
  Star, 
  Sparkles, 
  Building,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Tag,
  AlertTriangle,
  RotateCcw,
  Layers,
  ArrowRight,
  TrendingUp,
  Percent,
  Sliders,
  Building2,
  Globe2
} from 'lucide-react';

interface HotelManagerProps {
  destinations: Destination[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const HotelManager: React.FC<HotelManagerProps> = ({ destinations }) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const [hotels, setHotels] = useState<Hotel[]>(db.getHotels());
  const [masterRegions, setMasterRegions] = useState<MasterRegion[]>(() => db.getMasterRegions());
  const [regions, setRegions] = useState<DestinationRegionItem[]>(() => db.getRegions());
  const [cityHubs, setCityHubs] = useState<CityHub[]>(() => db.getCityHubs());
  
  // Navigation View: Property Cards vs Dedicated Interactive Calendar Rate Matrix
  const [viewMode, setViewMode] = useState<'HOTELS_LIST' | 'CALENDAR_VIEW'>('HOTELS_LIST');

  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('all');
  const [selectedDestinationFilter, setSelectedDestinationFilter] = useState<string>('all');
  const [selectedCityHubFilter, setSelectedCityHubFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingHotel, setEditingHotel] = useState<Partial<Hotel> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'DETAILS' | 'ROOMS' | 'LOCATION' | 'CALENDAR_PRICING' | 'SEO'>('DETAILS');

  // Calendar View State
  const [calendarHotelId, setCalendarHotelId] = useState<string>(hotels[0]?.id || '');
  const [calendarRoomId, setCalendarRoomId] = useState<string>('');
  const [calendarYear, setCalendarYear] = useState<number>(2026);
  const [calendarMonth, setCalendarMonth] = useState<number>(7); // August 2026

  // Date-wise price override modal state
  const [selectedDateForPrice, setSelectedDateForPrice] = useState<string | null>(null);
  const [overrideSingleNet, setOverrideSingleNet] = useState<number>(0);
  const [overrideDoubleNet, setOverrideDoubleNet] = useState<number>(0);
  const [overrideTripleNet, setOverrideTripleNet] = useState<number>(0);
  const [overrideExtraBed, setOverrideExtraBed] = useState<number>(0);
  const [overrideChild, setOverrideChild] = useState<number>(0);
  const [overrideSeasonLabel, setOverrideSeasonLabel] = useState<string>('Standard Rate');
  const [overrideMealPlan, setOverrideMealPlan] = useState<MealPlanCode>('BB');
  const [overrideIsBlocked, setOverrideIsBlocked] = useState<boolean>(false);
  const [overrideMinNights, setOverrideMinNights] = useState<number>(1);
  const [overrideNotes, setOverrideNotes] = useState<string>('');

  // Bulk date range pricing tool state
  const [isBulkPricingOpen, setIsBulkPricingOpen] = useState(false);
  const [bulkStartDate, setBulkStartDate] = useState('2026-08-01');
  const [bulkEndDate, setBulkEndDate] = useState('2026-08-31');
  const [bulkDaysApply, setBulkDaysApply] = useState<'ALL' | 'WEEKENDS_ONLY' | 'WEEKDAYS_ONLY'>('ALL');
  const [bulkSingleRate, setBulkSingleRate] = useState<number>(550);
  const [bulkDoubleRate, setBulkDoubleRate] = useState<number>(680);
  const [bulkTripleRate, setBulkTripleRate] = useState<number>(820);
  const [bulkExtraBedRate, setBulkExtraBedRate] = useState<number>(120);
  const [bulkChildRate, setBulkChildRate] = useState<number>(60);
  const [bulkSeasonLabel, setBulkSeasonLabel] = useState<string>('Peak Season Surcharge');
  const [bulkMealPlan, setBulkMealPlan] = useState<MealPlanCode>('BB');

  // Success alert badge
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    return db.subscribe(() => {
      const updatedHotels = db.getHotels();
      setHotels(updatedHotels);
      setMasterRegions(db.getMasterRegions());
      setRegions(db.getRegions());
      setCityHubs(db.getCityHubs());
      if (!calendarHotelId && updatedHotels.length > 0) {
        setCalendarHotelId(updatedHotels[0].id);
      }
    });
  }, [calendarHotelId]);

  // Set default calendar room when hotel changes
  useEffect(() => {
    const currentHotel = hotels.find(h => h.id === calendarHotelId) || hotels[0];
    if (currentHotel && currentHotel.roomTypes && (currentHotel.roomTypes || []).length > 0) {
      if (!calendarRoomId || !currentHotel.roomTypes.some(r => r.id === calendarRoomId)) {
        setCalendarRoomId(currentHotel.roomTypes[0]?.id || '');
      }
    }
  }, [calendarHotelId, hotels, calendarRoomId]);

  const showNotification = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  const availableDestinationsForFilter = selectedRegionFilter === 'all'
    ? destinations
    : destinations.filter(d => d.regionId === selectedRegionFilter);

  const availableHubsForFilter = cityHubs.filter(h => {
    const matchesReg = selectedRegionFilter === 'all' || h.regionId === selectedRegionFilter;
    const matchesDest = selectedDestinationFilter === 'all' || h.destinationId === selectedDestinationFilter;
    return matchesReg && matchesDest;
  });

  const filteredHotels = hotels.filter(h => {
    const targetDest = destinations.find(d => d.id === selectedDestinationFilter || d.slug === selectedDestinationFilter);
    const matchesReg = selectedRegionFilter === 'all' || 
                       h.regionId === selectedRegionFilter ||
                       (targetDest && targetDest.regionId === selectedRegionFilter);
    const matchesDest = selectedDestinationFilter === 'all' || 
                        h.destinationId === selectedDestinationFilter ||
                        (targetDest && (h.destinationId === targetDest.id || h.destinationId === targetDest.slug || h.country.toLowerCase() === targetDest.name.toLowerCase()));
    const matchesHub = selectedCityHubFilter === 'all' || 
                       h.hubId === selectedCityHubFilter || 
                       h.cityId === selectedCityHubFilter ||
                       h.cityName.toLowerCase() === selectedCityHubFilter.toLowerCase();
    const matchesSearch = h.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          h.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          h.cityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (h.regionName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (h.destinationName || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesReg && matchesDest && matchesHub && matchesSearch;
  });

  const activeCalendarHotel = hotels.find(h => h.id === calendarHotelId) || hotels[0];
  const activeCalendarRoom = activeCalendarHotel?.roomTypes.find(r => r.id === calendarRoomId) || activeCalendarHotel?.roomTypes[0];
  const baseRate = activeCalendarRoom?.rates[0] || {
    singleNetRate: 450,
    doubleNetRate: 550,
    tripleNetRate: 680,
    extraBedRate: 100,
    childRate: 50,
    mealPlan: 'BB' as MealPlanCode,
    mealPlanName: 'Breakfast Included',
    markupPercent: 18,
    taxPercent: 10,
    feePercent: 2.5,
    currency: 'USD'
  };

  const handleOpenAdd = () => {
    const firstReg = masterRegions[0] || { id: 'reg-asia', name: 'Asia', code: 'ASIA' };
    const matchingDests = destinations.filter(d => !firstReg.id || d.regionId === firstReg.id);
    const firstDest = matchingDests[0] || destinations[0] || { id: 'dest-japan', name: 'Japan', regionId: firstReg.id };
    const matchingHubs = cityHubs.filter(h => h.destinationId === firstDest.id);
    const firstHub = matchingHubs[0];

    const defaultRoom: HotelRoomType = {
      id: `room-${Date.now()}-1`,
      roomName: 'Deluxe Room',
      roomCategory: 'Deluxe',
      description: 'Spacious modern luxury room with premium amenities and en-suite marble bath.',
      images: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800&auto=format&fit=crop'],
      bedType: 'King Size Bed',
      numberOfBeds: 1,
      roomSizeSqMeters: 45,
      maxAdults: 2,
      maxChildren: 1,
      maxOccupancy: 3,
      extraBedAvailable: true,
      childPolicy: 'Children under 6 stay free sharing existing bedding.',
      amenities: ['High Speed Wi-Fi', 'Marble Bath', 'Bespoke Bathrobes', 'Nespresso Coffee Bar'],
      view: 'City Skyline',
      cancellationPolicy: 'Free cancellation up to 7 days prior to check-in.',
      rates: [
        {
          id: `rate-${Date.now()}-1`,
          mealPlan: 'BB',
          mealPlanName: 'Gourmet Buffet Breakfast Included',
          singleNetRate: 350,
          doubleNetRate: 420,
          tripleNetRate: 520,
          extraBedRate: 90,
          childRate: 45,
          markupPercent: 18,
          taxPercent: 10,
          feePercent: 2.5,
          currency: 'USD',
          validityFrom: '2026-01-01',
          validityTo: '2026-12-31'
        }
      ]
    };

    setEditingHotel({
      id: `hotel-${Date.now()}`,
      name: '',
      code: `HTL-${Date.now().toString().slice(-4)}`,
      regionId: firstReg.id,
      regionName: firstReg.name,
      destinationId: firstDest.id,
      destinationName: firstDest.name,
      hubId: firstHub?.id || '',
      cityId: firstHub?.id || 'tokyo',
      cityName: firstHub?.name || 'Tokyo',
      country: firstDest.name,
      area: 'Central District',
      starRating: 5,
      propertyType: 'LUXURY_HOTEL',
      shortDescription: '',
      description: '',
      heroImage: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=1200&auto=format&fit=crop',
      images: ['https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=1200&auto=format&fit=crop'],
      website: '',
      address: '',
      locationDetails: {
        airportName: 'International Airport',
        airportDistanceKm: 25,
        airportTransferTimeMins: 35,
        railwayStationName: 'Central Railway Station',
        railwayDistanceKm: 1.5,
        walkingDistanceMins: 15,
        metroStationName: 'Central Metro',
        nearbyAttractions: ['Heritage Temples', 'Shopping Promenade']
      },
      roomTypes: [defaultRoom],
      amenities: ['24/7 Butler Service', 'Michelin-starred Dining', 'Wellness Spa', 'Chauffeured Fleet'],
      blackoutDates: [],
      dailyRateOverrides: {},
      status: 'PUBLISHED',
      startingNetPrice: 350,
      currency: 'USD'
    });
    setActiveSubTab('DETAILS');
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHotel || !editingHotel.name || !editingHotel.destinationId) return;

    const targetDest = destinations.find(d => d.id === editingHotel.destinationId);
    const targetReg = masterRegions.find(r => r.id === (editingHotel.regionId || targetDest?.regionId));
    const targetHub = cityHubs.find(h => h.id === editingHotel.hubId);
    
    // Compute starting price per night from lowest room double net rate
    let lowestNet = editingHotel.startingNetPrice || 0;
    if (editingHotel.roomTypes && (editingHotel.roomTypes || []).length > 0) {
      const roomNets = (editingHotel.roomTypes || []).flatMap(r => (r.rates || []).map(rate => rate.doubleNetRate || rate.singleNetRate)).filter(p => p > 0);
      if (roomNets.length > 0) {
        lowestNet = Math.min(...roomNets);
      }
    }

    const completeHotel: Hotel = {
      id: editingHotel.id || `hotel-${Date.now()}`,
      name: editingHotel.name,
      code: editingHotel.code || `HTL-${Date.now().toString().slice(-4)}`,
      destinationId: editingHotel.destinationId,
      destinationName: targetDest?.name || editingHotel.destinationName || 'Destination',
      regionId: targetReg?.id || editingHotel.regionId || '',
      regionName: targetReg?.name || editingHotel.regionName || '',
      hubId: editingHotel.hubId || targetHub?.id || '',
      cityId: editingHotel.hubId || editingHotel.cityId || 'central',
      cityName: editingHotel.cityName || targetHub?.name || 'Capital City',
      country: editingHotel.country || targetDest?.name || 'Country',
      area: editingHotel.area || 'Downtown',
      starRating: Number(editingHotel.starRating || 5),
      propertyType: editingHotel.propertyType || 'LUXURY_HOTEL',
      shortDescription: editingHotel.shortDescription || '',
      description: editingHotel.description || '',
      heroImage: editingHotel.heroImage || 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=1200&auto=format&fit=crop',
      images: editingHotel.images || [],
      website: editingHotel.website || '',
      googleMapsUrl: editingHotel.googleMapsUrl || '',
      address: editingHotel.address || '',
      latitude: Number(editingHotel.latitude || 35.6762),
      longitude: Number(editingHotel.longitude || 139.6503),
      locationDetails: editingHotel.locationDetails || {
        airportName: 'Main International Airport',
        airportDistanceKm: 20,
        airportTransferTimeMins: 30,
        railwayStationName: 'Central Station',
        railwayDistanceKm: 2,
        walkingDistanceMins: 5,
        metroStationName: 'City Center Metro',
        nearbyAttractions: ['City Center', 'Historic District']
      },
      roomTypes: editingHotel.roomTypes || [],
      amenities: Array.isArray(editingHotel.amenities) ? editingHotel.amenities : [],
      blackoutDates: editingHotel.blackoutDates || [],
      dailyRateOverrides: editingHotel.dailyRateOverrides || {},
      slug: (editingHotel as any).slug || editingHotel.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      seo: editingHotel.seo,
      status: editingHotel.status || 'PUBLISHED',
      startingNetPrice: lowestNet,
      currency: editingHotel.currency || 'USD',
      createdAt: editingHotel.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.saveHotel(completeHotel, user);
    showNotification(`Saved hotel property: ${completeHotel.name} with updated per-night room pricing.`);
    setIsEditing(false);
    setEditingHotel(null);
  };

  const handleDelete = (id: string) => {
    const target = (hotels || []).find(h => h.id === id) || (editingHotel?.id === id ? editingHotel : null);
    const hotelName = target?.name || 'Hotel Property';
    setDeleteTarget({ id, name: hotelName });
  };

  // Add room type
  const handleAddRoomType = () => {
    if (!editingHotel) return;
    const newRoom: HotelRoomType = {
      id: `room-${Date.now()}`,
      roomName: 'Executive Suite',
      roomCategory: 'Suite',
      description: 'Exclusive suite with panoramic views and separate living lounge.',
      images: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800&auto=format&fit=crop'],
      bedType: 'Super King Bed',
      numberOfBeds: 1,
      roomSizeSqMeters: 65,
      maxAdults: 3,
      maxChildren: 2,
      maxOccupancy: 4,
      extraBedAvailable: true,
      childPolicy: 'Children stay complimentary under 6 years.',
      amenities: ['Lounge Access', 'Butler Dispatch', 'Marble Tub'],
      view: 'Panoramic City View',
      cancellationPolicy: 'Free cancellation up to 72 hours prior to arrival.',
      rates: [
        {
          id: `rate-${Date.now()}`,
          mealPlan: 'BB',
          mealPlanName: 'Kaiseki Breakfast Included',
          singleNetRate: 650,
          doubleNetRate: 750,
          tripleNetRate: 900,
          extraBedRate: 150,
          childRate: 75,
          markupPercent: 18,
          taxPercent: 10,
          feePercent: 2.5,
          currency: editingHotel.currency || 'USD',
          validityFrom: '2026-01-01',
          validityTo: '2026-12-31'
        }
      ]
    };

    setEditingHotel({
      ...editingHotel,
      roomTypes: [...(editingHotel.roomTypes || []), newRoom]
    });
  };

  // Calendar pricing: Open single-date price editor
  const handleOpenDatePriceEditor = (dateStr: string) => {
    if (!activeCalendarHotel || !activeCalendarRoom) return;

    setSelectedDateForPrice(dateStr);
    const key = `${activeCalendarRoom.id}_${dateStr}`;
    const hotelOverride = activeCalendarHotel.dailyRateOverrides?.[key] || activeCalendarHotel.dailyRateOverrides?.[dateStr];
    const roomOverride = activeCalendarRoom.dailyRateOverrides?.[dateStr];
    const existing = roomOverride || hotelOverride;

    const baseDbl = baseRate?.doubleNetRate || 500;
    const baseSgl = baseRate?.singleNetRate || 420;
    const baseTrp = baseRate?.tripleNetRate || 620;
    const baseBed = baseRate?.extraBedRate || 100;
    const baseChd = baseRate?.childRate || 50;

    if (existing) {
      setOverrideSingleNet(existing.singleNetRate);
      setOverrideDoubleNet(existing.doubleNetRate);
      setOverrideTripleNet(existing.tripleNetRate || baseTrp);
      setOverrideExtraBed(existing.extraBedRate || baseBed);
      setOverrideChild(existing.childRate || baseChd);
      setOverrideSeasonLabel(existing.seasonLabel || 'Custom Daily Price');
      setOverrideMealPlan(existing.mealPlan || baseRate.mealPlan);
      setOverrideIsBlocked(!!existing.isBlocked);
      setOverrideMinNights(existing.minNights || 1);
      setOverrideNotes(existing.notes || '');
    } else {
      // Check if it's weekend (Fri or Sat)
      const dayOfWeek = new Date(dateStr).getDay();
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

      setOverrideSingleNet(isWeekend ? Math.round(baseSgl * 1.15) : baseSgl);
      setOverrideDoubleNet(isWeekend ? Math.round(baseDbl * 1.15) : baseDbl);
      setOverrideTripleNet(isWeekend ? Math.round(baseTrp * 1.15) : baseTrp);
      setOverrideExtraBed(baseBed);
      setOverrideChild(baseChd);
      setOverrideSeasonLabel(isWeekend ? 'Weekend Surcharge (+15%)' : 'Standard Rate');
      setOverrideMealPlan(baseRate.mealPlan);
      setOverrideIsBlocked(false);
      setOverrideMinNights(1);
      setOverrideNotes('');
    }
  };

  // Save single date price override
  const handleSaveDatePriceOverride = () => {
    if (!selectedDateForPrice || !activeCalendarHotel || !activeCalendarRoom) return;

    const key = `${activeCalendarRoom.id}_${selectedDateForPrice}`;
    const overrideObj: HotelDailyPriceOverride = {
      date: selectedDateForPrice,
      roomTypeId: activeCalendarRoom.id,
      singleNetRate: Number(overrideSingleNet),
      doubleNetRate: Number(overrideDoubleNet),
      tripleNetRate: Number(overrideTripleNet),
      extraBedRate: Number(overrideExtraBed),
      childRate: Number(overrideChild),
      mealPlan: overrideMealPlan,
      seasonLabel: overrideSeasonLabel,
      isBlocked: overrideIsBlocked,
      minNights: Number(overrideMinNights),
      notes: overrideNotes
    };

    const updatedHotel: Hotel = {
      ...activeCalendarHotel,
      dailyRateOverrides: {
        ...(activeCalendarHotel.dailyRateOverrides || {}),
        [key]: overrideObj
      },
      updatedAt: new Date().toISOString()
    };

    db.saveHotel(updatedHotel, user);
    showNotification(`Updated nightly price for ${activeCalendarRoom.roomName} on ${selectedDateForPrice} (${activeCalendarHotel.currency} ${overrideDoubleNet}/night)`);
    setSelectedDateForPrice(null);
  };

  // Reset / remove override for single date
  const handleResetDatePrice = (dateStr: string) => {
    if (!activeCalendarHotel || !activeCalendarRoom) return;
    const key = `${activeCalendarRoom.id}_${dateStr}`;
    const newOverrides = { ...(activeCalendarHotel.dailyRateOverrides || {}) };
    delete newOverrides[key];
    delete newOverrides[dateStr];

    const updatedHotel: Hotel = {
      ...activeCalendarHotel,
      dailyRateOverrides: newOverrides,
      updatedAt: new Date().toISOString()
    };

    db.saveHotel(updatedHotel, user);
    showNotification(`Reset ${dateStr} to standard room rate.`);
    setSelectedDateForPrice(null);
  };

  // Bulk Apply Prices across Date Range
  const handleApplyBulkPricing = () => {
    if (!activeCalendarHotel || !activeCalendarRoom || !bulkStartDate || !bulkEndDate) return;

    const start = new Date(bulkStartDate);
    const end = new Date(bulkEndDate);

    if (start > end) {
      alert('Start date must be before or equal to End date.');
      return;
    }

    const newOverrides = { ...(activeCalendarHotel.dailyRateOverrides || {}) };
    let countApplied = 0;

    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat

      let shouldApply = true;
      if (bulkDaysApply === 'WEEKENDS_ONLY' && dayOfWeek !== 5 && dayOfWeek !== 6) {
        shouldApply = false;
      } else if (bulkDaysApply === 'WEEKDAYS_ONLY' && (dayOfWeek === 5 || dayOfWeek === 6)) {
        shouldApply = false;
      }

      if (shouldApply) {
        const key = `${activeCalendarRoom.id}_${dateStr}`;
        newOverrides[key] = {
          date: dateStr,
          roomTypeId: activeCalendarRoom.id,
          singleNetRate: Number(bulkSingleRate),
          doubleNetRate: Number(bulkDoubleRate),
          tripleNetRate: Number(bulkTripleRate),
          extraBedRate: Number(bulkExtraBedRate),
          childRate: Number(bulkChildRate),
          mealPlan: bulkMealPlan,
          seasonLabel: bulkSeasonLabel,
          isBlocked: false,
          minNights: 1
        };
        countApplied++;
      }

      current.setDate(current.getDate() + 1);
    }

    const updatedHotel: Hotel = {
      ...activeCalendarHotel,
      dailyRateOverrides: newOverrides,
      updatedAt: new Date().toISOString()
    };

    db.saveHotel(updatedHotel, user);
    showNotification(`Successfully applied ${bulkSeasonLabel} (${activeCalendarHotel.currency} ${bulkDoubleRate}/night) to ${countApplied} calendar dates.`);
    setIsBulkPricingOpen(false);
  };

  // Quick action: Apply Weekend +15% Surcharge for the currently viewed month
  const handleApplyWeekendSurchargeForMonth = () => {
    if (!activeCalendarHotel || !activeCalendarRoom) return;

    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const newOverrides = { ...(activeCalendarHotel.dailyRateOverrides || {}) };
    let weekendsCount = 0;

    const baseDbl = baseRate?.doubleNetRate || 500;
    const baseSgl = baseRate?.singleNetRate || 420;
    const baseTrp = baseRate?.tripleNetRate || 620;
    const baseBed = baseRate?.extraBedRate || 100;
    const baseChd = baseRate?.childRate || 50;

    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(calendarMonth + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${calendarYear}-${monthStr}-${dayStr}`;
      const d = new Date(calendarYear, calendarMonth, day);
      const dayOfWeek = d.getDay();

      if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday or Saturday
        const key = `${activeCalendarRoom.id}_${dateStr}`;
        newOverrides[key] = {
          date: dateStr,
          roomTypeId: activeCalendarRoom.id,
          singleNetRate: Math.round(baseSgl * 1.15),
          doubleNetRate: Math.round(baseDbl * 1.15),
          tripleNetRate: Math.round(baseTrp * 1.15),
          extraBedRate: baseBed,
          childRate: baseChd,
          mealPlan: baseRate.mealPlan,
          seasonLabel: 'Weekend Surcharge (+15%)',
          isBlocked: false
        };
        weekendsCount++;
      }
    }

    const updatedHotel: Hotel = {
      ...activeCalendarHotel,
      dailyRateOverrides: newOverrides,
      updatedAt: new Date().toISOString()
    };

    db.saveHotel(updatedHotel, user);
    showNotification(`Applied +15% Weekend Surcharge to ${weekendsCount} weekend dates in ${MONTH_NAMES[calendarMonth]} ${calendarYear}.`);
  };

  // Calendar Math
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Success Notification Alert */}
      {actionSuccessMsg && (
        <div className="bg-emerald-900 text-emerald-100 px-4 py-3 rounded-2xl border border-emerald-700 shadow-md flex items-center justify-between text-xs font-bold animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#00C6A6]" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-300 hover:text-white">✕</button>
        </div>
      )}

      {/* Header & Primary Navigation Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider mb-1">
            <HotelIcon className="w-4 h-4" />
            <span>Accommodations & Daily Nightly Rate Control</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-sans text-slate-900">
            Hotels & Per-Night Rates Manager
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure luxury hotel properties, per-night room costs (Single, Double, Triple, Extra Bed), contracted meal plans, and date-wise daily calendar prices.
          </p>
        </div>

        {/* View Mode Switcher + Add Hotel Action */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              onClick={() => setViewMode('HOTELS_LIST')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'HOTELS_LIST'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Properties List</span>
            </button>
            <button
              onClick={() => setViewMode('CALENDAR_VIEW')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                viewMode === 'CALENDAR_VIEW'
                  ? 'bg-[#008972] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendar Daily Pricing</span>
            </button>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs text-xs"
          >
            <Plus className="w-4 h-4 text-[#00C6A6]" />
            <span>Add Hotel Property</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: CALENDAR VIEW (ADD & MANAGE DAILY NIGHTLY RATES ON CALENDAR)       */}
      {/* ========================================================================= */}
      {viewMode === 'CALENDAR_VIEW' && (
        <div className="space-y-6">
          {/* Calendar Controls Bar */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Hotel Selector */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Select Hotel Property
                  </label>
                  <select
                    value={calendarHotelId}
                    onChange={e => setCalendarHotelId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-[#00C6A6] cursor-pointer"
                  >
                    {hotels.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.cityName}, {h.destinationName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Room Category Selector */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Room Category
                  </label>
                  <select
                    value={calendarRoomId}
                    onChange={e => setCalendarRoomId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-[#00C6A6] cursor-pointer"
                  >
                    {(activeCalendarHotel?.roomTypes || []).map(r => (
                      <option key={r.id} value={r.id}>
                        {r.roomName} ({r.roomCategory})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Month Navigation & Bulk Pricing Tools */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsBulkPricingOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-700" />
                  <span>Bulk Apply Date Range Pricing</span>
                </button>

                <button
                  onClick={handleApplyWeekendSurchargeForMonth}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors flex items-center space-x-1.5 cursor-pointer"
                  title="Apply +15% Weekend Surcharge to all Fri & Sat in this month"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-[#008972]" />
                  <span>+15% Weekend Surcharge</span>
                </button>

                <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => {
                      if (calendarMonth === 0) {
                        setCalendarMonth(11);
                        setCalendarYear(prev => prev - 1);
                      } else {
                        setCalendarMonth(prev => prev - 1);
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 text-xs font-extrabold text-slate-900 min-w-[120px] text-center font-sans">
                    {MONTH_NAMES[calendarMonth]} {calendarYear}
                  </span>
                  <button
                    onClick={() => {
                      if (calendarMonth === 11) {
                        setCalendarMonth(0);
                        setCalendarYear(prev => prev + 1);
                      } else {
                        setCalendarMonth(prev => prev + 1);
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Room Base Rate Banner */}
            {activeCalendarRoom && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-slate-500">Standard Base Per-Night Contract:</span>
                  <span className="font-mono font-extrabold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    Double Net: {activeCalendarHotel?.currency} {baseRate.doubleNetRate} / night
                  </span>
                  <span className="font-mono text-slate-600 hidden sm:inline">
                    Single: {activeCalendarHotel?.currency} {baseRate.singleNetRate} • Triple: {activeCalendarHotel?.currency} {baseRate.tripleNetRate} • Extra Bed: {activeCalendarHotel?.currency} {baseRate.extraBedRate}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                    Meal Plan: {baseRate.mealPlan}
                  </span>
                  <span>Click any date below to add or edit nightly prices.</span>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Monthly Calendar Grid */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2 text-center">
              {WEEKDAY_NAMES.map(day => (
                <div key={day} className="text-xs font-bold text-slate-400 uppercase tracking-wider py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Day Cells */}
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[95px] rounded-2xl bg-slate-50/50 border border-transparent" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const monthStr = String(calendarMonth + 1).padStart(2, '0');
                const dayStr = String(dayNum).padStart(2, '0');
                const dateString = `${calendarYear}-${monthStr}-${dayStr}`;

                const key = `${activeCalendarRoom?.id}_${dateString}`;
                const hotelOverride = activeCalendarHotel?.dailyRateOverrides?.[key] || activeCalendarHotel?.dailyRateOverrides?.[dateString];
                const roomOverride = activeCalendarRoom?.dailyRateOverrides?.[dateString];
                const override = roomOverride || hotelOverride;

                const dayOfWeek = new Date(calendarYear, calendarMonth, dayNum).getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                // Rate calculation
                const displayDblRate = override ? override.doubleNetRate : baseRate.doubleNetRate;
                const displaySglRate = override ? override.singleNetRate : baseRate.singleNetRate;
                const seasonLabel = override?.seasonLabel || (isWeekend ? 'Weekend Standard' : 'Base Contract');
                const isBlocked = !!override?.isBlocked;
                const isCustomOverride = !!override;

                let cellBg = 'bg-white border-slate-200 hover:border-[#008972]';
                let tagBg = 'bg-slate-100 text-slate-700';

                if (isBlocked) {
                  cellBg = 'bg-rose-50/80 border-rose-200 hover:border-rose-400';
                  tagBg = 'bg-rose-100 text-rose-800 font-bold';
                } else if (isCustomOverride) {
                  cellBg = 'bg-emerald-50/80 border-emerald-300 hover:border-emerald-500 shadow-2xs';
                  tagBg = 'bg-emerald-100 text-emerald-800 font-bold';
                } else if (isWeekend) {
                  cellBg = 'bg-amber-50/40 border-amber-200 hover:border-amber-400';
                  tagBg = 'bg-amber-100 text-amber-800';
                }

                return (
                  <button
                    key={dateString}
                    type="button"
                    onClick={() => handleOpenDatePriceEditor(dateString)}
                    className={`min-h-[95px] p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer hover:shadow-md ${cellBg}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-slate-900">{dayNum}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded truncate max-w-[80px] ${tagBg}`}>
                        {isBlocked ? 'Blocked' : seasonLabel}
                      </span>
                    </div>

                    {!isBlocked ? (
                      <div className="mt-1 space-y-0.5">
                        <div className="text-xs font-extrabold text-slate-900 font-mono">
                          {activeCalendarHotel?.currency} {displayDblRate}
                          <span className="text-[9px] font-normal text-slate-500"> /nt</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Sgl: {displaySglRate}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-rose-600 font-bold mt-1">
                        Sold Out / Blocked
                      </div>
                    )}

                    <div className="text-[9px] text-slate-400 text-right mt-auto flex items-center justify-between">
                      <span className="text-[8px] font-mono uppercase text-slate-400">{override?.mealPlan || baseRate.mealPlan}</span>
                      <span>Edit</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-white border border-slate-300"></span>
                  <span>Base Contract Rate</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span>
                  <span>Custom Calendar Price Added</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></span>
                  <span>Weekend / Surcharge</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3 h-3 rounded bg-rose-100 border border-rose-300"></span>
                  <span>Blackout / Blocked</span>
                </div>
              </div>

              <div className="text-slate-500 font-medium">
                💡 Tip: Click any date to add or edit nightly per-room rates.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: HOTELS LIST (OVERVIEW OF PROPERTIES WITH PER-NIGHT COSTS)          */}
      {/* ========================================================================= */}
      {viewMode === 'HOTELS_LIST' && (
        <div className="space-y-6">
          {/* Filter & Search */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-xs">
            <div className="relative md:col-span-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search hotel name, code, region, city..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:border-[#00C6A6]"
              />
            </div>
            <div>
              <select
                value={selectedRegionFilter}
                onChange={e => {
                  setSelectedRegionFilter(e.target.value);
                  setSelectedDestinationFilter('all');
                  setSelectedCityHubFilter('all');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
              >
                <option value="all">1. All Master Regions ({masterRegions.length})</option>
                {masterRegions.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={selectedDestinationFilter}
                onChange={e => {
                  setSelectedDestinationFilter(e.target.value);
                  setSelectedCityHubFilter('all');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
              >
                <option value="all">2. All Destinations ({availableDestinationsForFilter.length})</option>
                {availableDestinationsForFilter.map(d => (
                  <option key={d.id} value={d.id}>{d.name} {d.regionName ? `(${d.regionName})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={selectedCityHubFilter}
                onChange={e => setSelectedCityHubFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
              >
                <option value="all">3. All City Hubs ({availableHubsForFilter.length})</option>
                {availableHubsForFilter.map(h => (
                  <option key={h.id} value={h.id}>{h.name} {h.destinationName ? `(${h.destinationName})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Hotel Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHotels.map(hotel => {
              const maxRoomOccupancy = Math.max(...(hotel.roomTypes.map(r => r.maxOccupancy || (r.maxAdults + r.maxChildren) || 3)), 3);
              const maxChildrenAllowed = Math.max(...(hotel.roomTypes.map(r => r.maxChildren ?? 2)), 2);
              const maxChildAge = Math.max(...(hotel.roomTypes.map(r => r.maxChildAge ?? 12)), 12);

              return (
                <div key={hotel.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between group">
                  <div>
                    <div className="relative h-48 overflow-hidden bg-slate-100">
                      <img 
                        src={hotel.heroImage} 
                        alt={hotel.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                      <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-xl flex items-center space-x-1.5 shadow-sm">
                        <MapPin className="w-3.5 h-3.5 text-[#00C6A6]" />
                        <span>{hotel.cityName}, {hotel.destinationName}</span>
                        {hotel.regionName && (
                          <span className="text-[10px] bg-[#00C6A6]/20 text-[#00E5C0] px-1.5 py-0.2 rounded ml-1">
                            {hotel.regionName}
                          </span>
                        )}
                      </div>
                      <div className="absolute top-3 right-3 bg-[#008972] text-white text-[10px] font-extrabold px-2.5 py-1 rounded-xl uppercase tracking-wider shadow-sm">
                        {(hotel.propertyType || 'HOTEL').replace('_', ' ')}
                      </div>
                      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm text-amber-500 text-xs font-bold px-2.5 py-1 rounded-xl flex items-center space-x-1 shadow-sm">
                        {[...Array(hotel.starRating)].map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                        ))}
                        <span className="ml-1.5 text-slate-700 font-mono text-[11px] font-bold">{hotel.code}</span>
                      </div>
                    </div>

                    <div className="p-5 space-y-3.5">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 line-clamp-1 group-hover:text-[#008972] transition-colors">
                          {hotel.name}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {hotel.shortDescription || hotel.description}
                        </p>
                      </div>

                      {/* Smart Passenger & Room Capacity Badge */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center space-x-1">
                          <Bed className="w-3 h-3 text-slate-500" />
                          <span>{hotel.roomTypes?.length || 0} Room Categories</span>
                        </span>
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-[10px] font-bold px-2 py-1 rounded-lg">
                          Max {maxRoomOccupancy} Pax / Room (Kids ≤ {maxChildAge}y)
                        </span>
                      </div>

                      {/* Room Rates Breakdown */}
                      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Status:</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            hotel.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {hotel.status}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
                          <span className="text-slate-500 font-medium">Per-Night Net Starting Rate:</span>
                          <span className="font-extrabold text-[#008972] font-mono text-sm">
                            {hotel.currency} {hotel.startingNetPrice} <span className="text-[10px] font-normal text-slate-500">/ night</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* High-Visibility Card CTA Section */}
                  <div className="p-4 bg-slate-50/80 border-t border-slate-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setCalendarHotelId(hotel.id);
                          if (hotel.roomTypes[0]) {
                            setCalendarRoomId(hotel.roomTypes[0].id);
                          }
                          setViewMode('CALENDAR_VIEW');
                        }}
                        className="w-full flex items-center justify-center space-x-1.5 bg-[#008972] hover:bg-[#007460] text-white py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                      >
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span>Rates & Calendar</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingHotel(hotel);
                          setIsEditing(true);
                        }}
                        className="w-full flex items-center justify-center space-x-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        <Edit className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit Property</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                      {hotel.dailyRateOverrides && Object.keys(hotel.dailyRateOverrides).length > 0 ? (
                        <span className="text-[10px] font-bold text-[#008972] flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{Object.keys(hotel.dailyRateOverrides).length} Active Daily Overrides</span>
                        </span>
                      ) : (
                        <span className="text-[10px]">Standard contract tariff</span>
                      )}

                      <button
                        onClick={() => handleDelete(hotel.id)}
                        className="text-red-600 hover:text-red-800 text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SINGLE DATE PRICE OVERRIDE & NIGHTLY COST EDITOR                 */}
      {/* ========================================================================= */}
      {selectedDateForPrice && activeCalendarHotel && activeCalendarRoom && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#008972] block">
                  Calendar Daily Rate Override
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedDateForPrice} — {activeCalendarRoom.roomName}
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Property: {activeCalendarHotel.name}
                </span>
              </div>
              <button onClick={() => setSelectedDateForPrice(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Rate Label / Season */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Season / Rate Title</label>
                <input
                  type="text"
                  value={overrideSeasonLabel}
                  onChange={e => setOverrideSeasonLabel(e.target.value)}
                  placeholder="e.g. Cherry Blossom Peak Season, Summer Festival, Weekend Surcharge"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              {/* Per Night Net Rates Matrix */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Per-Night Net Room Rates ({activeCalendarHotel.currency})
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Double Net / Night *</span>
                    <input
                      type="number"
                      required
                      value={overrideDoubleNet}
                      onChange={e => setOverrideDoubleNet(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Single Net / Night</span>
                    <input
                      type="number"
                      value={overrideSingleNet}
                      onChange={e => setOverrideSingleNet(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Triple Net / Night</span>
                    <input
                      type="number"
                      value={overrideTripleNet}
                      onChange={e => setOverrideTripleNet(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Extra Bed Net / Night</span>
                    <input
                      type="number"
                      value={overrideExtraBed}
                      onChange={e => setOverrideExtraBed(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold font-mono text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Meal Plan & Block Toggle */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Meal Plan</label>
                  <select
                    value={overrideMealPlan}
                    onChange={e => setOverrideMealPlan(e.target.value as MealPlanCode)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
                  >
                    <option value="RO">RO (Room Only)</option>
                    <option value="BB">BB (Bed & Breakfast)</option>
                    <option value="HB">HB (Half Board / MAP)</option>
                    <option value="FB">FB (Full Board / AP)</option>
                    <option value="AI">AI (All Inclusive)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Availability Status</label>
                  <button
                    type="button"
                    onClick={() => setOverrideIsBlocked(!overrideIsBlocked)}
                    className={`w-full p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer text-center ${
                      overrideIsBlocked
                        ? 'bg-rose-100 text-rose-900 border-rose-300'
                        : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    }`}
                  >
                    {overrideIsBlocked ? '🚫 Blocked / Sold Out' : '✓ Open for Booking'}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleResetDatePrice(selectedDateForPrice)}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
              >
                Reset to Standard Base Rate
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedDateForPrice(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDatePriceOverride}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#008972] text-white hover:bg-[#00C6A6] cursor-pointer shadow-xs"
                >
                  Save Nightly Price
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BULK DATE RANGE PRICING TOOL                                      */}
      {/* ========================================================================= */}
      {isBulkPricingOpen && activeCalendarHotel && activeCalendarRoom && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#008972] block">
                  Bulk Rate Applicator
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Set Date Range Prices for {activeCalendarRoom.roomName}
                </h3>
              </div>
              <button onClick={() => setIsBulkPricingOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Date Range Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={bulkStartDate}
                    onChange={e => setBulkStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={bulkEndDate}
                    onChange={e => setBulkEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Days Filter */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Apply To Days:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'ALL', label: 'All Days' },
                    { id: 'WEEKENDS_ONLY', label: 'Weekends Only (Fri-Sat)' },
                    { id: 'WEEKDAYS_ONLY', label: 'Weekdays Only (Sun-Thu)' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setBulkDaysApply(tab.id as any)}
                      className={`p-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        bulkDaysApply === tab.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Season Label */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rate Season Label</label>
                <input
                  type="text"
                  value={bulkSeasonLabel}
                  onChange={e => setBulkSeasonLabel(e.target.value)}
                  placeholder="e.g. Cherry Blossom High Season"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-bold"
                />
              </div>

              {/* Rates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Double Net / Night *</span>
                  <input
                    type="number"
                    value={bulkDoubleRate}
                    onChange={e => setBulkDoubleRate(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Single Net / Night</span>
                  <input
                    type="number"
                    value={bulkSingleRate}
                    onChange={e => setBulkSingleRate(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Triple Net / Night</span>
                  <input
                    type="number"
                    value={bulkTripleRate}
                    onChange={e => setBulkTripleRate(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Extra Bed Net / Night</span>
                  <input
                    type="number"
                    value={bulkExtraBedRate}
                    onChange={e => setBulkExtraBedRate(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBulkPricingOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyBulkPricing}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#008972] text-white hover:bg-[#00C6A6] cursor-pointer shadow-xs"
              >
                Apply Range Rates to Calendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: FULL HOTEL PROPERTY & PER-NIGHT ROOM EDIT MODAL                  */}
      {/* ========================================================================= */}
      {isEditing && editingHotel && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto flex flex-col justify-between">
            <div>
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider">
                    <HotelIcon className="w-4 h-4" />
                    <span>{editingHotel.id ? 'Configure Hotel & Per-Night Rates' : 'Create New Hotel'}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    {editingHotel.name || 'New Accommodations Contract'}
                  </h3>
                </div>
                <button onClick={() => setIsEditing(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Sub-tabs */}
              <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 mb-6">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('DETAILS')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSubTab === 'DETAILS'
                      ? 'bg-[#008972] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  1. Property Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('ROOMS')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSubTab === 'ROOMS'
                      ? 'bg-[#008972] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  2. Room Categories & Per-Night Rates ({editingHotel.roomTypes?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('LOCATION')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSubTab === 'LOCATION'
                      ? 'bg-[#008972] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  3. Location & Transfers
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('SEO')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                    activeSubTab === 'SEO'
                      ? 'bg-[#008972] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  <span>4. SEO & Indexing</span>
                </button>
              </div>

              {/* Tab 1: Details */}
              {activeSubTab === 'DETAILS' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Property Name
                      </label>
                      <input
                        type="text"
                        required
                        value={editingHotel.name || ''}
                        onChange={e => setEditingHotel({ ...editingHotel, name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                        placeholder="e.g. Hoshinoya Tokyo Luxury Ryokan"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Contract Code (SKU)
                      </label>
                      <input
                        type="text"
                        required
                        value={editingHotel.code || ''}
                        onChange={e => setEditingHotel({ ...editingHotel, code: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono"
                        placeholder="e.g. HTL-TYO-HOS01"
                      />
                    </div>
                  </div>

                  {/* Connected Destination Hierarchy */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs">
                        <Building2 className="w-4 h-4" />
                        <span>Connected Geography Hierarchy (Region → Destination → City Hub)</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tier 1 → Tier 2 → Tier 3</span>
                    </div>

                    {/* Live Hierarchy Breadcrumb Preview */}
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2 text-xs flex-wrap">
                      <span className="font-bold text-slate-400 uppercase text-[10px]">Hierarchy:</span>
                      <span className="font-bold text-[#008f77] flex items-center gap-1">
                        <Globe2 className="w-3 h-3" />
                        {editingHotel.regionName || 'Select Region'}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#00C6A6]" />
                        {editingHotel.destinationName || 'Select Destination'}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        <Building className="w-3 h-3 text-amber-600" />
                        {editingHotel.cityName || 'Select City Hub'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          1. Master Region (Tier 1) *
                        </label>
                        <select
                          required
                          value={editingHotel.regionId || ''}
                          onChange={e => {
                            const newRegId = e.target.value;
                            const reg = masterRegions.find(r => r.id === newRegId);
                            const matchingDests = destinations.filter(d => !newRegId || d.regionId === newRegId);
                            const nextDest = matchingDests[0] || destinations[0];
                            const matchingHubs = cityHubs.filter(h => h.destinationId === nextDest?.id);
                            const nextHub = matchingHubs[0];

                            setEditingHotel({ 
                              ...editingHotel, 
                              regionId: newRegId,
                              regionName: reg?.name || '',
                              destinationId: nextDest?.id || editingHotel.destinationId,
                              destinationName: nextDest?.name || editingHotel.destinationName,
                              hubId: nextHub?.id || '',
                              cityId: nextHub?.id || 'central',
                              cityName: nextHub?.name || 'Capital City',
                              country: nextDest?.name || editingHotel.country
                            });
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
                        >
                          <option value="" disabled>-- Select Region --</option>
                          {masterRegions.map(r => (
                            <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          2. Destination (Tier 2) *
                        </label>
                        <select
                          required
                          value={editingHotel.destinationId}
                          onChange={e => {
                            const newDestId = e.target.value;
                            const d = destinations.find(dest => dest.id === newDestId);
                            const parentReg = masterRegions.find(r => r.id === d?.regionId);
                            const matchingHubs = cityHubs.filter(h => h.destinationId === newDestId);
                            const firstHub = matchingHubs[0];

                            setEditingHotel({ 
                              ...editingHotel, 
                              destinationId: newDestId,
                              destinationName: d?.name || 'Destination',
                              regionId: d?.regionId || parentReg?.id || editingHotel.regionId || '',
                              regionName: d?.regionName || parentReg?.name || editingHotel.regionName || '',
                              hubId: firstHub?.id || '',
                              cityId: firstHub?.id || 'central',
                              cityName: firstHub?.name || 'Capital City',
                              country: d?.name || editingHotel.country
                            });
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
                        >
                          {destinations
                            .filter(d => !editingHotel.regionId || d.regionId === editingHotel.regionId)
                            .map(d => (
                              <option key={d.id} value={d.id}>{d.name} {d.regionName ? `(${d.regionName})` : ''}</option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          3. Destination Hub / City (Tier 3) *
                        </label>
                        <select
                          value={editingHotel.hubId || ''}
                          onChange={e => {
                            const newHubId = e.target.value;
                            const hub = cityHubs.find(h => h.id === newHubId);
                            setEditingHotel({
                              ...editingHotel,
                              hubId: newHubId,
                              cityId: newHubId,
                              cityName: hub?.name || editingHotel.cityName || '',
                              area: hub?.name || editingHotel.area
                            });
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:outline-none focus:border-[#00C6A6]"
                        >
                          <option value="">-- Select City Hub --</option>
                          {cityHubs
                            .filter(h => {
                              const matchesDest = !editingHotel.destinationId || h.destinationId === editingHotel.destinationId;
                              const matchesReg = !editingHotel.regionId || h.regionId === editingHotel.regionId;
                              return matchesDest && matchesReg;
                            })
                            .map(h => (
                              <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Star Rating
                      </label>
                      <select
                        value={editingHotel.starRating || 5}
                        onChange={e => setEditingHotel({ ...editingHotel, starRating: Number(e.target.value) })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs"
                      >
                        <option value={5}>5-Star Luxury Palace</option>
                        <option value={4}>4-Star Premium Boutique</option>
                        <option value={3}>3-Star Quality Heritage</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Property Type
                      </label>
                      <select
                        value={editingHotel.propertyType || 'LUXURY_HOTEL'}
                        onChange={e => setEditingHotel({ ...editingHotel, propertyType: e.target.value as any })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                      >
                        <option value="LUXURY_HOTEL">Luxury Hotel</option>
                        <option value="RYOKAN">Japanese Ryokan / Onsen</option>
                        <option value="BOUTIQUE_RESORT">Boutique Resort</option>
                        <option value="BUSINESS_HOTEL">Business Hotel</option>
                        <option value="VILLA_CHALET">Villa / Luxury Chalet</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <ImageUploadOrUrlInput
                      value={editingHotel.heroImage || ''}
                      onChange={url => setEditingHotel({ ...editingHotel, heroImage: url })}
                      label="Hotel Hero Image (Upload photo or fetch Unsplash HD)"
                      placeholder="https://images.unsplash.com/... or upload hotel photo"
                      category="hotels"
                      defaultSearchTopic={editingHotel.name || editingHotel.cityName || 'Luxury Hotel in Japan'}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Property Description
                    </label>
                    <textarea
                      rows={3}
                      value={editingHotel.description || ''}
                      onChange={e => setEditingHotel({ ...editingHotel, description: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Base Starting Net Rate / Night ({editingHotel.currency || 'USD'})
                      </label>
                      <input
                        type="number"
                        value={editingHotel.startingNetPrice || 0}
                        onChange={e => setEditingHotel({ ...editingHotel, startingNetPrice: Number(e.target.value) })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Publication Status
                      </label>
                      <select
                        value={editingHotel.status || 'PUBLISHED'}
                        onChange={e => setEditingHotel({ ...editingHotel, status: e.target.value as any })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs"
                      >
                        <option value="PUBLISHED">Published (Available in Quotation Engine)</option>
                        <option value="DRAFT">Draft</option>
                        <option value="ARCHIVED">Archived</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Room Types & Per-Night Rates */}
              {activeSubTab === 'ROOMS' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Room Categories & Per-Night Costs</h4>
                      <p className="text-xs text-slate-500">Configure single net / night, double net / night, triple net, extra-bed, and child rates per room category.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddRoomType}
                      className="inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-2 rounded-xl text-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#00C6A6]" />
                      <span>Add Room Category</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {(editingHotel.roomTypes || []).map((room, roomIdx) => (
                      <div key={room.id || roomIdx} className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                          <div className="flex items-center space-x-3">
                            <span className="w-6 h-6 rounded-full bg-[#008972] text-white font-bold text-xs flex items-center justify-center">
                              {roomIdx + 1}
                            </span>
                            <input
                              type="text"
                              value={room.roomName}
                              onChange={e => {
                                const updatedRooms = [...(editingHotel.roomTypes || [])];
                                updatedRooms[roomIdx].roomName = e.target.value;
                                setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                              }}
                              className="font-bold text-sm text-slate-900 bg-transparent border-b border-slate-300 focus:border-[#00C6A6] focus:outline-none px-1 py-0.5"
                              placeholder="Room Category Name"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const updatedRooms = editingHotel.roomTypes?.filter((_, i) => i !== roomIdx);
                              setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                            }}
                            className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                            title="Remove Room"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Room Basic Attributes */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <label className="text-slate-500 font-bold">Bed Type</label>
                            <input
                              type="text"
                              value={room.bedType}
                              onChange={e => {
                                const updatedRooms = [...(editingHotel.roomTypes || [])];
                                updatedRooms[roomIdx].bedType = e.target.value;
                                setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 font-bold">Room Size (m²)</label>
                            <input
                              type="number"
                              value={room.roomSizeSqMeters || 45}
                              onChange={e => {
                                const updatedRooms = [...(editingHotel.roomTypes || [])];
                                updatedRooms[roomIdx].roomSizeSqMeters = Number(e.target.value);
                                setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 font-bold">Total Max Occupancy (Pax)</label>
                            <input
                              type="number"
                              value={room.maxOccupancy || (room.maxAdults + room.maxChildren) || 4}
                              onChange={e => {
                                const updatedRooms = [...(editingHotel.roomTypes || [])];
                                const val = Number(e.target.value);
                                updatedRooms[roomIdx].maxOccupancy = val;
                                updatedRooms[roomIdx].maxPax = val;
                                setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-[#008972]"
                            />
                          </div>
                          <div>
                            <label className="text-slate-500 font-bold">Min Passenger (Pax)</label>
                            <input
                              type="number"
                              value={room.minPax ?? 1}
                              onChange={e => {
                                const updatedRooms = [...(editingHotel.roomTypes || [])];
                                updatedRooms[roomIdx].minPax = Number(e.target.value);
                                setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                            />
                          </div>
                        </div>

                        {/* Room Category Photo */}
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <ImageUploadOrUrlInput
                            label="Room Category Photo (Upload photo or fetch Unsplash)"
                            value={(room.images && room.images[0]) || ''}
                            onChange={url => {
                              const updatedRooms = [...(editingHotel.roomTypes || [])];
                              updatedRooms[roomIdx].images = url ? [url] : [];
                              setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                            }}
                            placeholder="https://images.unsplash.com/... or upload room photo"
                            category="hotels"
                            defaultSearchTopic={`${room.roomName} hotel room`}
                          />
                        </div>

                        {/* Smart Passenger & Children Age Configuration Panel */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#008972]" />
                              <span>Smart Passenger & Kids Age Matrix</span>
                            </span>
                            <span className="text-[10px] bg-[#008972]/10 text-[#008972] font-bold px-2 py-0.5 rounded-full">
                              Validates B2B & Direct Room Occupancy
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
                            <div>
                              <label className="text-slate-500 text-[10px] font-bold block mb-1">Min Adults</label>
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={room.minAdults ?? 1}
                                onChange={e => {
                                  const updatedRooms = [...(editingHotel.roomTypes || [])];
                                  updatedRooms[roomIdx].minAdults = Number(e.target.value);
                                  setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                }}
                                className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="text-slate-500 text-[10px] font-bold block mb-1">Max Adults</label>
                              <input
                                type="number"
                                min={1}
                                max={10}
                                value={room.maxAdults ?? 2}
                                onChange={e => {
                                  const updatedRooms = [...(editingHotel.roomTypes || [])];
                                  updatedRooms[roomIdx].maxAdults = Number(e.target.value);
                                  setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                }}
                                className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="text-slate-500 text-[10px] font-bold block mb-1">Max Children</label>
                              <input
                                type="number"
                                min={0}
                                max={10}
                                value={room.maxChildren ?? 2}
                                onChange={e => {
                                  const updatedRooms = [...(editingHotel.roomTypes || [])];
                                  updatedRooms[roomIdx].maxChildren = Number(e.target.value);
                                  setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                }}
                                className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="text-slate-500 text-[10px] font-bold block mb-1">Max Child Age (Yrs)</label>
                              <input
                                type="number"
                                min={1}
                                max={17}
                                value={room.maxChildAge ?? 11}
                                onChange={e => {
                                  const updatedRooms = [...(editingHotel.roomTypes || [])];
                                  updatedRooms[roomIdx].maxChildAge = Number(e.target.value);
                                  setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                }}
                                className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="text-slate-500 text-[10px] font-bold block mb-1">Infant Max Age (Yrs)</label>
                              <input
                                type="number"
                                min={1}
                                max={5}
                                value={room.infantMaxAge ?? 2}
                                onChange={e => {
                                  const updatedRooms = [...(editingHotel.roomTypes || [])];
                                  updatedRooms[roomIdx].infantMaxAge = Number(e.target.value);
                                  setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                }}
                                className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="text-slate-500 text-[10px] font-bold block mb-1">Max Infants</label>
                              <input
                                type="number"
                                min={0}
                                max={5}
                                value={room.maxInfants ?? 1}
                                onChange={e => {
                                  const updatedRooms = [...(editingHotel.roomTypes || [])];
                                  updatedRooms[roomIdx].maxInfants = Number(e.target.value);
                                  setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                }}
                                className="w-full px-2 py-1 rounded border border-slate-200 text-xs font-semibold"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-xs">
                            <div>
                              <label className="text-slate-500 text-[10px] font-bold block mb-1">Child Bedding Policy</label>
                              <input
                                type="text"
                                value={room.childPolicy || ''}
                                onChange={e => {
                                  const updatedRooms = [...(editingHotel.roomTypes || [])];
                                  updatedRooms[roomIdx].childPolicy = e.target.value;
                                  setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                }}
                                placeholder="e.g. Complimentary below 6 yrs sharing bed, Extra bed for 6-11 yrs"
                                className="w-full px-2.5 py-1 rounded border border-slate-200 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-slate-500 text-[10px] font-bold block mb-1">Child Pricing Policy</label>
                              <select
                                value={room.childPricingPolicy || 'HALF_PRICE'}
                                onChange={e => {
                                  const updatedRooms = [...(editingHotel.roomTypes || [])];
                                  updatedRooms[roomIdx].childPricingPolicy = e.target.value as any;
                                  setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                }}
                                className="w-full px-2.5 py-1 rounded border border-slate-200 text-xs font-semibold"
                              >
                                <option value="FREE_BELOW_AGE">Free below age rule / Sharing existing bed</option>
                                <option value="HALF_PRICE">Fixed Child Tariff Rate</option>
                                <option value="FULL_ADULT_PRICE">Full Adult Rate with extra bed</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Rates within this room */}
                        <div className="pt-3 border-t border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                              <DollarSign className="w-3.5 h-3.5 text-[#008972]" />
                              <span>Configure Per-Night Net Costs & Validity Periods</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const updatedRooms = [...(editingHotel.roomTypes || [])];
                                const currentRates = updatedRooms[roomIdx].rates || [];
                                const newRate: HotelRate = {
                                  id: `rate-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                                  mealPlan: 'BB',
                                  mealPlanName: 'Breakfast Included',
                                  singleNetRate: 350,
                                  doubleNetRate: 420,
                                  tripleNetRate: 520,
                                  extraBedRate: 90,
                                  childRate: 45,
                                  markupPercent: 18,
                                  taxPercent: 10,
                                  feePercent: 2.5,
                                  currency: (editingHotel.currency as any) || 'USD',
                                  validityFrom: '2026-01-01',
                                  validityTo: '2026-12-31'
                                };
                                updatedRooms[roomIdx].rates = [...currentRates, newRate];
                                setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                              }}
                              className="inline-flex items-center space-x-1 bg-[#008972] hover:bg-[#007460] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors shadow-2xs"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Rate Period</span>
                            </button>
                          </div>

                          {(room.rates || []).map((rate, rIdx) => (
                            <div key={rate.id || rIdx} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                    Rate Period #{rIdx + 1}
                                  </span>
                                  <span className="text-[11px] font-bold text-slate-800">
                                    {rate.mealPlanName || rate.mealPlan}
                                  </span>
                                </div>
                                {(room.rates || []).length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedRooms = [...(editingHotel.roomTypes || [])];
                                      updatedRooms[roomIdx].rates = updatedRooms[roomIdx].rates.filter((_, i) => i !== rIdx);
                                      setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                    }}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded text-xs flex items-center space-x-1 cursor-pointer transition-colors"
                                    title="Delete Rate Period"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-bold">Delete Rate</span>
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
                                <div>
                                  <label className="text-slate-500 text-[10px] uppercase font-bold block mb-1">Valid From *</label>
                                  <input
                                    type="date"
                                    required
                                    value={rate.validityFrom || '2026-01-01'}
                                    onChange={e => {
                                      const updatedRooms = [...(editingHotel.roomTypes || [])];
                                      updatedRooms[roomIdx].rates[rIdx].validityFrom = e.target.value;
                                      setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                    }}
                                    className="w-full p-1.5 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-800 bg-slate-50 focus:bg-white"
                                  />
                                </div>

                                <div>
                                  <label className="text-slate-500 text-[10px] uppercase font-bold block mb-1">Valid Till *</label>
                                  <input
                                    type="date"
                                    required
                                    value={rate.validityTo || '2026-12-31'}
                                    onChange={e => {
                                      const updatedRooms = [...(editingHotel.roomTypes || [])];
                                      updatedRooms[roomIdx].rates[rIdx].validityTo = e.target.value;
                                      setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                    }}
                                    className="w-full p-1.5 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-800 bg-slate-50 focus:bg-white"
                                  />
                                </div>

                                <div>
                                  <label className="text-slate-500 text-[10px] uppercase font-bold block mb-1">Meal Plan</label>
                                  <select
                                    value={rate.mealPlan}
                                    onChange={e => {
                                      const updatedRooms = [...(editingHotel.roomTypes || [])];
                                      const plan = e.target.value as any;
                                      const names: Record<string, string> = {
                                        RO: 'Room Only',
                                        BB: 'Breakfast Included',
                                        HB: 'Half Board (Breakfast + Dinner)',
                                        FB: 'Full Board',
                                        AI: 'All Inclusive'
                                      };
                                      updatedRooms[roomIdx].rates[rIdx].mealPlan = plan;
                                      updatedRooms[roomIdx].rates[rIdx].mealPlanName = names[plan] || plan;
                                      setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                    }}
                                    className="w-full p-1.5 border border-slate-200 rounded-lg font-bold text-slate-800 text-[11px] bg-slate-50 focus:bg-white"
                                  >
                                    <option value="RO">RO (Room Only)</option>
                                    <option value="BB">BB (Breakfast Incl)</option>
                                    <option value="HB">HB (Half Board)</option>
                                    <option value="FB">FB (Full Board)</option>
                                    <option value="AI">AI (All Inclusive)</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="text-slate-500 text-[10px] uppercase font-bold block mb-1">Single Net / Nt</label>
                                  <input
                                    type="number"
                                    value={rate.singleNetRate}
                                    onChange={e => {
                                      const updatedRooms = [...(editingHotel.roomTypes || [])];
                                      updatedRooms[roomIdx].rates[rIdx].singleNetRate = Number(e.target.value);
                                      setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                    }}
                                    className="w-full p-1.5 border border-slate-200 rounded-lg font-mono font-bold text-xs bg-slate-50 focus:bg-white"
                                  />
                                </div>

                                <div>
                                  <label className="text-slate-500 text-[10px] uppercase font-bold block mb-1">Double Net / Nt *</label>
                                  <input
                                    type="number"
                                    required
                                    value={rate.doubleNetRate}
                                    onChange={e => {
                                      const updatedRooms = [...(editingHotel.roomTypes || [])];
                                      updatedRooms[roomIdx].rates[rIdx].doubleNetRate = Number(e.target.value);
                                      setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                    }}
                                    className="w-full p-1.5 border border-slate-200 rounded-lg font-mono font-bold text-xs bg-slate-50 focus:bg-white text-[#008972]"
                                  />
                                </div>

                                <div>
                                  <label className="text-slate-500 text-[10px] uppercase font-bold block mb-1">Triple Net / Nt</label>
                                  <input
                                    type="number"
                                    value={rate.tripleNetRate}
                                    onChange={e => {
                                      const updatedRooms = [...(editingHotel.roomTypes || [])];
                                      updatedRooms[roomIdx].rates[rIdx].tripleNetRate = Number(e.target.value);
                                      setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                    }}
                                    className="w-full p-1.5 border border-slate-200 rounded-lg font-mono font-bold text-xs bg-slate-50 focus:bg-white"
                                  />
                                </div>

                                <div>
                                  <label className="text-slate-500 text-[10px] uppercase font-bold block mb-1">Extra Bed Net</label>
                                  <input
                                    type="number"
                                    value={rate.extraBedRate}
                                    onChange={e => {
                                      const updatedRooms = [...(editingHotel.roomTypes || [])];
                                      updatedRooms[roomIdx].rates[rIdx].extraBedRate = Number(e.target.value);
                                      setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                    }}
                                    className="w-full p-1.5 border border-slate-200 rounded-lg font-mono font-bold text-xs bg-slate-50 focus:bg-white"
                                  />
                                </div>

                                <div>
                                  <label className="text-slate-500 text-[10px] uppercase font-bold block mb-1">Child Net / Nt</label>
                                  <input
                                    type="number"
                                    value={rate.childRate}
                                    onChange={e => {
                                      const updatedRooms = [...(editingHotel.roomTypes || [])];
                                      updatedRooms[roomIdx].rates[rIdx].childRate = Number(e.target.value);
                                      setEditingHotel({ ...editingHotel, roomTypes: updatedRooms });
                                    }}
                                    className="w-full p-1.5 border border-slate-200 rounded-lg font-mono font-bold text-xs bg-slate-50 focus:bg-white"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Location Details */}
              {activeSubTab === 'LOCATION' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={editingHotel.address || ''}
                      onChange={e => setEditingHotel({ ...editingHotel, address: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs"
                      placeholder="e.g. 1-9-1 Otemachi, Chiyoda-ku, Tokyo 100-0004"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Primary Airport Name
                      </label>
                      <input
                        type="text"
                        value={editingHotel.locationDetails?.airportName || ''}
                        onChange={e => setEditingHotel({
                          ...editingHotel,
                          locationDetails: { ...editingHotel.locationDetails, airportName: e.target.value }
                        })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs"
                        placeholder="e.g. Tokyo Haneda (HND)"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Airport Distance (km)
                      </label>
                      <input
                        type="number"
                        value={editingHotel.locationDetails?.airportDistanceKm || 20}
                        onChange={e => setEditingHotel({
                          ...editingHotel,
                          locationDetails: { ...editingHotel.locationDetails, airportDistanceKm: Number(e.target.value) }
                        })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Transfer Time (mins)
                      </label>
                      <input
                        type="number"
                        value={editingHotel.locationDetails?.airportTransferTimeMins || 30}
                        onChange={e => setEditingHotel({
                          ...editingHotel,
                          locationDetails: { ...editingHotel.locationDetails, airportTransferTimeMins: Number(e.target.value) }
                        })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: SEO */}
              {activeSubTab === 'SEO' && editingHotel && (
                <EntitySEOSettingsTab
                  entityType="HOTEL"
                  entity={editingHotel}
                  seo={editingHotel.seo}
                  onChange={(newSeo) => setEditingHotel(prev => prev ? ({ ...prev, seo: newSeo, slug: newSeo.slug || prev.slug }) : null)}
                />
              )}
            </div>

            {/* Modal Bottom Save Bar */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-6">
              <div>
                {editingHotel?.id && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingHotel.id)}
                    className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer flex items-center space-x-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Hotel</span>
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-8 py-2.5 rounded-xl bg-[#008972] hover:bg-[#00C6A6] text-white font-bold text-xs shadow-xs cursor-pointer flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Hotel Property</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onSuccess={() => {
            if (editingHotel?.id === deleteTarget.id) {
              setIsEditing(false);
              setEditingHotel(null);
            }
            setDeleteTarget(null);
            setHotels(db.getHotels());
            showNotification(`Hotel deleted successfully.`);
          }}
          entityType="Hotel"
          recordId={deleteTarget.id}
          recordTitle={deleteTarget.name}
          user={user}
        />
      )}
    </div>
  );
};
