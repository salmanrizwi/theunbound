import { ProductCategoryEnum, DedicatedConfiguratorType } from './configuratorRegistry';

export type FieldSource = 
  | 'PRODUCT_MASTER'
  | 'PRODUCT_OPERATIONAL_CONFIGURATION'
  | 'PRODUCT_PRICING'
  | 'TRANSACTION_CONTEXT'
  | 'UPSELL_RELATIONSHIP';

export type FieldVisibility = 'AGENT' | 'INTERNAL' | 'BUYER' | 'ADMIN_ONLY';

export interface ConfiguratorFieldDefinition {
  field_id: string;
  category: ProductCategoryEnum;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'TIME' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN' | 'UPSELLS';
  source: FieldSource;
  visibility: FieldVisibility;
  editable: boolean;
  configurable: boolean;
  required: boolean;
  pricing_impact: boolean;
  booking_impact: boolean;
  description: string;
}

/**
 * ============================================================================
 * THEUNBOUND — CENTRAL CONFIGURATOR FIELD REGISTRY (Section 26 & 39)
 * Definitive source of truth for permitted fields per product category.
 * ============================================================================
 */
export const CONFIGURATOR_FIELD_REGISTRY: Record<ProductCategoryEnum, ConfiguratorFieldDefinition[]> = {
  PRIVATE_TOURS: [
    {
      field_id: 'product_info',
      category: 'PRIVATE_TOURS',
      label: 'Master Tour Information',
      type: 'TEXT',
      source: 'PRODUCT_MASTER',
      visibility: 'AGENT',
      editable: false,
      configurable: false,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Read-only tour title, overview, inclusions, exclusions, and destination.'
    },
    {
      field_id: 'vehicle_spec',
      category: 'PRIVATE_TOURS',
      label: 'Assigned Fleet Vehicle & Capacity',
      type: 'SELECT',
      source: 'PRODUCT_OPERATIONAL_CONFIGURATION',
      visibility: 'AGENT',
      editable: false,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Operational vehicle model and seating capacity loaded from Vehicle Master.'
    },
    {
      field_id: 'travel_date',
      category: 'PRIVATE_TOURS',
      label: 'Tour Service Date',
      type: 'DATE',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Selected calendar date for private chauffeured service.'
    },
    {
      field_id: 'pickup_time',
      category: 'PRIVATE_TOURS',
      label: 'Departure / Pickup Time',
      type: 'TIME',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: false,
      pricing_impact: false,
      booking_impact: true,
      description: 'Scheduled departure time from guest hotel lobby.'
    },
    {
      field_id: 'pax_composition',
      category: 'PRIVATE_TOURS',
      label: 'Guest Composition (Adults, Children, Infants)',
      type: 'NUMBER',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Canonical passenger count validated against vehicle seating capacity.'
    },
    {
      field_id: 'upsells',
      category: 'PRIVATE_TOURS',
      label: 'Optional Experience Upgrades',
      type: 'UPSELLS',
      source: 'UPSELL_RELATIONSHIP',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: false,
      pricing_impact: true,
      booking_impact: true,
      description: 'Authoritative product-based upsells configured in Product Management.'
    }
  ],

  GROUP_TOURS: [
    {
      field_id: 'product_info',
      category: 'GROUP_TOURS',
      label: 'Master Group Tour Information',
      type: 'TEXT',
      source: 'PRODUCT_MASTER',
      visibility: 'AGENT',
      editable: false,
      configurable: false,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Read-only tour title, overview, inclusions, exclusions, and itinerary.'
    },
    {
      field_id: 'travel_date',
      category: 'GROUP_TOURS',
      label: 'Departure Date',
      type: 'DATE',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Selected tour departure date.'
    },
    {
      field_id: 'pax_composition',
      category: 'GROUP_TOURS',
      label: 'Passenger Count (Adults, Children, Infants)',
      type: 'NUMBER',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Total passengers for per-person tour pricing calculation.'
    },
    {
      field_id: 'pickup_point',
      category: 'GROUP_TOURS',
      label: 'Designated Meeting / Pickup Point',
      type: 'SELECT',
      source: 'PRODUCT_OPERATIONAL_CONFIGURATION',
      visibility: 'AGENT',
      editable: false,
      configurable: false,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Configured departure point for group coach meetup.'
    },
    {
      field_id: 'upsells',
      category: 'GROUP_TOURS',
      label: 'Optional Experience Upgrades',
      type: 'UPSELLS',
      source: 'UPSELL_RELATIONSHIP',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: false,
      pricing_impact: true,
      booking_impact: true,
      description: 'Authoritative product-based upsells linked to this group tour.'
    }
  ],

  TRANSFERS: [
    {
      field_id: 'route_info',
      category: 'TRANSFERS',
      label: 'Transfer Route (From Hub ➔ To Hub)',
      type: 'TEXT',
      source: 'PRODUCT_OPERATIONAL_CONFIGURATION',
      visibility: 'AGENT',
      editable: false,
      configurable: false,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Read-only origin and destination hubs defined on the transfer product.'
    },
    {
      field_id: 'vehicle_spec',
      category: 'TRANSFERS',
      label: 'Assigned Transfer Vehicle & Capacity',
      type: 'SELECT',
      source: 'PRODUCT_OPERATIONAL_CONFIGURATION',
      visibility: 'AGENT',
      editable: false,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Authoritative vehicle model and seating/luggage capacity.'
    },
    {
      field_id: 'travel_date',
      category: 'TRANSFERS',
      label: 'Transfer Date',
      type: 'DATE',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Service date for ground transfer.'
    },
    {
      field_id: 'pickup_time',
      category: 'TRANSFERS',
      label: 'Pickup / Flight Arrival Time',
      type: 'TIME',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Scheduled pickup or flight arrival timestamp.'
    },
    {
      field_id: 'pax_and_luggage',
      category: 'TRANSFERS',
      label: 'Passenger & Luggage Counts',
      type: 'NUMBER',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Validated against vehicle capacity.'
    },
    {
      field_id: 'upsells',
      category: 'TRANSFERS',
      label: 'Optional Transfer Add-ons',
      type: 'UPSELLS',
      source: 'UPSELL_RELATIONSHIP',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: false,
      pricing_impact: true,
      booking_impact: true,
      description: 'VIP meet and greet, baby seat, or other product upsells.'
    }
  ],

  TICKETS: [
    {
      field_id: 'product_info',
      category: 'TICKETS',
      label: 'Attraction & Admission Information',
      type: 'TEXT',
      source: 'PRODUCT_MASTER',
      visibility: 'AGENT',
      editable: false,
      configurable: false,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Read-only attraction name, voucher redemption rules, and operating hours.'
    },
    {
      field_id: 'visit_date',
      category: 'TICKETS',
      label: 'Entry / Visit Date',
      type: 'DATE',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Selected date for admission voucher.'
    },
    {
      field_id: 'ticket_tier',
      category: 'TICKETS',
      label: 'Ticket Type / Admission Tier',
      type: 'SELECT',
      source: 'PRODUCT_OPERATIONAL_CONFIGURATION',
      visibility: 'AGENT',
      editable: false,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Authoritative ticket tiers configured on the product.'
    },
    {
      field_id: 'pax_composition',
      category: 'TICKETS',
      label: 'Ticket Quantity (Adults, Children, Infants)',
      type: 'NUMBER',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Number of entry admissions requested.'
    },
    {
      field_id: 'upsells',
      category: 'TICKETS',
      label: 'Optional Experience Upgrades',
      type: 'UPSELLS',
      source: 'UPSELL_RELATIONSHIP',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: false,
      pricing_impact: true,
      booking_impact: true,
      description: 'Attraction audio guides, express entry, or product upgrades.'
    }
  ],

  GUIDES: [
    {
      field_id: 'product_info',
      category: 'GUIDES',
      label: 'Guide Qualifications & Overview',
      type: 'TEXT',
      source: 'PRODUCT_MASTER',
      visibility: 'AGENT',
      editable: false,
      configurable: false,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'National licensing credentials and guide service format.'
    },
    {
      field_id: 'service_date',
      category: 'GUIDES',
      label: 'Service Date',
      type: 'DATE',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Date for licensed guide service.'
    },
    {
      field_id: 'start_time',
      category: 'GUIDES',
      label: 'Meeting / Start Time',
      type: 'TIME',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Scheduled meeting time.'
    },
    {
      field_id: 'language',
      category: 'GUIDES',
      label: 'Guide Language',
      type: 'SELECT',
      source: 'PRODUCT_OPERATIONAL_CONFIGURATION',
      visibility: 'AGENT',
      editable: false,
      configurable: true,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Languages supported by this guide product.'
    },
    {
      field_id: 'duration',
      category: 'GUIDES',
      label: 'Duration (Hours)',
      type: 'NUMBER',
      source: 'PRODUCT_OPERATIONAL_CONFIGURATION',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Number of hours booked based on minimum hours policy.'
    },
    {
      field_id: 'pax_composition',
      category: 'GUIDES',
      label: 'Group Size (Pax)',
      type: 'NUMBER',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Group size validated against guide max group capacity.'
    },
    {
      field_id: 'upsells',
      category: 'GUIDES',
      label: 'Optional Experience Upgrades',
      type: 'UPSELLS',
      source: 'UPSELL_RELATIONSHIP',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: false,
      pricing_impact: true,
      booking_impact: true,
      description: 'Whisper audio systems or additional guide upgrades.'
    }
  ],

  RESTAURANT: [
    {
      field_id: 'restaurant_info',
      category: 'RESTAURANT',
      label: 'Restaurant & Culinary Overview',
      type: 'TEXT',
      source: 'PRODUCT_MASTER',
      visibility: 'AGENT',
      editable: false,
      configurable: false,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Restaurant name, specialty cuisine, location, and dietary support.'
    },
    {
      field_id: 'meal_period',
      category: 'RESTAURANT',
      label: 'Meal Period',
      type: 'SELECT',
      source: 'PRODUCT_OPERATIONAL_CONFIGURATION',
      visibility: 'AGENT',
      editable: false,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Configured meals (Breakfast, Lunch, Dinner).'
    },
    {
      field_id: 'reservation_date',
      category: 'RESTAURANT',
      label: 'Dining Date',
      type: 'DATE',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Reservation date.'
    },
    {
      field_id: 'seating_time',
      category: 'RESTAURANT',
      label: 'Seating Time',
      type: 'TIME',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Table seating reservation time.'
    },
    {
      field_id: 'pax_composition',
      category: 'RESTAURANT',
      label: 'Guest Count (Adults, Children, Infants)',
      type: 'NUMBER',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Number of dining covers.'
    },
    {
      field_id: 'upsells',
      category: 'RESTAURANT',
      label: 'Optional Dining Upgrades',
      type: 'UPSELLS',
      source: 'UPSELL_RELATIONSHIP',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: false,
      pricing_impact: true,
      booking_impact: true,
      description: 'Sommelier pairing, private room, or beverage packages.'
    }
  ],

  PRIVATE_YACHT: [
    {
      field_id: 'yacht_info',
      category: 'PRIVATE_YACHT',
      label: 'Yacht Specifications & Dimensions',
      type: 'TEXT',
      source: 'PRODUCT_OPERATIONAL_CONFIGURATION',
      visibility: 'AGENT',
      editable: false,
      configurable: false,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Yacht model, classification, length/dimensions, and master capacity.'
    },
    {
      field_id: 'charter_date',
      category: 'PRIVATE_YACHT',
      label: 'Charter Date',
      type: 'DATE',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Selected private yacht charter date.'
    },
    {
      field_id: 'charter_time',
      category: 'PRIVATE_YACHT',
      label: 'Departure / Cruise Slot',
      type: 'TIME',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Embarkation departure time.'
    },
    {
      field_id: 'pax_composition',
      category: 'PRIVATE_YACHT',
      label: 'Guest Count (Adults, Children, Infants)',
      type: 'NUMBER',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Validated against master yacht passenger capacity.'
    },
    {
      field_id: 'duration',
      category: 'PRIVATE_YACHT',
      label: 'Charter Duration (Hours)',
      type: 'NUMBER',
      source: 'PRODUCT_OPERATIONAL_CONFIGURATION',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Charter duration in hours.'
    },
    {
      field_id: 'upsells',
      category: 'PRIVATE_YACHT',
      label: 'Optional Maritime Upgrades',
      type: 'UPSELLS',
      source: 'UPSELL_RELATIONSHIP',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: false,
      pricing_impact: true,
      booking_impact: true,
      description: 'Onboard chef, champagne bar, or water sports upgrades.'
    }
  ],

  FERRIES: [
    {
      field_id: 'vessel_info',
      category: 'FERRIES',
      label: 'Ferry Vessel & Route Ports',
      type: 'TEXT',
      source: 'PRODUCT_OPERATIONAL_CONFIGURATION',
      visibility: 'AGENT',
      editable: false,
      configurable: false,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Vessel class, master capacity, departure port, and arrival port.'
    },
    {
      field_id: 'departure_date',
      category: 'FERRIES',
      label: 'Sailing Date',
      type: 'DATE',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Selected ferry departure date.'
    },
    {
      field_id: 'departure_slot',
      category: 'FERRIES',
      label: 'Sailing Time Slot',
      type: 'TIME',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Ferry schedule departure slot.'
    },
    {
      field_id: 'pax_composition',
      category: 'FERRIES',
      label: 'Passenger Count (Adults, Children, Infants)',
      type: 'NUMBER',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Total passengers for per-person ferry fare.'
    },
    {
      field_id: 'upsells',
      category: 'FERRIES',
      label: 'Optional Ferry Upgrades',
      type: 'UPSELLS',
      source: 'UPSELL_RELATIONSHIP',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: false,
      pricing_impact: true,
      booking_impact: true,
      description: 'Priority boarding, lounge access, or vehicle transit.'
    }
  ],

  HOTELS: [
    {
      field_id: 'hotel_info',
      category: 'HOTELS',
      label: 'Contracted Hotel Information',
      type: 'TEXT',
      source: 'PRODUCT_MASTER',
      visibility: 'AGENT',
      editable: false,
      configurable: false,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Hotel name, star rating, address, and amenities.'
    },
    {
      field_id: 'stay_dates',
      category: 'HOTELS',
      label: 'Check-in & Check-out Dates',
      type: 'DATE',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Check-in and check-out dates.'
    },
    {
      field_id: 'room_type',
      category: 'HOTELS',
      label: 'Room Category & Rate Plan',
      type: 'SELECT',
      source: 'PRODUCT_OPERATIONAL_CONFIGURATION',
      visibility: 'AGENT',
      editable: false,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Contracted room type and meal plan.'
    },
    {
      field_id: 'rooms_and_pax',
      category: 'HOTELS',
      label: 'Rooms & Occupancy',
      type: 'NUMBER',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Rooms count and adult/child/infant occupancy.'
    }
  ],

  VISA_ANCILLARY: [
    {
      field_id: 'visa_info',
      category: 'VISA_ANCILLARY',
      label: 'Official Visa & Ancillary Service',
      type: 'TEXT',
      source: 'PRODUCT_MASTER',
      visibility: 'AGENT',
      editable: false,
      configurable: false,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Official visa country, visa type, and processing turnaround.'
    },
    {
      field_id: 'travel_date',
      category: 'VISA_ANCILLARY',
      label: 'Intended Travel / Entry Date',
      type: 'DATE',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'Intended date of entry into destination country.'
    },
    {
      field_id: 'applicants_count',
      category: 'VISA_ANCILLARY',
      label: 'Number of Visa Applicants',
      type: 'NUMBER',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Total applicants.'
    }
  ],

  SHINKANSEN: [
    {
      field_id: 'journey_info',
      category: 'SHINKANSEN',
      label: 'Japan Rail Network & Service',
      type: 'TEXT',
      source: 'PRODUCT_MASTER',
      visibility: 'AGENT',
      editable: false,
      configurable: false,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'smartEX dynamic Shinkansen route, stations, and train classes.'
    },
    {
      field_id: 'journey_date',
      category: 'SHINKANSEN',
      label: 'Travel Date & Departure Time',
      type: 'DATE',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Selected Shinkansen journey date.'
    },
    {
      field_id: 'car_class',
      category: 'SHINKANSEN',
      label: 'Seat Class (Ordinary / Green Car / Gran Class)',
      type: 'SELECT',
      source: 'PRODUCT_OPERATIONAL_CONFIGURATION',
      visibility: 'AGENT',
      editable: false,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Shinkansen car accommodation tier.'
    },
    {
      field_id: 'pax_composition',
      category: 'SHINKANSEN',
      label: 'Passengers (Adults, Children, Infants)',
      type: 'NUMBER',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Total passengers for smartEX tariff calculation.'
    }
  ],

  RAIL: [
    {
      field_id: 'journey_info',
      category: 'RAIL',
      label: 'Japan Rail Network & Service',
      type: 'TEXT',
      source: 'PRODUCT_MASTER',
      visibility: 'AGENT',
      editable: false,
      configurable: false,
      required: true,
      pricing_impact: false,
      booking_impact: true,
      description: 'smartEX dynamic Shinkansen route, stations, and train classes.'
    },
    {
      field_id: 'journey_date',
      category: 'RAIL',
      label: 'Travel Date & Departure Time',
      type: 'DATE',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Selected Shinkansen journey date.'
    },
    {
      field_id: 'car_class',
      category: 'RAIL',
      label: 'Seat Class (Ordinary / Green Car / Gran Class)',
      type: 'SELECT',
      source: 'PRODUCT_OPERATIONAL_CONFIGURATION',
      visibility: 'AGENT',
      editable: false,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Shinkansen car accommodation tier.'
    },
    {
      field_id: 'pax_composition',
      category: 'RAIL',
      label: 'Passengers (Adults, Children, Infants)',
      type: 'NUMBER',
      source: 'TRANSACTION_CONTEXT',
      visibility: 'AGENT',
      editable: true,
      configurable: true,
      required: true,
      pricing_impact: true,
      booking_impact: true,
      description: 'Total passengers for smartEX tariff calculation.'
    }
  ]
};

/**
 * Validates that a field is permitted for a category.
 */
export function isFieldPermittedForCategory(category: ProductCategoryEnum, fieldId: string): boolean {
  const fields = CONFIGURATOR_FIELD_REGISTRY[category];
  if (!fields) return false;
  return fields.some(f => f.field_id === fieldId);
}
