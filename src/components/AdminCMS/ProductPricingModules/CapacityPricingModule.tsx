import React from 'react';
import { CurrencyCode, TransferVehicleConfig } from '../../../types';
import { formatCurrency } from '../../../services/pricingEngine';
import { Car, Ship, Users, Calculator, Gauge } from 'lucide-react';

interface CapacityPricingModuleProps {
  category: string;
  currency: CurrencyCode;
  vehicleConfig?: TransferVehicleConfig;
  buyerMarkupPercent: number;
  b2bAgentMarkupPercent: number;
  taxPercent: number;
  serviceFeeFixed: number;
  onChange: (updatedVehicleConfig: TransferVehicleConfig) => void;
  onMarkupChange: (buyerMarkup: number, agentMarkup: number, tax: number, fee: number, currency: CurrencyCode) => void;
}

export const CapacityPricingModule: React.FC<CapacityPricingModuleProps> = ({
  category,
  currency,
  vehicleConfig,
  buyerMarkupPercent,
  b2bAgentMarkupPercent,
  taxPercent,
  serviceFeeFixed,
  onChange,
  onMarkupChange
}) => {
  const isYacht = category === 'Private Yacht' || category === 'Yacht';
  const defaultMaxSeats = isYacht ? 10 : 7;
  const currentMaxSeats = vehicleConfig?.maxSeats || defaultMaxSeats;
  const unitCost = vehicleConfig?.unitVehicleNetCost !== undefined ? vehicleConfig.unitVehicleNetCost : 500;

  const currentCfg: TransferVehicleConfig = {
    vehicleModel: vehicleConfig?.vehicleModel || (isYacht ? 'Azimut 66 Flybridge Luxury Yacht' : 'Toyota Hiace Grand Cabin (7-Seater)'),
    vehicleType: vehicleConfig?.vehicleType || (isYacht ? 'Motor Yacht' : 'Executive MPV / Van'),
    maxSeats: currentMaxSeats,
    unitVehicleNetCost: unitCost,
    adultSeatCount: vehicleConfig?.adultSeatCount ?? 1,
    childSeatCount: vehicleConfig?.childSeatCount ?? 1,
    infantSeatCount: vehicleConfig?.infantSeatCount ?? 0,
    allowMultipleVehicles: vehicleConfig?.allowMultipleVehicles ?? true,
    autoAllocateVehicles: vehicleConfig?.autoAllocateVehicles ?? true,
    maxVehicles: vehicleConfig?.maxVehicles || 5,
    totalSeats: currentMaxSeats,
    passengerCapacity: currentMaxSeats,
    totalTransferCost: unitCost,
    route: vehicleConfig?.route || 'Airport Transfer (Airport ↔ Hotel)',
    maxLuggage: vehicleConfig?.maxLuggage ?? 6,
    yachtSize: vehicleConfig?.yachtSize || '66 ft / 20.8 m',
    yachtLength: vehicleConfig?.yachtLength || '66 ft / 20.8 m'
  };

  const updateConfig = (patch: Partial<TransferVehicleConfig>) => {
    onChange({ ...currentCfg, ...patch });
  };

  const calculateDeliveredPrice = (net: number, markup: number, tax: number, fee: number) => {
    const markupAmt = net * (markup / 100);
    const taxAmt = markupAmt * (tax / 100);
    return Math.round(net + markupAmt + taxAmt + fee);
  };

  return (
    <div className="space-y-4">
      {/* Vehicle / Yacht Specifications Card */}
      <div className="bg-slate-800/80 p-4 rounded-xl border border-teal-500/30 space-y-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#00E5C0] flex items-center gap-1.5">
            {isYacht ? <Ship className="w-4 h-4" /> : <Car className="w-4 h-4" />}
            <span>
              {isYacht
                ? 'Private Yacht Specifications & Charter Capacity'
                : 'Vehicle Fleet & Seating Capacity Specifications'}
            </span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {isYacht
              ? 'Auto-allocates multiple yachts when guest capacity is exceeded'
              : 'Auto-allocates multiple vehicles when capacity is exceeded'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs text-slate-800">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] text-slate-300 font-medium">
              {isYacht ? 'Yacht Model / Charter Name *' : 'Vehicle Model / Fleet Name *'}
            </label>
            <input
              type="text"
              value={currentCfg.vehicleModel || ''}
              onChange={e => updateConfig({ vehicleModel: e.target.value, yachtModel: e.target.value, vehicleName: e.target.value })}
              placeholder={isYacht ? 'e.g. Azimut 66 Flybridge (10-Pax)' : 'e.g. Toyota Hiace Grand Cabin (7-Seater)'}
              className="w-full p-2 bg-white rounded-lg font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">
              {isYacht ? 'Yacht Classification' : 'Vehicle Classification'}
            </label>
            <select
              value={currentCfg.vehicleType}
              onChange={e => updateConfig({ vehicleType: e.target.value, yachtType: e.target.value })}
              className="w-full p-2 bg-white rounded-lg font-medium text-xs"
            >
              {isYacht ? (
                <>
                  <option value="Motor Yacht">Motor Yacht (Luxury Flybridge)</option>
                  <option value="Catamaran">Catamaran (High Stability)</option>
                  <option value="Sailing Yacht">Sailing Yacht / Monohull</option>
                  <option value="Superyacht">Superyacht / Megayacht</option>
                  <option value="Speedboat">Speedboat / Day Cruiser</option>
                  <option value="Gulet / Wooden Boat">Gulet / Wooden Classic</option>
                </>
              ) : (
                <>
                  <option value="Executive Sedan">Executive Sedan (1–3 Seats)</option>
                  <option value="Executive MPV / Van">Executive MPV / Van (4–7 Seats)</option>
                  <option value="Minibus / Sprinter">Minibus / Sprinter (8–16 Seats)</option>
                  <option value="Luxury Coach">Luxury Coach (17–45 Seats)</option>
                  <option value="Private Yacht / Boat">Private Yacht / Boat</option>
                </>
              )}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">
              {isYacht ? 'Max Guest Capacity *' : 'Max Seating Capacity *'}
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="100"
                value={currentCfg.maxSeats}
                onChange={e => {
                  const seats = Math.max(1, Number(e.target.value));
                  updateConfig({ maxSeats: seats, totalSeats: seats, passengerCapacity: seats });
                }}
                className="w-full p-2 bg-white rounded-lg font-bold pr-12"
              />
              <span className="absolute right-2.5 top-2 text-[10px] font-bold text-slate-400">
                {isYacht ? 'GUESTS' : 'SEATS'}
              </span>
            </div>
          </div>
        </div>

        {/* Transfers specific: Luggage limit & Route Type */}
        {category === 'Transfers' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-800 pt-2 border-t border-slate-700">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-300 font-medium">Transfer Route Type</label>
              <select
                value={currentCfg.route}
                onChange={e => updateConfig({ route: e.target.value })}
                className="w-full p-2 bg-white rounded-lg font-medium text-xs"
              >
                <option value="Airport Transfer (Airport ↔ Hotel)">Airport Transfer (Airport ↔ Hotel)</option>
                <option value="Station Transfer (Bullet Train Station ↔ Hotel)">Station Transfer (Bullet Train Station ↔ Hotel)</option>
                <option value="Intercity Chauffeur (e.g. Tokyo → Hakone / Kyoto → Osaka)">Intercity Chauffeur (e.g. Tokyo → Hakone)</option>
                <option value="City Point-to-Point (Dinner / Meeting transfer)">City Point-to-Point (Dinner / Meeting)</option>
                <option value="Full-Day Chauffeur Standby (10 Hours)">Full-Day Chauffeur Standby (10 Hours)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-300 font-medium">Luggage Capacity (Bags)</label>
              <input
                type="number"
                min="0"
                value={currentCfg.maxLuggage ?? 6}
                onChange={e => updateConfig({ maxLuggage: Number(e.target.value) })}
                placeholder="e.g. 6 Standard Suitcases"
                className="w-full p-2 bg-white rounded-lg font-bold text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-300 font-medium">Flight Number Requirement</label>
              <div className="pt-1.5 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="flightReq"
                  defaultChecked={true}
                  className="rounded text-[#00C6A6] focus:ring-[#00C6A6] w-4 h-4"
                />
                <label htmlFor="flightReq" className="text-[11px] text-slate-300 cursor-pointer">
                  Mandatory Flight No. tracking
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Yacht Size / Length when Category is Private Yacht */}
        {isYacht && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-800 pt-2 border-t border-slate-700">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-300 font-medium">Yacht Length / Dimensions</label>
              <input
                type="text"
                value={currentCfg.yachtSize || currentCfg.yachtLength || '66 ft / 20.8 m'}
                onChange={e => updateConfig({ yachtSize: e.target.value, yachtLength: e.target.value })}
                placeholder="e.g. 66 ft / 20.8 m"
                className="w-full p-2 bg-white rounded-lg font-medium text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-300 font-medium">Standard Capacity Presets</label>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {[6, 8, 10, 12, 15, 20, 30, 50].map(cap => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => updateConfig({ maxSeats: cap, totalSeats: cap, passengerCapacity: cap })}
                    className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-all ${
                      currentCfg.maxSeats === cap
                        ? 'bg-[#00C6A6] text-slate-950 shadow-xs'
                        : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                    }`}
                  >
                    {cap} Pax
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Total Vehicle / Yacht Net Cost & Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-800 pt-2 border-t border-slate-700">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Base Currency</label>
            <select
              value={currency}
              onChange={e => onMarkupChange(buyerMarkupPercent, b2bAgentMarkupPercent, taxPercent, serviceFeeFixed, e.target.value as CurrencyCode)}
              className="w-full p-2 bg-white rounded-lg font-bold"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="INR">INR (₹)</option>
              <option value="AED">AED (AED)</option>
              <option value="THB">THB (฿)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="CAD">CAD (CA$)</option>
              <option value="SGD">SGD (S$)</option>
              <option value="CHF">CHF (CHF)</option>
            </select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-[11px] text-emerald-400 font-bold flex items-center justify-between">
              <span>
                {isYacht
                  ? `Total Unit Yacht Charter Nett Cost * (Constant for 1 to ${currentCfg.maxSeats} Pax)`
                  : `Total Unit Vehicle Nett Cost * (Constant for 1 to ${currentCfg.maxSeats} Pax)`}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">DMC Contracted Cost</span>
            </label>
            <input
              type="number"
              required
              min="0"
              value={currentCfg.unitVehicleNetCost}
              onChange={e => updateConfig({ unitVehicleNetCost: Number(e.target.value), totalTransferCost: Number(e.target.value) })}
              placeholder="e.g. 500"
              className="w-full p-2 bg-white rounded-lg font-bold text-sm"
            />
          </div>
        </div>

        {/* Operational Occupancy Constraints */}
        <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-700 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
            <span className="flex items-center gap-1 text-slate-200">
              <Gauge className="w-3.5 h-3.5 text-[#00E5C0]" />
              <span>
                {isYacht ? 'Guest Capacity & Manifest Rules' : 'Passenger Seat Occupancy Rules (Operational Constraints)'}
              </span>
            </span>
            <span className="text-[10px] text-slate-400">
              {isYacht ? 'Passenger capacity slots utilized' : 'Number of physical seats occupied per person'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-slate-800 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-300 font-medium">Adults</label>
              <input
                type="number"
                min="1"
                max="4"
                value={currentCfg.adultSeatCount ?? 1}
                onChange={e => updateConfig({ adultSeatCount: Number(e.target.value) })}
                className="w-full p-1.5 bg-white rounded text-center font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-300 font-medium">Children</label>
              <input
                type="number"
                min="0"
                max="2"
                value={currentCfg.childSeatCount ?? 1}
                onChange={e => updateConfig({ childSeatCount: Number(e.target.value) })}
                className="w-full p-1.5 bg-white rounded text-center font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-300 font-medium">Infants (Lap = 0 / Slot = 1)</label>
              <input
                type="number"
                min="0"
                max="1"
                value={currentCfg.infantSeatCount ?? 0}
                onChange={e => updateConfig({ infantSeatCount: Number(e.target.value) })}
                className="w-full p-1.5 bg-white rounded text-center font-bold"
              />
            </div>
          </div>
        </div>

        {/* Multi-Vehicle / Yacht Allocation Toggle */}
        <div className="flex items-center justify-between text-xs pt-1">
          <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={currentCfg.allowMultipleVehicles ?? true}
              onChange={e => updateConfig({ allowMultipleVehicles: e.target.checked, autoAllocateVehicles: e.target.checked })}
              className="rounded text-[#00C6A6] focus:ring-[#00C6A6] w-4 h-4"
            />
            <span>
              {isYacht
                ? `Allow auto-allocation of multiple yachts if passenger count exceeds ${currentCfg.maxSeats} guests`
                : `Allow auto-allocation of multiple vehicles if passenger count exceeds ${currentCfg.maxSeats} seats`}
            </span>
          </label>
          <span className="text-[10px] text-slate-400">
            {isYacht ? 'Max charter: 5 yachts' : 'Max fleet: 5 vehicles'}
          </span>
        </div>
      </div>

      {/* LIVE INTERACTIVE PASSENGER CAPACITY SIMULATION TABLE */}
      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#00E5C0] flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5" />
            <span>
              {isYacht
                ? 'Live Yacht Charter Capacity & Pricing Simulation Table'
                : 'Live Capacity-Based Pricing Simulation Table'}
            </span>
          </span>
          <span className="text-[10px] text-slate-400">
            {isYacht
              ? 'Total Yacht Nett remains constant until max capacity is exceeded'
              : 'Total Nett remains constant until vehicle capacity is exceeded'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-1.5 font-semibold">Pax Count</th>
                <th className="pb-1.5 font-semibold">
                  {isYacht ? 'Yachts' : 'Vehicles'}
                </th>
                <th className="pb-1.5 font-semibold text-right">
                  {isYacht ? 'Total Yacht Nett' : 'Total Vehicle Nett'}
                </th>
                <th className="pb-1.5 font-semibold text-right text-[#00E5C0]">Per-Person Nett</th>
                <th className="pb-1.5 font-semibold text-right text-emerald-400">Buyer Delivered Total</th>
                <th className="pb-1.5 font-semibold text-right text-emerald-300">Buyer Per-Person</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 text-slate-300">
              {[1, 2, 4, currentCfg.maxSeats, currentCfg.maxSeats + 1, currentCfg.maxSeats * 2]
                .filter((v, i, a) => a.indexOf(v) === i)
                .sort((a, b) => a - b)
                .map(simPax => {
                  const maxS = currentCfg.maxSeats;
                  const vehCount = Math.max(1, Math.ceil(simPax / maxS));
                  const totalVehNett = vehCount * unitCost;
                  const perPersonNett = totalVehNett / simPax;
                  const totalSelling = calculateDeliveredPrice(totalVehNett, buyerMarkupPercent, taxPercent, serviceFeeFixed);
                  const perPersonSelling = totalSelling / simPax;
                  const isFull = simPax === maxS;
                  const isOver = simPax > maxS;

                  return (
                    <tr key={simPax} className={`hover:bg-slate-900/60 ${isFull ? 'bg-teal-950/40 text-teal-200 font-semibold' : ''}`}>
                      <td className="py-1.5 flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-500" />
                        <span>{simPax} Pax</span>
                        {isFull && <span className="text-[9px] bg-teal-500/20 text-[#00E5C0] px-1 rounded ml-1">MAX CAPACITY</span>}
                        {isOver && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded ml-1">
                            {isYacht ? '2nd YACHT' : '2nd VEHICLE'}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5">
                        {vehCount} {isYacht ? (vehCount === 1 ? 'Yacht' : 'Yachts') : (vehCount === 1 ? 'Vehicle' : 'Vehicles')}
                      </td>
                      <td className="py-1.5 text-right font-mono">{formatCurrency(totalVehNett, currency)}</td>
                      <td className="py-1.5 text-right font-mono font-bold text-[#00E5C0]">{formatCurrency(perPersonNett, currency)}</td>
                      <td className="py-1.5 text-right font-mono text-emerald-400">{formatCurrency(totalSelling, currency)}</td>
                      <td className="py-1.5 text-right font-mono font-bold text-emerald-300">{formatCurrency(perPersonSelling, currency)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
