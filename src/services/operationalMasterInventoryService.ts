import { VehicleMaster, YachtMaster, FerryMaster, Product, User } from '../types';
import { AppDatabase } from './db';

/**
 * ============================================================================
 * THEUNBOUND — OPERATIONAL MASTER INVENTORY SERVICE
 * Section 4: Authoritative Central Operational Asset Inventory Service
 * ============================================================================
 * 
 * Single Source of Truth for:
 * 1. Vehicles
 * 2. Yachts
 * 3. Ferries & Vessels
 * 
 * Rules:
 * - Master Inventory owns the canonical operational asset record.
 * - Commercial Product configuration references Master Inventory by stable ID.
 * - Inactive/Archived assets are filtered out from new configurations.
 * - Historical transactions preserve an immutable snapshot.
 */
export class OperationalMasterInventoryService {
  private static instance: OperationalMasterInventoryService;
  private db: AppDatabase;

  private constructor() {
    this.db = AppDatabase.getInstance();
  }

  public static getInstance(): OperationalMasterInventoryService {
    if (!OperationalMasterInventoryService.instance) {
      OperationalMasterInventoryService.instance = new OperationalMasterInventoryService();
    }
    return OperationalMasterInventoryService.instance;
  }

  // ==========================================================================
  // VEHICLES (Master Fleet Inventory)
  // ==========================================================================

  public getVehicles(): VehicleMaster[] {
    return this.db.getVehicles();
  }

  public getActiveVehicles(): VehicleMaster[] {
    return this.db.getVehicles().filter(v => v.status === 'ACTIVE');
  }

  public getVehicleById(id: string): VehicleMaster | undefined {
    if (!id) return undefined;
    return this.db.getVehicles().find(v => v.id === id);
  }

  public getVehiclesForProduct(productOrId: string | Product): VehicleMaster[] {
    const product = typeof productOrId === 'string'
      ? this.db.getProducts().find(p => p.id === productOrId)
      : productOrId;

    if (!product) return [];

    const activeVehicles = this.getActiveVehicles();
    const candidateIds = new Set<string>();

    // 1. Direct product vehicle references
    if (product.vehicleId) candidateIds.add(product.vehicleId);
    if (Array.isArray((product as any).vehicleIds)) {
      (product as any).vehicleIds.forEach((vid: string) => candidateIds.add(vid));
    }
    if (product.vehicleConfig?.vehicleId) candidateIds.add(product.vehicleConfig.vehicleId);

    // 2. Step 3 Tiered pricing vehicle references
    if (Array.isArray(product.tieredPricing)) {
      product.tieredPricing.forEach(t => {
        if (t.fleetId) candidateIds.add(t.fleetId);
        if (t.vehicleId) candidateIds.add(t.vehicleId);
      });
    }

    // If product has explicit references, filter Master Inventory by those IDs
    if (candidateIds.size > 0) {
      const matched = activeVehicles.filter(v => candidateIds.has(v.id));
      if (matched.length > 0) return matched;
    }

    // If destination/hub matches
    if (product.destinationId) {
      const destVehicles = activeVehicles.filter(v => v.destinationId === product.destinationId);
      if (destVehicles.length > 0) return destVehicles;
    }

    return activeVehicles;
  }

  public saveVehicle(vehicle: VehicleMaster, user?: User | null): VehicleMaster {
    const validation = this.validateVehicle(vehicle);
    if (!validation.isValid) {
      throw new Error(`Vehicle validation failed: ${validation.errors.join(', ')}`);
    }
    return this.db.saveVehicle(vehicle, user);
  }

  public deleteVehicle(id: string, user?: User | null): boolean {
    return this.db.deleteVehicle(id, user);
  }

  // ==========================================================================
  // YACHTS (Master Luxury Charter Fleet)
  // ==========================================================================

  public getYachts(): YachtMaster[] {
    return this.db.getYachts();
  }

  public getActiveYachts(): YachtMaster[] {
    return this.db.getYachts().filter(y => y.status === 'ACTIVE');
  }

  public getYachtById(id: string): YachtMaster | undefined {
    if (!id) return undefined;
    return this.db.getYachts().find(y => y.id === id);
  }

  public getYachtsForProduct(productOrId: string | Product): YachtMaster[] {
    const product = typeof productOrId === 'string'
      ? this.db.getProducts().find(p => p.id === productOrId)
      : productOrId;

    if (!product) return [];

    const activeYachts = this.getActiveYachts();
    const candidateIds = new Set<string>();

    if (product.yachtId) candidateIds.add(product.yachtId);
    if (Array.isArray((product as any).yachtIds)) {
      (product as any).yachtIds.forEach((yid: string) => candidateIds.add(yid));
    }
    if (product.vehicleConfig?.yachtId) candidateIds.add(product.vehicleConfig.yachtId);

    if (Array.isArray(product.tieredPricing)) {
      product.tieredPricing.forEach(t => {
        if (t.fleetId) candidateIds.add(t.fleetId);
        if (t.vehicleId) candidateIds.add(t.vehicleId);
      });
    }

    if (candidateIds.size > 0) {
      const matched = activeYachts.filter(y => candidateIds.has(y.id));
      if (matched.length > 0) return matched;
    }

    if (product.destinationId) {
      const destYachts = activeYachts.filter(y => y.destinationId === product.destinationId);
      if (destYachts.length > 0) return destYachts;
    }

    return activeYachts;
  }

