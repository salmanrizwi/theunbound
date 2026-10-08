import React, { useState, useEffect, useMemo } from 'react';
import { VehicleMaster, YachtMaster, FerryMaster, Destination, CityHub, Supplier } from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { 
  Car, 
  Ship, 
  Anchor, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  MapPin, 
  Users, 
  Briefcase, 
  ShieldCheck, 
  AlertCircle,
  Filter,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface OperationalAssetsManagerProps {
  destinations?: Destination[];
  cityHubs?: CityHub[];
  suppliers?: Supplier[];
  onClose?: () => void;
  initialTab?: 'VEHICLES' | 'YACHTS' | 'FERRIES';
}

export const OperationalAssetsManager: React.FC<OperationalAssetsManagerProps> = ({
  destinations: propsDestinations,
  cityHubs: propsCityHubs,
  suppliers: propsSuppliers,
  onClose,
  initialTab = 'VEHICLES'
}) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'VEHICLES' | 'YACHTS' | 'FERRIES'>(initialTab);
  const [vehicles, setVehicles] = useState<VehicleMaster[]>(() => db.getVehicles());
  const [yachts, setYachts] = useState<YachtMaster[]>(() => db.getYachts());
  const [ferries, setFerries] = useState<FerryMaster[]>(() => db.getFerries());
  const [searchQuery, setSearchQuery] = useState('');

  // Loaded metadata
  const destinations = propsDestinations || db.getDestinations();
  const cityHubs = propsCityHubs || db.getCityHubs();
  const suppliers = propsSuppliers || db.getSuppliers();

  useEffect(() => {
    return db.subscribe(() => {
      setVehicles(db.getVehicles());
      setYachts(db.getYachts());
      setFerries(db.getFerries());
    });
  }, []);

  // Modal editor states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Partial<VehicleMaster> | null>(null);
  const [editingYacht, setEditingYacht] = useState<Partial<YachtMaster> | null>(null);
  const [editingFerry, setEditingFerry] = useState<Partial<FerryMaster> | null>(null);

  // Filtered lists
  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) return vehicles;
    const q = searchQuery.toLowerCase();
    return vehicles.filter(v => 
      v.name.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.classification.toLowerCase().includes(q) ||
      (v.hubName || '').toLowerCase().includes(q)
    );
  }, [vehicles, searchQuery]);

  const filteredYachts = useMemo(() => {
    if (!searchQuery.trim()) return yachts;
    const q = searchQuery.toLowerCase();
    return yachts.filter(y => 
      y.name.toLowerCase().includes(q) ||
      y.model.toLowerCase().includes(q) ||
      y.classification.toLowerCase().includes(q) ||
      (y.hubName || '').toLowerCase().includes(q)
    );
  }, [yachts, searchQuery]);

  const filteredFerries = useMemo(() => {
    if (!searchQuery.trim()) return ferries;
    const q = searchQuery.toLowerCase();
    return ferries.filter(f => 
      f.name.toLowerCase().includes(q) ||
      f.route.toLowerCase().includes(q) ||
      f.vesselClass.toLowerCase().includes(q) ||
      (f.hubName || '').toLowerCase().includes(q)
    );
  }, [ferries, searchQuery]);

  // Open Create Handlers
  const handleOpenCreateVehicle = () => {
    const firstDest = destinations[0] || { id: 'dest-japan', name: 'Japan' };
    const hubs = cityHubs.filter(h => h.destinationId === firstDest.id);
    setEditingVehicle({
      id: `veh-${Date.now().toString().slice(-4)}`,
      name: '',
      model: '',
      type: 'Executive MPV',
      classification: 'Executive MPV / Van (4–7 Seats)',
      manufacturer: 'Toyota',
      seatingCapacity: 7,
      luggageCapacity: 4,
      destinationId: firstDest.id,
      destinationName: firstDest.name,
      hubId: hubs[0]?.id || '',
      hubName: hubs[0]?.name || '',
      status: 'ACTIVE'
    });
    setEditingYacht(null);
    setEditingFerry(null);
    setIsModalOpen(true);
  };

  const handleOpenCreateYacht = () => {
    const firstDest = destinations[0] || { id: 'dest-japan', name: 'Japan' };
    const hubs = cityHubs.filter(h => h.destinationId === firstDest.id);
    setEditingYacht({
      id: `yacht-${Date.now().toString().slice(-4)}`,
      name: '',
      model: '',
      type: 'Motor Yacht',
      classification: 'Motor Yacht (Luxury Flybridge)',
      capacity: 12,
      length: '',
      dimensions: '',
      destinationId: firstDest.id,
      destinationName: firstDest.name,
      hubId: hubs[0]?.id || '',
      hubName: hubs[0]?.name || '',
      status: 'ACTIVE'
    });
    setEditingVehicle(null);
    setEditingFerry(null);
    setIsModalOpen(true);
  };

  const handleOpenCreateFerry = () => {
    const firstDest = destinations[0] || { id: 'dest-japan', name: 'Japan' };
    const hubs = cityHubs.filter(h => h.destinationId === firstDest.id);
    setEditingFerry({
      id: `ferry-${Date.now().toString().slice(-4)}`,
      name: '',
      type: 'Standard Ferry',
      vesselClass: 'Standard Car & Passenger Ferry',
      capacity: 500,
      route: '',
      origin: '',
      destination: '',
      destinationId: firstDest.id,
      destinationName: firstDest.name,
      hubId: hubs[0]?.id || '',
      hubName: hubs[0]?.name || '',
      status: 'ACTIVE'
    });
    setEditingVehicle(null);
    setEditingYacht(null);
    setIsModalOpen(true);
  };

  // Save Handlers
  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle || !editingVehicle.name) return;
    db.saveVehicle(editingVehicle as VehicleMaster, user);
    setIsModalOpen(false);
    setEditingVehicle(null);
  };

  const handleSaveYacht = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingYacht || !editingYacht.name) return;
    db.saveYacht(editingYacht as YachtMaster, user);
    setIsModalOpen(false);
    setEditingYacht(null);
  };

  const handleSaveFerry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFerry || !editingFerry.name) return;
    db.saveFerry(editingFerry as FerryMaster, user);
    setIsModalOpen(false);
    setEditingFerry(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Authoritative Operational Master Inventory</span>
            <span className="text-[10px] bg-teal-50 text-[#008972] border border-teal-200 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Single Source of Truth
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational vehicles, luxury charter yachts, and maritime passenger vessels selectable in Product Management.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Back to Products
            </button>
          )}

          {activeTab === 'VEHICLES' && (
            <button
              type="button"
              onClick={handleOpenCreateVehicle}
              className="flex items-center px-4 py-2 bg-[#00C6A6] text-slate-950 font-bold rounded-xl text-xs shadow-xs hover:bg-[#00b395] transition-all cursor-pointer"
            >
              <span>Add Vehicle Master</span>
            </button>
          )}

          {activeTab === 'YACHTS' && (
            <button
              type="button"
              onClick={handleOpenCreateYacht}
              className="flex items-center px-4 py-2 bg-[#00C6A6] text-slate-950 font-bold rounded-xl text-xs shadow-xs hover:bg-[#00b395] transition-all cursor-pointer"
            >
              <span>Add Yacht Master</span>
            </button>
          )}

          {activeTab === 'FERRIES' && (
            <button
              type="button"
              onClick={handleOpenCreateFerry}
              className="flex items-center px-4 py-2 bg-[#00C6A6] text-slate-950 font-bold rounded-xl text-xs shadow-xs hover:bg-[#00b395] transition-all cursor-pointer"
            >
              <span>Add Ferry / Vessel Master</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('VEHICLES')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'VEHICLES'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Car className="w-4 h-4 text-emerald-600" />
            <span>Vehicles ({vehicles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('YACHTS')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'YACHTS'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Ship className="w-4 h-4 text-blue-600" />
            <span>Yachts ({yachts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('FERRIES')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'FERRIES'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Anchor className="w-4 h-4 text-cyan-600" />
            <span>Ferries & Vessels ({ferries.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab.toLowerCase()}...`}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#00C6A6]"
          />
        </div>
      </div>

      {/* 1. VEHICLES TABLE */}
      {activeTab === 'VEHICLES' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3.5">Vehicle Name & Model</th>
                <th className="p-3.5">Classification</th>
                <th className="p-3.5">Capacity</th>
                <th className="p-3.5">Luggage</th>
                <th className="p-3.5">Hub / Destination</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVehicles.map(veh => (
                <tr key={veh.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-900">{veh.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">ID: {veh.id} • {veh.model}</div>
                  </td>
                  <td className="p-3.5">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium text-[11px]">
                      {veh.classification || veh.type}
                    </span>
                  </td>
                  <td className="p-3.5 font-bold text-emerald-700">
                    {veh.seatingCapacity} Seats
                  </td>
                  <td className="p-3.5 text-slate-600">
                    {veh.luggageCapacity ? `${veh.luggageCapacity} Bags` : '—'}
                  </td>
                  <td className="p-3.5 text-slate-600">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{veh.hubName || veh.destinationName || 'National'}</span>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      {veh.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVehicle(veh);
                          setEditingYacht(null);
                          setEditingFerry(null);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        title="Edit Vehicle"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete vehicle "${veh.name}"?`)) {
                            db.deleteVehicle(veh.id, user);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete Vehicle"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. YACHTS TABLE */}
      {activeTab === 'YACHTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3.5">Yacht Name & Model</th>
                <th className="p-3.5">Classification</th>
                <th className="p-3.5">Max Guest Capacity</th>
                <th className="p-3.5">Length / Dimensions</th>
                <th className="p-3.5">Home Port / Hub</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredYachts.map(yacht => (
                <tr key={yacht.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-900">{yacht.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">ID: {yacht.id} • {yacht.model}</div>
                  </td>
                  <td className="p-3.5">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium text-[11px]">
                      {yacht.classification || yacht.type}
                    </span>
                  </td>
                  <td className="p-3.5 font-bold text-blue-700">
                    {yacht.capacity} Guests
                  </td>
                  <td className="p-3.5 text-slate-600 font-mono text-[11px]">
                    {yacht.length || yacht.dimensions || '—'}
                  </td>
                  <td className="p-3.5 text-slate-600">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{yacht.hubName || yacht.destinationName || 'Marine Basin'}</span>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      {yacht.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingYacht(yacht);
                          setEditingVehicle(null);
                          setEditingFerry(null);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        title="Edit Yacht"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete yacht "${yacht.name}"?`)) {
                            db.deleteYacht(yacht.id, user);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete Yacht"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. FERRIES TABLE */}
      {activeTab === 'FERRIES' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3.5">Ferry / Vessel Name</th>
                <th className="p-3.5">Vessel Class</th>
                <th className="p-3.5">Route</th>
                <th className="p-3.5">Passenger Capacity</th>
                <th className="p-3.5">Operator</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFerries.map(ferry => (
                <tr key={ferry.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-900">{ferry.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">ID: {ferry.id}</div>
                  </td>
                  <td className="p-3.5">
                    <span className="bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded font-medium text-[11px]">
                      {ferry.vesselClass || ferry.type}
                    </span>
                  </td>
                  <td className="p-3.5 font-medium text-slate-800">
                    {ferry.route}
                  </td>
                  <td className="p-3.5 font-bold text-cyan-700">
                    {ferry.capacity} Passengers
                  </td>
                  <td className="p-3.5 text-slate-600">
                    {ferry.operator || 'Official Line'}
                  </td>
                  <td className="p-3.5">
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      {ferry.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFerry(ferry);
                          setEditingVehicle(null);
                          setEditingYacht(null);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        title="Edit Ferry"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete ferry "${ferry.name}"?`)) {
                            db.deleteFerry(ferry.id, user);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete Ferry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL EDITOR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingVehicle && 'Configure Vehicle Master Asset'}
                {editingYacht && 'Configure Yacht Master Asset'}
                {editingFerry && 'Configure Ferry / Vessel Master Asset'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vehicle Form */}
            {editingVehicle && (
              <form onSubmit={handleSaveVehicle} className="space-y-3 text-xs text-slate-800">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Vehicle Name *</label>
                    <input
                      type="text"
                      required
                      value={editingVehicle.name || ''}
                      onChange={e => setEditingVehicle({ ...editingVehicle, name: e.target.value })}
                      placeholder="e.g. Toyota Alphard Executive MPV"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Model Specification *</label>
                    <input
                      type="text"
                      required
                      value={editingVehicle.model || ''}
                      onChange={e => setEditingVehicle({ ...editingVehicle, model: e.target.value })}
                      placeholder="e.g. Toyota Alphard (7-Seater)"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Classification</label>
                    <select
                      value={editingVehicle.classification}
                      onChange={e => setEditingVehicle({ ...editingVehicle, classification: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="Executive Sedan (1–3 Seats)">Executive Sedan (1–3 Seats)</option>
                      <option value="Executive MPV / Van (4–7 Seats)">Executive MPV / Van (4–7 Seats)</option>
                      <option value="Minibus / Sprinter (8–16 Seats)">Minibus / Sprinter (8–16 Seats)</option>
                      <option value="Luxury Coach (17–45 Seats)">Luxury Coach (17–45 Seats)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Seating Capacity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="100"
                      value={editingVehicle.seatingCapacity || 7}
                      onChange={e => setEditingVehicle({ ...editingVehicle, seatingCapacity: Number(e.target.value) })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Luggage Capacity</label>
                    <input
                      type="number"
                      min="0"
                      value={editingVehicle.luggageCapacity || 4}
                      onChange={e => setEditingVehicle({ ...editingVehicle, luggageCapacity: Number(e.target.value) })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Destination</label>
                    <select
                      value={editingVehicle.destinationId}
                      onChange={e => {
                        const dest = destinations.find(d => d.id === e.target.value);
                        setEditingVehicle({
                          ...editingVehicle,
                          destinationId: e.target.value,
                          destinationName: dest?.name || ''
                        });
                      }}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                    >
                      {destinations.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">City Hub</label>
                    <select
                      value={editingVehicle.hubId || ''}
                      onChange={e => {
                        const hub = cityHubs.find(h => h.id === e.target.value);
                        setEditingVehicle({
                          ...editingVehicle,
                          hubId: e.target.value,
                          hubName: hub?.name || ''
                        });
                      }}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="">-- Choose Hub --</option>
                      {cityHubs.filter(h => !editingVehicle.destinationId || h.destinationId === editingVehicle.destinationId).map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#00C6A6] text-slate-950 font-bold rounded-xl hover:bg-[#00b395]"
                  >
                    Save Vehicle
                  </button>
                </div>
              </form>
            )}

            {/* Yacht Form */}
            {editingYacht && (
              <form onSubmit={handleSaveYacht} className="space-y-3 text-xs text-slate-800">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Yacht Name *</label>
                    <input
                      type="text"
                      required
                      value={editingYacht.name || ''}
                      onChange={e => setEditingYacht({ ...editingYacht, name: e.target.value })}
                      placeholder="e.g. Ocean Pearl (Azimut 66 Flybridge)"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Model Specification *</label>
                    <input
                      type="text"
                      required
                      value={editingYacht.model || ''}
                      onChange={e => setEditingYacht({ ...editingYacht, model: e.target.value })}
                      placeholder="e.g. Azimut 66 Flybridge Luxury Yacht"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Classification</label>
                    <select
                      value={editingYacht.classification}
                      onChange={e => setEditingYacht({ ...editingYacht, classification: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="Motor Yacht (Luxury Flybridge)">Motor Yacht (Luxury Flybridge)</option>
                      <option value="Catamaran (High Stability)">Catamaran (High Stability)</option>
                      <option value="Sailing Yacht / Monohull">Sailing Yacht / Monohull</option>
                      <option value="Superyacht / Megayacht">Superyacht / Megayacht</option>
                      <option value="Speedboat / Day Cruiser">Speedboat / Day Cruiser</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Max Guest Capacity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="100"
                      value={editingYacht.capacity || 12}
                      onChange={e => setEditingYacht({ ...editingYacht, capacity: Number(e.target.value) })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Length / Dimensions</label>
                    <input
                      type="text"
                      value={editingYacht.length || ''}
                      onChange={e => setEditingYacht({ ...editingYacht, length: e.target.value, dimensions: e.target.value })}
                      placeholder="e.g. 66 ft / 20.8 m"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#00C6A6] text-slate-950 font-bold rounded-xl hover:bg-[#00b395]"
                  >
                    Save Yacht
                  </button>
                </div>
              </form>
            )}

            {/* Ferry Form */}
            {editingFerry && (
              <form onSubmit={handleSaveFerry} className="space-y-3 text-xs text-slate-800">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Ferry / Vessel Name *</label>
                    <input
                      type="text"
                      required
                      value={editingFerry.name || ''}
                      onChange={e => setEditingFerry({ ...editingFerry, name: e.target.value })}
                      placeholder="e.g. JR Miyajima Ferry (Nanaura Maru)"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Route *</label>
                    <input
                      type="text"
                      required
                      value={editingFerry.route || ''}
                      onChange={e => setEditingFerry({ ...editingFerry, route: e.target.value })}
                      placeholder="e.g. Miyajimaguchi ↔ Miyajima Island"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Passenger Capacity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={editingFerry.capacity || 500}
                      onChange={e => setEditingFerry({ ...editingFerry, capacity: Number(e.target.value) })}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Operator</label>
                    <input
                      type="text"
                      value={editingFerry.operator || ''}
                      onChange={e => setEditingFerry({ ...editingFerry, operator: e.target.value })}
                      placeholder="e.g. JR West Miyajima Ferry Co."
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#00C6A6] text-slate-950 font-bold rounded-xl hover:bg-[#00b395]"
                  >
                    Save Ferry / Vessel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
