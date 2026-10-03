import { VehicleMaster, YachtMaster, FerryMaster, Product } from '../types';
import { operationalMasterInventory } from './operationalMasterInventoryService';

export interface EligibilityParams {
  productId?: string;
  product?: Product;
  productType?: string;
  destinationId?: string;
  hubId?: string;
  routeId?: string;
  travelDate?: string;
  passengerConfiguration?: {
    adults?: number;
    children?: number;
    infants?: number;
    totalPax?: number;
  };
}

export interface EligibilityResult {
  vehicles: VehicleMaster[];
  yachts: YachtMaster[];
  vessels: FerryMaster[];
  orphanWarnings: string[];
}

/**
 * ============================================================================
 * THEUNBOUND — OPERATIONAL ASSET ELIGIBILITY SERVICE
 * Section 21: Central Eligibility Engine
 * ============================================================================
 * 
 * Rules:
 * 1. Identify Product's eligible Master Inventory IDs.
 * 2. Retrieve authoritative operational records.
 * 3. Filter inactive / archived assets.
 * 4. Apply operational constraints (destination, hub, capacity).
 * 5. Return eligible active assets to Configurators.
 * 6. Configurator must NEVER invent or hardcode operational assets.
 */
export class OperationalAssetEligibilityService {
  private static instance: OperationalAssetEligibilityService;

  private constructor() {}

  public static getInstance(): OperationalAssetEligibilityService {
    if (!OperationalAssetEligibilityService.instance) {
      OperationalAssetEligibilityService.instance = new OperationalAssetEligibilityService();
    }
    return OperationalAssetEligibilityService.instance;
  }

  public getEligibleAssets(params: EligibilityParams): EligibilityResult {
    const { product, destinationId, hubId, passengerConfiguration } = params;
    const totalPax = passengerConfiguration?.totalPax ?? 
      ((passengerConfiguration?.adults || 0) + (passengerConfiguration?.children || 0));

    const orphanWarnings: string[] = [];
    const activeVehicles = operationalMasterInventory.getActiveVehicles();
    const activeYachts = operationalMasterInventory.getActiveYachts();
    const activeVessels = operationalMasterInventory.getActiveFerriesAndVessels();

    let eligibleVehicles: VehicleMaster[] = [];
    let eligibleYachts: YachtMaster[] = [];
    let eligibleVessels: FerryMaster[] = [];

    // --- VEHICLES ---
    if (product) {
      const candidateVehicleIds = new Set<string>();
      if (product.vehicleId) candidateVehicleIds.add(product.vehicleId);
      if (Array.isArray((product as any).vehicleIds)) {
        (product as any).vehicleIds.forEach((id: string) => candidateVehicleIds.add(id));
      }
      if (product.vehicleConfig?.vehicleId) candidateVehicleIds.add(product.vehicleConfig.vehicleId);
      if (Array.isArray(product.tieredPricing)) {
        product.tieredPricing.forEach(t => {
          if (t.fleetId) candidateVehicleIds.add(t.fleetId);
          if (t.vehicleId) candidateVehicleIds.add(t.vehicleId);
        });
      }

      // Check orphan references
      candidateVehicleIds.forEach(vid => {
        const found = operationalMasterInventory.getVehicleById(vid);
        if (!found || found.status !== 'ACTIVE') {
          orphanWarnings.push(
            `Referenced vehicle ID "${vid}" is unavailable in Authoritative Operational Master Inventory.`
          );
        }
      });

      if (candidateVehicleIds.size > 0) {
        eligibleVehicles = activeVehicles.filter(v => candidateVehicleIds.has(v.id));
      } else if (product.destinationId) {
        eligibleVehicles = activeVehicles.filter(v => v.destinationId === product.destinationId);
      } else {
        eligibleVehicles = [...activeVehicles];
      }
    } else if (destinationId) {
      eligibleVehicles = activeVehicles.filter(v => v.destinationId === destinationId);
    } else {
      eligibleVehicles = [...activeVehicles];
    }

    // Filter by capacity if pax specified
    if (totalPax && totalPax > 0) {
      // In private tour / transfer, show vehicles that can accommodate the group, or show all for tiered pricing
      const capacityFiltered = eligibleVehicles.filter(v => v.seatingCapacity >= totalPax);
      if (capacityFiltered.length > 0) {
        eligibleVehicles = capacityFiltered;
      }
    }

    // --- YACHTS ---
    if (product) {
      const candidateYachtIds = new Set<string>();
      if (product.yachtId) candidateYachtIds.add(product.yachtId);
      if (Array.isArray((product as any).yachtIds)) {
        (product as any).yachtIds.forEach((id: string) => candidateYachtIds.add(id));
      }
      if (product.vehicleConfig?.yachtId) candidateYachtIds.add(product.vehicleConfig.yachtId);

      candidateYachtIds.forEach(yid => {
        const found = operationalMasterInventory.getYachtById(yid);
        if (!found || found.status !== 'ACTIVE') {
          orphanWarnings.push(
            `Referenced yacht ID "${yid}" is unavailable in Authoritative Operational Master Inventory.`
          );
        }
      });

      if (candidateYachtIds.size > 0) {
        eligibleYachts = activeYachts.filter(y => candidateYachtIds.has(y.id));
      } else if (product.destinationId) {
        eligibleYachts = activeYachts.filter(y => y.destinationId === product.destinationId);
      } else {
        eligibleYachts = [...activeYachts];
      }
    } else if (destinationId) {
      eligibleYachts = activeYachts.filter(y => y.destinationId === destinationId);
    } else {
      eligibleYachts = [...activeYachts];
    }

    // --- FERRIES & VESSELS ---
    if (product) {
      const candidateVesselIds = new Set<string>();
      if ((product as any).ferryId) candidateVesselIds.add((product as any).ferryId);
      if ((product as any).vesselId) candidateVesselIds.add((product as any).vesselId);
      if (Array.isArray((product as any).vesselIds)) {
        (product as any).vesselIds.forEach((id: string) => candidateVesselIds.add(id));
      }
      if ((product as any).ferryConfig?.vesselId) candidateVesselIds.add((product as any).ferryConfig.vesselId);

      candidateVesselIds.forEach(vid => {
        const found = operationalMasterInventory.getVesselById(vid);
        if (!found || found.status !== 'ACTIVE') {
          orphanWarnings.push(
            `Referenced ferry/vessel ID "${vid}" is unavailable in Authoritative Operational Master Inventory.`
          );
        }
      });

      if (candidateVesselIds.size > 0) {
        eligibleVessels = activeVessels.filter(v => candidateVesselIds.has(v.id));
      } else if (product.destinationId) {
        eligibleVessels = activeVessels.filter(v => v.destinationId === product.destinationId);
      } else {
        eligibleVessels = [...activeVessels];
      }
    } else if (destinationId) {
      eligibleVessels = activeVessels.filter(v => v.destinationId === destinationId);
    } else {
      eligibleVessels = [...activeVessels];
    }

    return {
      vehicles: eligibleVehicles,
      yachts: eligibleYachts,
      vessels: eligibleVessels,
      orphanWarnings
    };
  }