  public saveYacht(yacht: YachtMaster, user?: User | null): YachtMaster {
    const validation = this.validateYacht(yacht);
    if (!validation.isValid) {
      throw new Error(`Yacht validation failed: ${validation.errors.join(', ')}`);
    }
    return this.db.saveYacht(yacht, user);
  }

  public deleteYacht(id: string, user?: User | null): boolean {
    return this.db.deleteYacht(id, user);
  }

  // ==========================================================================
  // FERRIES & VESSELS (Master Maritime Vessels)
  // ==========================================================================

  public getFerriesAndVessels(): FerryMaster[] {
    return this.db.getFerries();
  }

  public getFerries(): FerryMaster[] {
    return this.db.getFerries();
  }

  public getVessels(): FerryMaster[] {
    return this.db.getFerries();
  }

  public getActiveFerriesAndVessels(): FerryMaster[] {
    return this.db.getFerries().filter(f => f.status === 'ACTIVE');
  }

  public getActiveVessels(): FerryMaster[] {
    return this.getActiveFerriesAndVessels();
  }

  public getVesselById(id: string): FerryMaster | undefined {
    if (!id) return undefined;
    return this.db.getFerries().find(f => f.id === id);
  }

  public getFerryById(id: string): FerryMaster | undefined {
    return this.getVesselById(id);
  }

  public getVesselsForProduct(productOrId: string | Product): FerryMaster[] {
    const product = typeof productOrId === 'string'
      ? this.db.getProducts().find(p => p.id === productOrId)
      : productOrId;

    if (!product) return [];

    const activeVessels = this.getActiveFerriesAndVessels();
    const candidateIds = new Set<string>();

    if ((product as any).ferryId) candidateIds.add((product as any).ferryId);
    if ((product as any).vesselId) candidateIds.add((product as any).vesselId);
    if (Array.isArray((product as any).vesselIds)) {
      (product as any).vesselIds.forEach((vid: string) => candidateIds.add(vid));
    }
    if ((product as any).ferryConfig?.vesselId) candidateIds.add((product as any).ferryConfig.vesselId);

    if (candidateIds.size > 0) {
      const matched = activeVessels.filter(v => candidateIds.has(v.id));
      if (matched.length > 0) return matched;
    }

    if (product.destinationId) {
      const destVessels = activeVessels.filter(v => v.destinationId === product.destinationId);
      if (destVessels.length > 0) return destVessels;
    }

    return activeVessels;
  }

  public saveFerry(ferry: FerryMaster, user?: User | null): FerryMaster {
    const validation = this.validateFerry(ferry);
    if (!validation.isValid) {
      throw new Error(`Ferry/Vessel validation failed: ${validation.errors.join(', ')}`);
    }
    return this.db.saveFerry(ferry, user);
  }

  public saveVessel(vessel: FerryMaster, user?: User | null): FerryMaster {
    return this.saveFerry(vessel, user);
  }

  public deleteFerry(id: string, user?: User | null): boolean {
    return this.db.deleteFerry(id, user);
  }

  public deleteVessel(id: string, user?: User | null): boolean {
    return this.deleteFerry(id, user);
  }

  // ==========================================================================
  // ASSET VALIDATION (Section 25)
  // ==========================================================================

  public validateVehicle(vehicle: Partial<VehicleMaster>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!vehicle.name || vehicle.name.trim().length === 0) {
      errors.push('Vehicle name is required.');
    }
    if (!vehicle.seatingCapacity || vehicle.seatingCapacity < 1) {
      errors.push('Seating capacity must be at least 1 passenger.');
    }
    if (!vehicle.status) {
      errors.push('Status is required.');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public validateYacht(yacht: Partial<YachtMaster>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!yacht.name || yacht.name.trim().length === 0) {
      errors.push('Yacht charter name is required.');
    }
    if (!yacht.capacity || yacht.capacity < 1) {
      errors.push('Guest capacity must be at least 1 guest.');
    }
    if (!yacht.status) {
      errors.push('Status is required.');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public validateFerry(ferry: Partial<FerryMaster>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!ferry.name || ferry.name.trim().length === 0) {
      errors.push('Vessel / Ferry name is required.');
    }
    if (!ferry.capacity || ferry.capacity < 1) {
      errors.push('Vessel passenger capacity must be at least 1.');
    }
    if (!ferry.status) {
      errors.push('Status is required.');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const operationalMasterInventory = OperationalMasterInventoryService.getInstance();
