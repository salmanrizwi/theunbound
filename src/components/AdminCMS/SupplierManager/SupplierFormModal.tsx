import React, { useState, useEffect } from 'react';
import { Supplier, SupplierStatus, CurrencyCode, User } from '../../../types';
import { db } from '../../../services/db';
import { 
  X, 
  Building2, 
  User as UserIcon, 
  CreditCard, 
  FileSpreadsheet, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ShieldCheck, 
  Globe2,
  Clock,
  PhoneCall
} from 'lucide-react';

interface SupplierFormModalProps {
  initialSupplier?: Supplier | null;
  currentUser: User | null;
  onClose: () => void;
  onSave: (supplier: Supplier) => void;
}

const AVAILABLE_CATEGORIES = [
  'Hotels',
  'Transfers',
  'Activities',
  'Day Tours',
  'Guides',
  'Rail',
  'Visa',
  'Private Yachts',
  'Sub-DMC Partner',
  'Ticket Desk',
  'Luggage & Logistics'
];

const AVAILABLE_DESTINATIONS = [
  'Japan',
  'Singapore',
  'Thailand',
  'United Arab Emirates',
  'United Kingdom',
  'France',
  'Italy',
  'Switzerland',
  'Maldives',
  'Indonesia'
];

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  initialSupplier,
  currentUser,
  onClose,
  onSave
}) => {
  const isEditing = Boolean(initialSupplier);

  const [activeTab, setActiveTab] = useState<'GENERAL' | 'CONTACTS' | 'COMMERCIAL' | 'BANKING' | 'COVERAGE'>('GENERAL');
  
  // Tab 1: General
  const [supplierCode, setSupplierCode] = useState(initialSupplier?.supplierCode || '');
  const [name, setName] = useState(initialSupplier?.name || '');
  const [legalName, setLegalName] = useState(initialSupplier?.legalName || '');
  const [tradingName, setTradingName] = useState(initialSupplier?.tradingName || '');
  const [country, setCountry] = useState(initialSupplier?.country || 'Japan');
  const [destination, setDestination] = useState(initialSupplier?.destination || 'Japan');
  const [hubsInput, setHubsInput] = useState(initialSupplier?.hubs?.join(', ') || 'Tokyo, Kyoto, Osaka');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialSupplier?.categories && initialSupplier.categories.length > 0 ? initialSupplier.categories : ['Transfers']
  );
  const [status, setStatus] = useState<SupplierStatus>(initialSupplier?.status || 'ACTIVE');
  const [website, setWebsite] = useState(initialSupplier?.website || '');
  const [taxRegistrationNumber, setTaxRegistrationNumber] = useState(initialSupplier?.taxRegistrationNumber || '');
  const [address, setAddress] = useState(initialSupplier?.address || '');

  // Tab 2: Contacts
  const [primaryContactPerson, setPrimaryContactPerson] = useState(initialSupplier?.contactPerson || '');
  const [primaryDesignation, setPrimaryDesignation] = useState(initialSupplier?.contactPersons?.[0]?.designation || 'Operations Manager');
  const [primaryEmail, setPrimaryEmail] = useState(initialSupplier?.email || '');
  const [primaryPhone, setPrimaryPhone] = useState(initialSupplier?.phone || '');
  const [emergencyPhone, setEmergencyPhone] = useState(initialSupplier?.emergencyPhone || '');
  const [additionalContacts, setAdditionalContacts] = useState<Array<{
    name: string;
    designation: string;
    role: string;
    email: string;
    phone: string;
    isPrimary?: boolean;
    isEmergency24x7?: boolean;
  }>>(
    initialSupplier?.contactPersons && initialSupplier.contactPersons.length > 1
      ? initialSupplier.contactPersons.slice(1)
      : []
  );

  // Tab 3: Commercial
  const [currency, setCurrency] = useState<CurrencyCode>(initialSupplier?.currency || 'USD');
  const [paymentTerms, setPaymentTerms] = useState(initialSupplier?.paymentTerms || 'Net 30 Days');
  const [creditDays, setCreditDays] = useState(initialSupplier?.commercialDetails?.creditDays?.toString() || '30');
  const [cancellationTerms, setCancellationTerms] = useState(
    initialSupplier?.cancellationTerms || 'Free cancellation up to 7 days prior to service date; 100% fee within 48 hours.'
  );
  const [contractReference, setContractReference] = useState(initialSupplier?.commercialDetails?.contractReference || '');
  const [contractStartDate, setContractStartDate] = useState(initialSupplier?.commercialDetails?.contractStartDate || '');
  const [contractEndDate, setContractEndDate] = useState(initialSupplier?.commercialDetails?.contractEndDate || '');

  // Tab 4: Banking Details
  const [bankName, setBankName] = useState(initialSupplier?.bankDetails?.bankName || '');
  const [accountName, setAccountName] = useState(initialSupplier?.bankDetails?.accountName || '');
  const [accountNumber, setAccountNumber] = useState(initialSupplier?.bankDetails?.accountNumber || '');
  const [swiftBic, setSwiftBic] = useState(initialSupplier?.bankDetails?.swiftBic || '');
  const [iban, setIban] = useState(initialSupplier?.bankDetails?.iban || '');
  const [routingCode, setRoutingCode] = useState(initialSupplier?.bankDetails?.routingCode || '');
  const [branchAddress, setBranchAddress] = useState(initialSupplier?.bankDetails?.branchAddress || '');

  // Tab 5: Coverage & Operations
  const [operatingHours, setOperatingHours] = useState(initialSupplier?.serviceCoverage?.operatingHours || '08:00 - 20:00 (JST)');
  const [operatingDays, setOperatingDays] = useState(initialSupplier?.serviceCoverage?.operatingDays?.join(', ') || 'Mon, Tue, Wed, Thu, Fri, Sat, Sun');
  const [languagesInput, setLanguagesInput] = useState(initialSupplier?.serviceCoverage?.languagesSupported?.join(', ') || 'English, Japanese');
  const [has24x7Support, setHas24x7Support] = useState(initialSupplier?.serviceCoverage?.has24x7Support ?? true);
  const [notes, setNotes] = useState(initialSupplier?.notes || '');

  // Duplicate warning & errors
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Initial code generation for new suppliers
  useEffect(() => {
    if (!isEditing && !supplierCode) {
      setSupplierCode(db.generateSupplierCode());
    }
  }, [isEditing, supplierCode]);

  // Real-time duplicate check
  useEffect(() => {
    if (!name.trim()) {
      setDuplicateWarning(null);
      return;
    }
    const dup = db.checkSupplierDuplicate(
      {
        name: name.trim(),
        email: primaryEmail.trim(),
        taxRegistrationNumber: taxRegistrationNumber.trim()
      },
      initialSupplier?.id
    );

    if (dup.isDuplicate) {
      setDuplicateWarning(dup.reason || 'A supplier with matching credentials already exists in the database.');
    } else {
      setDuplicateWarning(null);
    }
  }, [name, primaryEmail, taxRegistrationNumber, initialSupplier?.id]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleAddContact = () => {
    setAdditionalContacts(prev => [
      ...prev,
      {
        name: '',
        designation: 'Reservations Desk',
        role: 'Reservations',
        email: '',
        phone: '',
        isPrimary: false,
        isEmergency24x7: false
      }
    ]);
  };

  const handleUpdateContact = (idx: number, field: string, value: any) => {
    setAdditionalContacts(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleRemoveContact = (idx: number) => {
    setAdditionalContacts(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Supplier Name is required.');
      setActiveTab('GENERAL');
      return;
    }
    if (selectedCategories.length === 0) {
      setErrorMessage('Select at least one service category.');
      setActiveTab('GENERAL');
      return;
    }
    if (!primaryEmail.trim() || !primaryPhone.trim()) {
      setErrorMessage('Primary contact email and phone are mandatory.');
      setActiveTab('CONTACTS');
      return;
    }

    const hubsArray = hubsInput.split(',').map(h => h.trim()).filter(Boolean);
    const languagesArray = languagesInput.split(',').map(l => l.trim()).filter(Boolean);
    const operatingDaysArray = operatingDays.split(',').map(d => d.trim()).filter(Boolean);

    const allContacts = [
      {
        name: primaryContactPerson.trim() || name.trim(),
        designation: primaryDesignation.trim(),
        role: 'Operations & Management',
        email: primaryEmail.trim(),
        phone: primaryPhone.trim(),
        emergencyPhone: emergencyPhone.trim() || undefined,
        isPrimary: true,
        isEmergency24x7: Boolean(emergencyPhone.trim())
      },
      ...additionalContacts.filter(c => Boolean(c.name.trim()))
    ];

    const supplierPayload: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'> = {
      supplierCode: supplierCode || db.generateSupplierCode(),
      name: name.trim(),
      legalName: legalName.trim() || undefined,
      tradingName: tradingName.trim() || undefined,
      country: country.trim(),
      destination: destination.trim(),
      destinations: [destination.trim()],
      hubs: hubsArray.length > 0 ? hubsArray : [destination.trim()],
      categories: selectedCategories,
      status,
      contactPerson: primaryContactPerson.trim() || name.trim(),
      contactPersons: allContacts,
      email: primaryEmail.trim(),
      phone: primaryPhone.trim(),
      emergencyPhone: emergencyPhone.trim() || undefined,
      website: website.trim() || undefined,
      taxRegistrationNumber: taxRegistrationNumber.trim() || undefined,
      address: address.trim() || undefined,
      currency,
      paymentTerms: paymentTerms.trim(),
      cancellationTerms: cancellationTerms.trim() || undefined,
      serviceCoverage: {
        regionsServed: ['Global'],
        destinationsServed: [destination.trim()],
        hubsServed: hubsArray,
        cityHubsServed: hubsArray,
        supportedCategories: selectedCategories as any,
        serviceCategories: selectedCategories as any,
        serviceAvailability: 'ALL_YEAR',
        languagesSupported: languagesArray,
        operatingHours: operatingHours.trim() || undefined,
        operatingDays: operatingDaysArray,
        has24x7Support
      },
      commercialDetails: {
        defaultCurrency: currency,
        paymentTerms: paymentTerms.trim(),
        standardPaymentTerms: paymentTerms.trim(),
        creditPeriodDays: parseInt(creditDays) || 30,
        creditDays: parseInt(creditDays) || 30,
        cancellationPolicy: cancellationTerms.trim() || undefined,
        cancellationPolicyTerms: cancellationTerms.trim(),
        contractReference: contractReference.trim() || undefined,
        contractStartDate: contractStartDate || undefined,
        contractEndDate: contractEndDate || undefined
      },
      bankDetails: bankName.trim() ? {
        bankName: bankName.trim(),
        accountName: accountName.trim() || name.trim(),
        accountNumber: accountNumber.trim(),
        swiftBic: swiftBic.trim() || undefined,
        iban: iban.trim() || undefined,
        routingCode: routingCode.trim() || undefined,
        branchAddress: branchAddress.trim() || undefined
      } : undefined,
      notes: notes.trim() || undefined
    };

    if (isEditing && initialSupplier) {
      const res = db.saveSupplier({ ...supplierPayload, id: initialSupplier.id } as Supplier, currentUser);
      if (res.success && res.supplier) {
        onSave(res.supplier);
      } else {
        setErrorMessage(res.error || 'Failed to update supplier record.');
      }
    } else {
      const res = db.saveSupplier(supplierPayload as Supplier, currentUser);
      if (res.success && res.supplier) {
        onSave(res.supplier);
      } else {
        setErrorMessage(res.error || 'Failed to create supplier record.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 border border-slate-100 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-teal-50 text-teal-700 rounded-2xl border border-teal-100">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">
                  {isEditing ? `Edit Supplier: ${initialSupplier.name}` : 'Add New Direct Supplier'}
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                  {supplierCode || 'AUTO-ID'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                TheUnbound Central Supplier Master Directory • Internal Only
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Duplicate warning alert */}
        {duplicateWarning && (
          <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5 shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold">Duplicate Warning:</span>
              <p className="text-[11px] leading-relaxed">{duplicateWarning}</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('GENERAL')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'GENERAL'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            General & Classification
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CONTACTS')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'CONTACTS'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            Contacts & 24/7 Desk
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COMMERCIAL')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'COMMERCIAL'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Commercials & Terms
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BANKING')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'BANKING'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Banking & Wire Details
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('COVERAGE')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'COVERAGE'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            Coverage & Operations
          </button>
        </div>

        {/* Tab Form Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto pr-1 flex-1 space-y-4 text-xs">
          {/* TAB 1: GENERAL */}
          {activeTab === 'GENERAL' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Supplier Display / Trade Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Tokyo Chauffeur Services Ltd"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Supplier Code</label>
                  <input
                    type="text"
                    readOnly
                    value={supplierCode}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-teal-800 cursor-not-allowed mt-1"
                  />
                  <span className="text-[9px] text-slate-400">System-assigned immutable code</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Legal Registered Name</label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={e => setLegalName(e.target.value)}
                    placeholder="Official entity name from business license"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Operating Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as SupplierStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none focus:border-teal-500 mt-1"
                  >
                    <option value="ACTIVE">ACTIVE (Available for booking allocation)</option>
                    <option value="UNDER_REVIEW">UNDER REVIEW (Contracting / Pending compliance)</option>
                    <option value="INACTIVE">INACTIVE (Temporarily offboarded)</option>
                    <option value="SUSPENDED">SUSPENDED (Action blocked)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500 mb-1.5 block">
                  Service Categories * (Select all that apply)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_CATEGORIES.map(cat => {
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-teal-50 border-teal-500 text-teal-800 font-bold'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-teal-600" />}
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Primary Destination *</label>
                  <select
                    value={destination}
                    onChange={e => {
                      setDestination(e.target.value);
                      setCountry(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none focus:border-teal-500 mt-1"
                  >
                    {AVAILABLE_DESTINATIONS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">City Hubs Served</label>
                  <input
                    type="text"
                    value={hubsInput}
                    onChange={e => setHubsInput(e.target.value)}
                    placeholder="e.g. Tokyo, Kyoto, Osaka, Hakone"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                  <span className="text-[9px] text-slate-400">Comma-separated city hubs</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Tax / VAT / GST / Registration Number</label>
                  <input
                    type="text"
                    value={taxRegistrationNumber}
                    onChange={e => setTaxRegistrationNumber(e.target.value)}
                    placeholder="e.g. T1234567890123"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Official Website</label>
                  <input
                    type="url"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    placeholder="https://www.supplier.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Office / Physical Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Street, District, City, Postal Code"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                />
              </div>
            </div>
          )}

          {/* TAB 2: CONTACTS */}
          {activeTab === 'CONTACTS' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-teal-50/50 rounded-2xl border border-teal-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-teal-600" />
                    Primary Operational Contact (Mandatory)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                    Default for Vouchers & Allocations
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500">Contact Person Name *</label>
                    <input
                      type="text"
                      required
                      value={primaryContactPerson}
                      onChange={e => setPrimaryContactPerson(e.target.value)}
                      placeholder="e.g. Kenji Takahashi"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500">Role / Designation</label>
                    <input
                      type="text"
                      value={primaryDesignation}
                      onChange={e => setPrimaryDesignation(e.target.value)}
                      placeholder="e.g. General Operations Director"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500">Primary Dispatch Email *</label>
                    <input
                      type="email"
                      required
                      value={primaryEmail}
                      onChange={e => setPrimaryEmail(e.target.value)}
                      placeholder="dispatch@supplier.com"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500">Primary Contact Phone *</label>
                    <input
                      type="text"
                      required
                      value={primaryPhone}
                      onChange={e => setPrimaryPhone(e.target.value)}
                      placeholder="+81 3 5555 0192"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1 text-rose-600">
                    <PhoneCall className="w-3 h-3" />
                    24/7 Duty Emergency Phone (For Live On-Tour Passenger Support)
                  </label>
                  <input
                    type="text"
                    value={emergencyPhone}
                    onChange={e => setEmergencyPhone(e.target.value)}
                    placeholder="+81 80 1234 5678 (24x7 Operations Hotline)"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:border-teal-500 mt-1 text-rose-800"
                  />
                </div>
              </div>

              {/* Additional Contacts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">
                    Additional Department Contacts (Accounts, Contracting, Guides)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddContact}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Department Contact
                  </button>
                </div>

                {additionalContacts.length === 0 && (
                  <p className="text-slate-400 italic text-center py-4 bg-slate-50 rounded-2xl">
                    No additional department contacts added yet.
                  </p>
                )}

                {additionalContacts.map((contact, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 relative">
                    <button
                      type="button"
                      onClick={() => handleRemoveContact(idx)}
                      className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pr-6">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Name</label>
                        <input
                          type="text"
                          value={contact.name}
                          onChange={e => handleUpdateContact(idx, 'name', e.target.value)}
                          placeholder="Contact Name"
                          className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Role / Dept</label>
                        <input
                          type="text"
                          value={contact.role}
                          onChange={e => handleUpdateContact(idx, 'role', e.target.value)}
                          placeholder="e.g. Accounts / Billing"
                          className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Email</label>
                        <input
                          type="email"
                          value={contact.email}
                          onChange={e => handleUpdateContact(idx, 'email', e.target.value)}
                          placeholder="billing@supplier.com"
                          className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Phone</label>
                        <input
                          type="text"
                          value={contact.phone}
                          onChange={e => handleUpdateContact(idx, 'phone', e.target.value)}
                          placeholder="Direct phone"
                          className="w-full px-2 py-1 rounded-lg bg-white border border-slate-200 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: COMMERCIAL & TERMS */}
          {activeTab === 'COMMERCIAL' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Contract Currency *</label>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value as CurrencyCode)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none focus:border-teal-500 mt-1"
                  >
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                    <option value="JPY">JPY (¥) - Japanese Yen</option>
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="AUD">AUD (A$) - Australian Dollar</option>
                    <option value="SGD">SGD (S$) - Singapore Dollar</option>
                    <option value="AED">AED (AED) - UAE Dirham</option>
                    <option value="THB">THB (฿) - Thai Baht</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Standard Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={e => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none focus:border-teal-500 mt-1"
                  >
                    <option value="Net 30 Days">Net 30 Days Credit</option>
                    <option value="Net 15 Days">Net 15 Days Credit</option>
                    <option value="Pre-payment 7 Days Prior">Pre-payment 7 Days Prior to Service</option>
                    <option value="Pre-payment 14 Days Prior">Pre-payment 14 Days Prior to Service</option>
                    <option value="100% On Booking Confirmation">100% On Booking Confirmation</option>
                    <option value="End of Month Statement">End of Month Consolidation Statement</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Credit Window (Days)</label>
                  <input
                    type="number"
                    min="0"
                    value={creditDays}
                    onChange={e => setCreditDays(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">
                  Authoritative Cancellation Policy Terms
                </label>
                <textarea
                  rows={3}
                  value={cancellationTerms}
                  onChange={e => setCancellationTerms(e.target.value)}
                  placeholder="Specify tier structure: e.g. 100% refund up to 7 days prior; 50% between 7-3 days; 100% penalty within 48h or No Show."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Contract Reference Code</label>
                  <input
                    type="text"
                    value={contractReference}
                    onChange={e => setContractReference(e.target.value)}
                    placeholder="e.g. UNB-CONTR-2026-JP-09"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Contract Start Date</label>
                  <input
                    type="date"
                    value={contractStartDate}
                    onChange={e => setContractStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Contract Expiry Date</label>
                  <input
                    type="date"
                    value={contractEndDate}
                    onChange={e => setContractEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BANKING & WIRE DETAILS */}
          {activeTab === 'BANKING' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Financial Security Protection: Bank details are restricted to authorized internal operations 
                  and are never exposed to external B2B agents or buyers.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Beneficiary Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    placeholder="e.g. Bank of Tokyo-Mitsubishi UFJ"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Beneficiary Account Name</label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={e => setAccountName(e.target.value)}
                    placeholder="Official name matching bank account"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Account / IBAN Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value)}
                    placeholder="Bank Account Number or IBAN"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">SWIFT / BIC Code</label>
                  <input
                    type="text"
                    value={swiftBic}
                    onChange={e => setSwiftBic(e.target.value)}
                    placeholder="e.g. BOTKJPJT"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono uppercase focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">IBAN (Europe / Middle East)</label>
                  <input
                    type="text"
                    value={iban}
                    onChange={e => setIban(e.target.value)}
                    placeholder="Optional IBAN"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono uppercase focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Routing / Sort / IFSC Code</label>
                  <input
                    type="text"
                    value={routingCode}
                    onChange={e => setRoutingCode(e.target.value)}
                    placeholder="Domestic clearing code"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Branch Address & Clearing Details</label>
                <input
                  type="text"
                  value={branchAddress}
                  onChange={e => setBranchAddress(e.target.value)}
                  placeholder="Branch location and city"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                />
              </div>
            </div>
          )}

          {/* TAB 5: COVERAGE & OPERATIONS */}
          {activeTab === 'COVERAGE' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Operating Hours</label>
                  <input
                    type="text"
                    value={operatingHours}
                    onChange={e => setOperatingHours(e.target.value)}
                    placeholder="e.g. 08:00 - 20:00 (JST)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Languages Supported</label>
                  <input
                    type="text"
                    value={languagesInput}
                    onChange={e => setLanguagesInput(e.target.value)}
                    placeholder="e.g. English, Japanese, Mandarin"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                  />
                  <span className="text-[9px] text-slate-400">Comma-separated</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <input
                  type="checkbox"
                  id="has24x7Support"
                  checked={has24x7Support}
                  onChange={e => setHas24x7Support(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                />
                <label htmlFor="has24x7Support" className="text-xs text-slate-800 font-bold flex items-center gap-1.5 cursor-pointer">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  Provides 24/7 Live Emergency Passenger Dispatch & Support
                </label>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-500">Internal Operational Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Private internal operations notes: special contract terms, key account history, driver quality, tips handling..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-teal-500 mt-1"
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isEditing ? 'Update Supplier Record' : 'Save & Add to Directory'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