  public getEligibleVehiclesForTransfer(product: Product, paxCount?: number): VehicleMaster[] {
    const res = this.getEligibleAssets({
      product,
      productType: 'Transfers',
      destinationId: product.destinationId,
      hubId: product.fromHubId || product.hubId,
      passengerConfiguration: paxCount ? { totalPax: paxCount } : undefined
    });
    return res.vehicles;
  }

  public getEligibleVehiclesForPrivateTour(product: Product, paxCount?: number): VehicleMaster[] {
    const res = this.getEligibleAssets({
      product,
      productType: 'Private Tours',
      destinationId: product.destinationId,
      hubId: product.hubId,
      passengerConfiguration: paxCount ? { totalPax: paxCount } : undefined
    });
    return res.vehicles;
  }

  public getEligibleYachtsForProduct(product: Product, guestCount?: number): YachtMaster[] {
    const res = this.getEligibleAssets({
      product,
      productType: 'Private Yacht',
      destinationId: product.destinationId,
      hubId: product.hubId,
      passengerConfiguration: guestCount ? { totalPax: guestCount } : undefined
    });
    return res.yachts;
  }

  public getEligibleVesselsForFerry(product: Product, paxCount?: number): FerryMaster[] {
    const res = this.getEligibleAssets({
      product,
      productType: 'Ferries',
      destinationId: product.destinationId,
      hubId: product.hubId,
      passengerConfiguration: paxCount ? { totalPax: paxCount } : undefined
    });
    return res.vessels;
  }

  public checkProductAssetOrphans(product: Product): { hasOrphans: boolean; orphanWarnings: string[] } {
    const warnings: string[] = [];

    if (product.category === 'Transfers' || product.category === 'Private Tours') {
      if (product.vehicleId) {
        const v = operationalMasterInventory.getVehicleById(product.vehicleId);
        if (!v) {
          warnings.push(`Referenced vehicle "${product.vehicleId}" was not found in Authoritative Master Inventory.`);
        } else if (v.status !== 'ACTIVE') {
          warnings.push(`Referenced vehicle "${v.name}" is marked as ${v.status} in Master Inventory.`);
        }
      }
    }

    if (product.category === 'Private Yacht') {
      const yId = product.yachtId || product.vehicleConfig?.yachtId;
      if (yId) {
        const y = operationalMasterInventory.getYachtById(yId);
        if (!y) {
          warnings.push(`Referenced yacht "${yId}" was not found in Authoritative Master Inventory.`);
        } else if (y.status !== 'ACTIVE') {
          warnings.push(`Referenced yacht "${y.name}" is marked as ${y.status} in Master Inventory.`);
        }
      }
    }

    if (product.category === 'Ferries' || (product as any).category === 'Ferry') {
      const fId = (product as any).ferryId || (product as any).vesselId || product.ferryConfig?.vesselId;
      if (fId) {
        const f = operationalMasterInventory.getVesselById(fId);
        if (!f) {
          warnings.push(`Referenced vessel "${fId}" was not found in Authoritative Master Inventory.`);
        } else if (f.status !== 'ACTIVE') {
          warnings.push(`Referenced vessel "${f.name}" is marked as ${f.status} in Master Inventory.`);
        }
      }
    }

    return {
      hasOrphans: warnings.length > 0,
      orphanWarnings: warnings
    };
  }
}

export const operationalAssetEligibility = OperationalAssetEligibilityService.getInstance();
