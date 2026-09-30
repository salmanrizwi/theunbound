import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../../services/db';
import { HomepageConfig, Destination, HomepageFAQItem, CityHub, MasterRegion, HomepageHubConfigItem, HomepageAffiliation } from '../../types';
import { INITIAL_HOMEPAGE_CONFIG, INITIAL_AFFILIATIONS } from '../../data/initialHomepage';
import { useAuth } from '../../context/AuthContext';
import { GlobalCountingEngine } from '../../services/countingEngine';
import { 
  LayoutTemplate, 
  Save, 
  Eye, 
  Star, 
  Image as ImageIcon, 
  Tag, 
  CheckCircle2, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  Sliders, 
  HelpCircle, 
  Plus, 
  Trash2, 
  Edit2, 
  Grid, 
  Layers, 
  Search, 
  Check, 
  Building2, 
  MessageSquare, 
  RotateCcw, 
  Compass, 
  ShieldCheck, 
  Clock, 
  Globe2, 
  ExternalLink, 
  Monitor, 
  Tablet, 
  Smartphone, 
  Video, 
  Award, 
  Zap, 
  Users, 
  CheckSquare,
  AlertCircle,
  X,
  MapPin,
  Mail
} from 'lucide-react';
import { UniversalHero } from '../UniversalHero';
import { BuyerHeroSection } from '../BuyerPortal/BuyerHeroSection';
import { UniversalHeroConfig, HeroTrustItem } from '../../types';
import { NewsletterManager } from './NewsletterManager';

export interface SequenceModuleItem {
  key: string;
  label: string;
  desc: string;
  toggleKey: keyof HomepageConfig;
  active: boolean;
  sequence: number;
}

export const CANONICAL_SECTION_DEFINITIONS: Array<{ key: string; label: string; desc: string; toggleKey: keyof HomepageConfig }> = [
  { key: 'hero', label: 'Hero Section & Terminal Gateway', desc: 'Main visual backdrop, headlines & B2B login terminal', toggleKey: 'showHeroSection' },
  { key: 'brandIntroduction', label: 'Brand Introduction & Architecture', desc: 'Direct DMC ground handling architecture & verified SLAs', toggleKey: 'showBrandIntroduction' },
  { key: 'cityHubs', label: 'Direct Operations Hubs & Regional Gateways', desc: 'Direct regional gateways (Tokyo, Kyoto, London, etc.)', toggleKey: 'showCityHubs' },
  { key: 'destinationFilter', label: 'Destination Expertise Across Global Corridors', desc: 'Editorial global corridors and active ground desks', toggleKey: 'showDestinationFilter' },
  { key: 'partnershipBenefits', label: 'Why Travel Agents Partner With TheUnbound', desc: 'Direct contracts, SLA turnaround, white-label quotes, 24/7 dispatch', toggleKey: 'showPartnershipBenefits' },
  { key: 'affiliations', label: 'Regulatory Affiliations (JATA / MSME / NIDHI)', desc: 'Official government, tourism & association regulatory accreditations', toggleKey: 'showAffiliationsSection' },
  { key: 'onboardingProcess', label: 'Partner Onboarding in 4 Simple Steps', desc: '4-step trade verification & account activation workflow', toggleKey: 'showOnboardingProcess' },
  { key: 'testimonials', label: 'Verified Trade Partner Testimonials', desc: 'Client reviews carousel with 5-star ratings', toggleKey: 'showGoogleReviews' },
  { key: 'homepageFaqs', label: 'Homepage FAQs Accordion', desc: 'Trade buyer & operational SLA Q&A section', toggleKey: 'showHomepageFAQs' },
  { key: 'newsletter', label: 'Newsletter Subscription (Sendy)', desc: 'Public email newsletter invitation synced with Sendy list', toggleKey: 'showNewsletterSection' },
  { key: 'conversionCta', label: 'Final B2B Trade Accreditation CTA', desc: 'Bottom call-to-action to register and contact trade desk', toggleKey: 'showConversionCTA' }
];

export function initSequenceDraft(currentConfig: HomepageConfig): SequenceModuleItem[] {
  const orderKeys = currentConfig.homepageModuleOrder && currentConfig.homepageModuleOrder.length > 0
    ? currentConfig.homepageModuleOrder
    : CANONICAL_SECTION_DEFINITIONS.map(c => c.key);

  const defMap = new Map<string, { label: string; desc: string; toggleKey: keyof HomepageConfig }>();
  CANONICAL_SECTION_DEFINITIONS.forEach(def => defMap.set(def.key, def));

  const items: SequenceModuleItem[] = [];
  const processedKeys = new Set<string>();

  orderKeys.forEach((rawKey) => {
    const cleanKey = rawKey.trim();
    if (!cleanKey || processedKeys.has(cleanKey)) return;
    processedKeys.add(cleanKey);

    const def = defMap.get(cleanKey) || {
      label: cleanKey,
      desc: 'Dynamic Homepage Section',
      toggleKey: 'showHeroSection' as any
    };

    let active = true;
    if (currentConfig.homepageSections && currentConfig.homepageSections[cleanKey]) {
      active = currentConfig.homepageSections[cleanKey].active !== false;
    } else {
      active = (currentConfig as any)[def.toggleKey] !== false;
    }

    items.push({
      key: cleanKey,
      label: def.label,
      desc: def.desc,
      toggleKey: def.toggleKey,
      active,
      sequence: items.length + 1
    });
  });

  // Ensure all canonical sections are included if not present in stored order
  CANONICAL_SECTION_DEFINITIONS.forEach(def => {
    if (!processedKeys.has(def.key)) {
      processedKeys.add(def.key);
      let active = true;
      if (currentConfig.homepageSections && currentConfig.homepageSections[def.key]) {
        active = currentConfig.homepageSections[def.key].active !== false;
      } else {
        active = (currentConfig as any)[def.toggleKey] !== false;
      }

      items.push({
        key: def.key,
        label: def.label,
        desc: def.desc,
        toggleKey: def.toggleKey,
        active,
        sequence: items.length + 1
      });
    }
  });

  return items;
}

interface HomepageManagerProps {
  destinations: Destination[];
}

export const HomepageManager: React.FC<HomepageManagerProps> = ({ destinations }) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();
  const countingEngine = GlobalCountingEngine.getInstance();
  const [config, setConfig] = useState<HomepageConfig>(db.getHomepageConfig());
  const [cityHubs, setCityHubs] = useState<CityHub[]>(() => db.getCityHubs());
  const [regions, setRegions] = useState<MasterRegion[]>(() => db.getMasterRegions());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'LAYOUT' | 'HERO' | 'HUBS' | 'DESTINATIONS' | 'SECTIONS' | 'AFFILIATIONS' | 'NEWSLETTER' | 'FAQS'>('LAYOUT');

  // Sequence & Ordering Draft State
  const [sequenceDraftModules, setSequenceDraftModules] = useState<SequenceModuleItem[]>(() => initSequenceDraft(db.getHomepageConfig()));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState<number>(() => db.getHomepageConfig().version || 1);
  const [concurrencyNotice, setConcurrencyNotice] = useState<string | null>(null);

  // Hubs Management Specific State
  const [hubSearchQuery, setHubSearchQuery] = useState('');
  const [editingHubItem, setEditingHubItem] = useState<HomepageHubConfigItem | null>(null);
  const [isAddHubModalOpen, setIsAddHubModalOpen] = useState(false);
  const [addHubSearch, setAddHubSearch] = useState('');
  const [addHubRegionFilter, setAddHubRegionFilter] = useState('ALL');

  // Hero CMS Specific State
  const [previewDevice, setPreviewDevice] = useState<'DESKTOP' | 'TABLET' | 'MOBILE'>('DESKTOP');
  const [heroConfigSection, setHeroConfigSection] = useState<'COPY' | 'MEDIA' | 'CTA' | 'OPERATIONS'>('COPY');

  // Affiliations Management State (JATA / MSME / NIDHI)
  const [isEditingAffiliation, setIsEditingAffiliation] = useState(false);
  const [affiliationForm, setAffiliationForm] = useState<Partial<HomepageAffiliation>>({
    name: '',
    fullName: '',
    type: 'Regulatory Verification',
    description: '',
    verificationReference: '',
    officialLink: '',
    displayOrder: 1,
    isActive: true
  });

  // FAQ Modal state
  const [isEditingFaq, setIsEditingFaq] = useState(false);
  const [faqForm, setFaqForm] = useState<Partial<HomepageFAQItem>>({
    question: '',
    answer: '',
    category: 'General',
    displayOrder: 1,
    isPublished: true
  });

  // Destination Search for adding to ordering
  const [destSearchQuery, setDestSearchQuery] = useState('');
  const [sellingPointInput, setSellingPointInput] = useState('');

  const HERO_IMAGE_PRESETS = [
    { name: 'Tokyo Operations (Modern)', url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2000&auto=format&fit=crop' },
    { name: 'Global DMC Portfolio (Skyline)', url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=2000&auto=format&fit=crop' },
    { name: 'London & UK Heritage', url: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=2000&auto=format&fit=crop' },
    { name: 'Western Europe & Alps', url: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=2000&auto=format&fit=crop' },
    { name: 'Southeast Asia Hubs', url: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?q=80&w=2000&auto=format&fit=crop' },
    { name: 'Middle East Executive', url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=2000&auto=format&fit=crop' }
  ];

  useEffect(() => {
    return db.subscribe(() => {
      const latest = db.getHomepageConfig();
      setConfig(latest);
      setCityHubs(db.getCityHubs());
      setRegions(db.getMasterRegions());
      if (!hasUnsavedChanges) {
        setSequenceDraftModules(initSequenceDraft(latest));
        setLoadedVersion(latest.version || 1);
      }
    });
  }, [hasUnsavedChanges]);

  // Sequence Reordering & Status Handlers
  const handleMoveModuleUp = (idx: number) => {
    if (idx <= 0) return;
    const updated = [...sequenceDraftModules];
    const temp = updated[idx];
    updated[idx] = updated[idx - 1];
    updated[idx - 1] = temp;
    const reindexed = updated.map((item, i) => ({ ...item, sequence: i + 1 }));
    setSequenceDraftModules(reindexed);
    setHasUnsavedChanges(true);
  };

  const handleMoveModuleDown = (idx: number) => {
    if (idx >= sequenceDraftModules.length - 1) return;
    const updated = [...sequenceDraftModules];
    const temp = updated[idx];
    updated[idx] = updated[idx + 1];
    updated[idx + 1] = temp;
    const reindexed = updated.map((item, i) => ({ ...item, sequence: i + 1 }));
    setSequenceDraftModules(reindexed);
    setHasUnsavedChanges(true);
  };

  const handleToggleModuleActive = (idx: number) => {
    const updated = [...sequenceDraftModules];
    updated[idx] = {
      ...updated[idx],
      active: !updated[idx].active
    };
    setSequenceDraftModules(updated);
    setHasUnsavedChanges(true);
  };

  const handleDiscardSequenceChanges = () => {
    const latest = db.getHomepageConfig();
    setSequenceDraftModules(initSequenceDraft(latest));
    setHasUnsavedChanges(false);
    setConcurrencyNotice(null);
  };

  const handleSaveSequenceChanges = () => {
    const latest = db.getHomepageConfig();
    if (latest.version && loadedVersion && latest.version > loadedVersion) {
      setConcurrencyNotice('Homepage layout was updated by another administrator. Refresh and review the latest changes before saving.');
      return;
    }

    // 1. Normalize sequence values (1..N contiguous)
    const normalized = sequenceDraftModules.map((item, idx) => ({
      ...item,
      sequence: idx + 1
    }));

    // 2. Prepare atomic update payloads
    const orderKeys = normalized.map(m => m.key);
    const sectionsMap: Record<string, { sequence: number; active: boolean; updatedAt: string; updatedBy: string }> = {};
    const toggleUpdates: Partial<HomepageConfig> = {};

    normalized.forEach(m => {
      sectionsMap[m.key] = {
        sequence: m.sequence,
        active: m.active,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || 'admin@theunbound.in'
      };
      (toggleUpdates as any)[m.toggleKey] = m.active;
    });

    const nextVersion = (latest.version || 1) + 1;
    const updatedConfig: HomepageConfig = {
      ...config,
      ...toggleUpdates,
      homepageModuleOrder: orderKeys,
      homepageSections: sectionsMap,
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.email || 'admin@theunbound.in'
    };

    // 3. Atomic persistence & Audit logging
    db.updateHomepageConfig(updatedConfig, user);
    setConfig(updatedConfig);
    setLoadedVersion(nextVersion);
    setSequenceDraftModules(initSequenceDraft(updatedConfig));
    setHasUnsavedChanges(false);
    setConcurrencyNotice(null);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleResetSequenceToDefault = () => {
    if (window.confirm('Reset homepage layout sequence to the canonical recommended layout?')) {
      const canonicalKeys = CANONICAL_SECTION_DEFINITIONS.map(c => c.key);
      const toggleUpdates: Partial<HomepageConfig> = {};
      const sectionsMap: Record<string, { sequence: number; active: boolean; updatedAt: string; updatedBy: string }> = {};

      CANONICAL_SECTION_DEFINITIONS.forEach((def, idx) => {
        sectionsMap[def.key] = {
          sequence: idx + 1,
          active: true,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.email || 'admin@theunbound.in'
        };
        (toggleUpdates as any)[def.toggleKey] = true;
      });

      const latest = db.getHomepageConfig();
      const nextVersion = (latest.version || 1) + 1;
      const updatedConfig: HomepageConfig = {
        ...config,
        ...toggleUpdates,
        homepageModuleOrder: canonicalKeys,
        homepageSections: sectionsMap,
        version: nextVersion,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || 'admin@theunbound.in'
      };

      db.updateHomepageConfig(updatedConfig, user);
      setConfig(updatedConfig);
      setLoadedVersion(nextVersion);
      setSequenceDraftModules(initSequenceDraft(updatedConfig));
      setHasUnsavedChanges(false);
      setConcurrencyNotice(null);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    db.updateHomepageConfig(config, user);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const moveDestination = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...config.destinationOrdering];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    const updated = { ...config, destinationOrdering: newOrder };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  const toggleFeaturedDestination = (destId: string) => {
    const isCurrentlyFeatured = (config.featuredDestinationIds || []).includes(destId);
    let updatedFeatured: string[];
    if (isCurrentlyFeatured) {
      updatedFeatured = (config.featuredDestinationIds || []).filter(id => id !== destId);
    } else {
      updatedFeatured = [...(config.featuredDestinationIds || []), destId];
    }
    const updated = { ...config, featuredDestinationIds: updatedFeatured };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  const toggleDestinationInOrdering = (destId: string) => {
    let updatedOrdering = [...(config.destinationOrdering || [])];
    if (updatedOrdering.includes(destId)) {
      if (updatedOrdering.length <= 1) return; // Keep at least one
      updatedOrdering = updatedOrdering.filter(id => id !== destId);
    } else {
      updatedOrdering.push(destId);
    }
    const updated = { ...config, destinationOrdering: updatedOrdering };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  // --- Hub Management Helpers ---
  const moveHub = (index: number, direction: 'up' | 'down') => {
    const currentList = [...(config.homepageHubs || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;
    const temp = currentList[index];
    currentList[index] = currentList[targetIndex];
    currentList[targetIndex] = temp;
    const updatedList = currentList.map((item, idx) => ({ ...item, displayOrder: idx + 1 }));
    const updated = { ...config, homepageHubs: updatedList };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  const toggleHubVisibility = (hubId: string) => {
    const currentList = [...(config.homepageHubs || [])];
    const updatedList = currentList.map(item => 
      item.hubId === hubId ? { ...item, enabled: !item.enabled } : item
    );
    const updated = { ...config, homepageHubs: updatedList };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  const toggleHubFeatured = (hubId: string) => {
    const currentList = [...(config.homepageHubs || [])];
    const updatedList = currentList.map(item => 
      item.hubId === hubId ? { ...item, featured: !item.featured } : item
    );
    const updated = { ...config, homepageHubs: updatedList };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  const addHubToHomepage = (hubId: string) => {
    const hub = cityHubs.find(h => h.id === hubId);
    if (!hub) return;
    const currentList = [...(config.homepageHubs || [])];
    if (currentList.some(item => item.hubId === hubId)) return;
    const newItem: HomepageHubConfigItem = {
      hubId,
      enabled: true,
      featured: false,
      displayOrder: currentList.length + 1,
      badge: 'Direct Ground Desk',
      ctaLabel: 'Explore Ground Hub Services'
    };
    const updatedList = [...currentList, newItem];
    const updated = { ...config, homepageHubs: updatedList };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
    setIsAddHubModalOpen(false);
  };

  const removeHubFromHomepage = (hubId: string) => {
    const currentList = (config.homepageHubs || []).filter(item => item.hubId !== hubId);
    const updatedList = currentList.map((item, idx) => ({ ...item, displayOrder: idx + 1 }));
    const updated = { ...config, homepageHubs: updatedList };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  const handleSaveHubOverrides = (item: HomepageHubConfigItem) => {
    const currentList = [...(config.homepageHubs || [])];
    const idx = currentList.findIndex(h => h.hubId === item.hubId);
    if (idx >= 0) {
      currentList[idx] = { ...item };
    }
    const updated = { ...config, homepageHubs: currentList };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
    setEditingHubItem(null);
  };

  // FAQ CRUD
  const handleSaveFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqForm.question || !faqForm.answer) return;

    const existingFaqs = config.homepageFAQs ? [...config.homepageFAQs] : [];
    if (faqForm.id) {
      const idx = existingFaqs.findIndex(f => f.id === faqForm.id);
      if (idx >= 0) {
        existingFaqs[idx] = {
          id: faqForm.id,
          question: faqForm.question,
          answer: faqForm.answer,
          category: faqForm.category || 'General',
          displayOrder: faqForm.displayOrder || (idx + 1),
          isPublished: faqForm.isPublished !== false
        };
      }
    } else {
      existingFaqs.push({
        id: `hfaq-${Date.now()}`,
        question: faqForm.question,
        answer: faqForm.answer,
        category: faqForm.category || 'General',
        displayOrder: existingFaqs.length + 1,
        isPublished: faqForm.isPublished !== false
      });
    }

    const updated = { ...config, homepageFAQs: existingFaqs };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
    setIsEditingFaq(false);
    setFaqForm({ question: '', answer: '', category: 'General', displayOrder: 1, isPublished: true });
  };

  const handleDeleteFaq = (faqId: string) => {
    const filtered = (config.homepageFAQs || []).filter(f => f.id !== faqId);
    const updated = { ...config, homepageFAQs: filtered };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  const handleToggleFaqPublished = (faqId: string) => {
    const faqs = (config.homepageFAQs || []).map(f => f.id === faqId ? { ...f, isPublished: !f.isPublished } : f);
    const updated = { ...config, homepageFAQs: faqs };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  // Affiliations Handlers (JATA / MSME / NIDHI)
  const handleSaveAffiliation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!affiliationForm.name || !affiliationForm.fullName) return;

    const existingAffiliations = config.affiliations && config.affiliations.length > 0 
      ? [...config.affiliations] 
      : [...INITIAL_AFFILIATIONS];

    if (affiliationForm.id) {
      const idx = existingAffiliations.findIndex(a => a.id === affiliationForm.id);
      if (idx >= 0) {
        existingAffiliations[idx] = {
          ...existingAffiliations[idx],
          ...affiliationForm
        } as HomepageAffiliation;
      }
    } else {
      existingAffiliations.push({
        id: `aff-${Date.now()}`,
        name: affiliationForm.name,
        fullName: affiliationForm.fullName,
        type: affiliationForm.type || 'Regulatory Verification',
        description: affiliationForm.description || '',
        verificationReference: affiliationForm.verificationReference || '',
        officialLink: affiliationForm.officialLink || '',
        displayOrder: existingAffiliations.length + 1,
        isActive: affiliationForm.isActive !== false
      });
    }

    const updated = { ...config, affiliations: existingAffiliations };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
    setIsEditingAffiliation(false);
    setAffiliationForm({
      name: '',
      fullName: '',
      type: 'Regulatory Verification',
      description: '',
      verificationReference: '',
      officialLink: '',
      displayOrder: 1,
      isActive: true
    });
  };

  const handleDeleteAffiliation = (id: string) => {
    const filtered = (config.affiliations || INITIAL_AFFILIATIONS).filter(a => a.id !== id);
    const updated = { ...config, affiliations: filtered };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  const handleToggleAffiliation = (id: string) => {
    const affiliations = (config.affiliations || INITIAL_AFFILIATIONS).map(a => a.id === id ? { ...a, isActive: !a.isActive } : a);
    const updated = { ...config, affiliations };
    setConfig(updated);
    db.updateHomepageConfig(updated, user);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider mb-1">
            <LayoutTemplate className="w-4 h-4 text-[#00C6A6]" />
            <span>Storefront Presentation & Layout Engine</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Homepage Control & Layout Manager</h2>
          <p className="text-sm text-slate-500">
            Control module visibility, grid density, hero presentation, destination hub hierarchies, and dedicated homepage trade FAQs.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {savedSuccess && (
            <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-[#008972]" />
              <span>Published live to Homepage!</span>
            </div>
          )}
          <button
            onClick={() => handleSave()}
            className="inline-flex items-center space-x-2 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold px-6 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer text-xs"
          >
            <Save className="w-4 h-4" />
            <span>Publish All Changes</span>
          </button>
        </div>
      </div>

      {/* Sub Tab Navigation */}
      <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 max-w-fit overflow-x-auto">
        {[
          { id: 'LAYOUT', label: 'Modules & Grid Layout', icon: Grid },
          { id: 'HERO', label: 'Hero Banner & CTA', icon: Sliders },
          { id: 'HUBS', label: 'Homepage Hubs & Gateways', icon: Building2 },
          { id: 'DESTINATIONS', label: 'Destinations & Ordering', icon: LayoutTemplate },
          { id: 'SECTIONS', label: 'Homepage Content Sections', icon: Layers },
          { id: 'AFFILIATIONS', label: 'Regulatory Affiliations (JATA / MSME / NIDHI)', icon: ShieldCheck },
          { id: 'NEWSLETTER', label: 'Newsletter (Sendy)', icon: Mail },
          { id: 'FAQS', label: 'Homepage FAQs Manager', icon: HelpCircle }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-white text-slate-950 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#008972]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUB TAB 1: SECTION SEQUENCE & ORDERING */}
      {activeSubTab === 'LAYOUT' && (
        <div className="space-y-6">
          {/* Section: Dynamic Section Sequence & Reordering */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#008972] border border-teal-200 flex items-center justify-center font-bold">
                  <Sliders className="w-5 h-5 text-[#008972]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Homepage Section Sequence & Ordering</h3>
                  <p className="text-xs text-slate-500">Control which Homepage sections appear and their vertical display sequence.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetSequenceToDefault}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset to Recommended Sequence</span>
              </button>
            </div>

            {/* Unsaved Changes Notification Banner */}
            {hasUnsavedChanges && (
              <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn shadow-2xs">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold shrink-0">
                    <AlertCircle className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-amber-950">Unsaved Sequence Changes</div>
                    <div className="text-[11px] text-amber-800">You have modified section placement or visibility state. Click &quot;Save Sequence Changes&quot; to publish atomically to Firestore.</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleDiscardSequenceChanges}
                    className="px-3.5 py-2 rounded-xl border border-amber-300 bg-white hover:bg-amber-100 text-xs font-bold text-amber-900 transition-colors cursor-pointer"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSequenceChanges}
                    className="px-4 py-2 rounded-xl bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center space-x-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Sequence Changes</span>
                  </button>
                </div>
              </div>
            )}

            {/* Concurrency Error Banner */}
            {concurrencyNotice && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span className="text-xs font-bold text-rose-900">{concurrencyNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={handleDiscardSequenceChanges}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 cursor-pointer"
                >
                  Refresh Latest Layout
                </button>
              </div>
            )}

            {/* Section Sequence List */}
            <div className="space-y-3">
              {sequenceDraftModules.map((item, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === sequenceDraftModules.length - 1;

                return (
                  <div
                    key={item.key}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border transition-all ${
                      item.active
                        ? 'bg-white border-slate-200 shadow-2xs'
                        : 'bg-slate-50/70 border-slate-200 opacity-75'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 mb-3 sm:mb-0">
                      {/* Monospaced 2-digit sequence number badge */}
                      <span className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-mono font-bold flex items-center justify-center shrink-0 shadow-2xs">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-900">{item.label}</span>
                          
                          {/* Active / Inactive Status Badge */}
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center space-x-1 ${
                            item.active
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-200 text-slate-700 border border-slate-300'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            <span>{item.active ? 'ACTIVE' : 'INACTIVE'}</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">{item.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end space-x-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {/* Activate / Deactivate Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleModuleActive(idx)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          item.active
                            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        {item.active ? 'Deactivate' : 'Activate'}
                      </button>

                      {/* Sequence Arrows ↑ ↓ */}
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handleMoveModuleUp(idx)}
                          className={`p-1.5 rounded-lg border text-xs transition-colors ${
                            isFirst
                              ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                              : 'border-slate-200 text-slate-700 hover:bg-white cursor-pointer shadow-2xs active:scale-95'
                          }`}
                          title={isFirst ? 'First position (Cannot move up)' : 'Move section up'}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handleMoveModuleDown(idx)}
                          className={`p-1.5 rounded-lg border text-xs transition-colors ${
                            isLast
                              ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                              : 'border-slate-200 text-slate-700 hover:bg-white cursor-pointer shadow-2xs active:scale-95'
                          }`}
                          title={isLast ? 'Last position (Cannot move down)' : 'Move section down'}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Responsive Grid Density Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <Grid className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Live Homepage Grid Density Controls</h3>
                <p className="text-xs text-slate-500">Configure responsive column counts for active homepage card layouts.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Destination Expertise Grid Columns
                </label>
                <select
                  value={config.destinationGridColumns || 3}
                  onChange={e => {
                    const updated = { ...config, destinationGridColumns: Number(e.target.value) as any };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50"
                >
                  <option value={2}>2 Columns (Spacious Cards)</option>
                  <option value={3}>3 Columns (Standard DMC - Recommended)</option>
                  <option value={4}>4 Columns (Compact Hubs)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">Controls the layout of the Global Desks & Destinations section.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  City Hubs & Gateways Grid Columns
                </label>
                <select
                  value={config.hubGridColumns || 3}
                  onChange={e => {
                    const updated = { ...config, hubGridColumns: Number(e.target.value) as any };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50"
                >
                  <option value={2}>2 Columns</option>
                  <option value={3}>3 Columns (Standard)</option>
                  <option value={4}>4 Columns (High Density)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">Controls the card arrangement in the Direct Operations Hubs section.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: HERO BANNER & CTA */}
      {activeSubTab === 'HERO' && (() => {
        const heroCfg: UniversalHeroConfig = config.heroConfig || INITIAL_HOMEPAGE_CONFIG.heroConfig || {};

        const updateHero = (updates: Partial<UniversalHeroConfig>) => {
          const current = config.heroConfig || INITIAL_HOMEPAGE_CONFIG.heroConfig || {};
          const nextHero: UniversalHeroConfig = {
            ...current,
            ...updates,
            media: {
              ...(current.media || {}),
              ...(updates.media || {})
            },
            ctas: {
              ...(current.ctas || {}),
              ...(updates.ctas || {})
            },
            discoveryPanelConfig: {
              ...(current.discoveryPanelConfig || {}),
              ...(updates.discoveryPanelConfig || {})
            },
            promotion: {
              ...(current.promotion || {}),
              ...(updates.promotion || {})
            }
          };

          const nextConfig: HomepageConfig = {
            ...config,
            heroConfig: nextHero,
            heroHeading: nextHero.heading ?? config.heroHeading,
            heroSubheading: nextHero.subheading ?? config.heroSubheading,
            heroBadgeText: nextHero.eyebrowText ?? config.heroBadgeText,
            heroImage: nextHero.media?.desktopImageUrl ?? config.heroImage,
            heroMobileImage: nextHero.media?.mobileImageUrl ?? config.heroMobileImage,
            heroImageAlt: nextHero.media?.altText ?? config.heroImageAlt,
            heroOverlayOpacity: nextHero.media?.overlayOpacity ?? config.heroOverlayOpacity,
            heroVideoUrl: nextHero.media?.videoUrl ?? config.heroVideoUrl,
            primaryCtaText: nextHero.ctas?.primaryCtaText ?? config.primaryCtaText,
            secondaryCtaText: nextHero.ctas?.secondaryCtaText ?? config.secondaryCtaText,
            showPrimaryCta: nextHero.ctas?.showPrimaryCta ?? config.showPrimaryCta,
            showSecondaryCta: nextHero.ctas?.showSecondaryCta ?? config.showSecondaryCta
          };

          setConfig(nextConfig);
        };

        return (
          <div className="space-y-6">
            {/* Header Action Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#008972] border border-teal-200 flex items-center justify-center font-bold shrink-0">
                  <Sliders className="w-5 h-5 text-[#00C6A6]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">B2B Destination Management Hero CMS</h3>
                  <p className="text-xs text-slate-500">Universal Hero architecture powering Homepage, Destination pages, and Campaigns.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Device Switcher */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('DESKTOP')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      previewDevice === 'DESKTOP' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('TABLET')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      previewDevice === 'TABLET' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Tablet className="w-3.5 h-3.5" />
                    <span>Tablet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('MOBILE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      previewDevice === 'MOBILE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset Hero settings to standard TheUnbound B2B DMC defaults?')) {
                      const restored: HomepageConfig = {
                        ...config,
                        heroConfig: INITIAL_HOMEPAGE_CONFIG.heroConfig,
                        heroBadgeText: INITIAL_HOMEPAGE_CONFIG.heroBadgeText,
                        heroHeading: INITIAL_HOMEPAGE_CONFIG.heroHeading,
                        heroSubheading: INITIAL_HOMEPAGE_CONFIG.heroSubheading,
                        heroImage: INITIAL_HOMEPAGE_CONFIG.heroImage,
                        heroImageAlt: INITIAL_HOMEPAGE_CONFIG.heroImageAlt,
                        heroOverlayOpacity: INITIAL_HOMEPAGE_CONFIG.heroOverlayOpacity,
                        showPrimaryCta: INITIAL_HOMEPAGE_CONFIG.showPrimaryCta,
                        primaryCtaText: INITIAL_HOMEPAGE_CONFIG.primaryCtaText,
                        showSecondaryCta: INITIAL_HOMEPAGE_CONFIG.showSecondaryCta,
                        secondaryCtaText: INITIAL_HOMEPAGE_CONFIG.secondaryCtaText,
                        heroTrustBadges: INITIAL_HOMEPAGE_CONFIG.heroTrustBadges,
                        heroSellingPoints: INITIAL_HOMEPAGE_CONFIG.heroSellingPoints
                      };
                      setConfig(restored);
                      db.updateHomepageConfig(restored, user);
                      setSavedSuccess(true);
                      setTimeout(() => setSavedSuccess(false), 3000);
                    }
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSave()}
                  className="inline-flex items-center space-x-1.5 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save CMS</span>
                </button>
              </div>
            </div>

            {/* Interactive Live Preview Box with Viewport Resizing */}
            <div className="bg-slate-950 rounded-3xl p-3 sm:p-5 text-white overflow-hidden shadow-xl border border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3 px-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
                  <Eye className="w-4 h-4 text-[#00C6A6]" />
                  <span className="uppercase tracking-wider">Live Universal Hero Preview ({previewDevice})</span>
                </div>
                <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono">
                  <span>Overlay: {Math.round((heroCfg.media?.overlayOpacity ?? config.heroOverlayOpacity ?? 0.65) * 100)}%</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00C6A6]" />
                  <span className="text-[#00C6A6]">WYSIWYG Mode</span>
                </div>
              </div>

              {/* Viewport Frame */}
              <div className="w-full overflow-x-auto flex justify-center py-2 bg-slate-900/60 rounded-2xl border border-white/5">
                <div 
                  className={`w-full transition-all duration-300 overflow-hidden ${
                    previewDevice === 'DESKTOP' 
                      ? 'max-w-full' 
                      : previewDevice === 'TABLET' 
                        ? 'max-w-[768px] border-4 border-slate-800 rounded-2xl shadow-2xl' 
                        : 'max-w-[390px] border-4 border-slate-800 rounded-3xl shadow-2xl'
                  }`}
                >
                  <BuyerHeroSection
                    allDestinations={destinations}
                    onSelectDestination={() => {}}
                    onOpenRegister={() => {}}
                    homepageConfig={config}
                  />
                </div>
              </div>
            </div>

            {/* Sub-Section Navigation Tabs */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 border-b border-slate-200">
              {[
                { key: 'COPY', label: '1. Headlines & Copy', icon: Sliders },
                { key: 'MEDIA', label: '2. Media & Contrast', icon: ImageIcon },
                { key: 'CTA', label: '3. Action Buttons', icon: ExternalLink },
                { key: 'OPERATIONS', label: '4. B2B Operations Terminal', icon: Building2 }
              ].map(tab => {
                const Icon = tab.icon;
                const active = heroConfigSection === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setHeroConfigSection(tab.key as any)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center space-x-2 cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#00C6A6]' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sub-Section 1: COPY */}
            {heroConfigSection === 'COPY' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">Headlines, Eyebrow & Brand Positioning</h4>
                  <p className="text-xs text-slate-500">Control the central H1 display title, orange highlight emphasis, and descriptive lead paragraph.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Eyebrow Pill Tag
                    </label>
                    <input
                      type="text"
                      value={heroCfg.eyebrowText ?? config.heroBadgeText ?? ''}
                      onChange={e => updateHero({ eyebrowText: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00C6A6] text-xs font-bold font-mono"
                      placeholder="e.g. ESTABLISHED IN 2025 • B2B DESTINATION MANAGEMENT COMPANY"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Main Display Heading (H1)
                      </label>
                      <input
                        type="text"
                        value={heroCfg.heading ?? config.heroHeading ?? ''}
                        onChange={e => updateHero({ heading: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00C6A6] text-sm font-black"
                        placeholder="e.g. DESTINATION MANAGEMENT"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Heading Accent Highlight (Brand Teal Emphasis)
                      </label>
                      <input
                        type="text"
                        value={heroCfg.headingHighlight ?? 'SIMPLIFIED BY INTELLIGENCE.'}
                        onChange={e => updateHero({ headingHighlight: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00C6A6] text-sm font-black text-[#008972]"
                        placeholder="e.g. SIMPLIFIED BY INTELLIGENCE."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Lead Paragraph / Operational Value Proposition
                    </label>
                    <textarea
                      rows={3}
                      value={heroCfg.subheading ?? config.heroSubheading ?? ''}
                      onChange={e => updateHero({ subheading: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#00C6A6] text-xs leading-relaxed"
                      placeholder="TheUnbound combines destination expertise, travel technology and AI-powered package creation..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Section 2: MEDIA */}
            {heroConfigSection === 'MEDIA' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">Visual Assets, Video & Scrim Contrast</h4>
                  <p className="text-xs text-slate-500">Configure responsive imagery (Desktop, Tablet, Mobile), video backgrounds, and contrast overlays.</p>
                </div>

                <div className="space-y-4">
                  {/* Presets Gallery */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Quick High-Res Destination Presets:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {HERO_IMAGE_PRESETS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => updateHero({ media: { desktopImageUrl: preset.url } })}
                          className="text-left p-1.5 rounded-xl border border-slate-200 hover:border-[#00C6A6] bg-slate-50 text-[11px] transition-all cursor-pointer group"
                        >
                          <img src={preset.url} alt={preset.name} className="w-full h-14 rounded-lg object-cover mb-1 group-hover:scale-102 transition-transform" />
                          <span className="truncate block font-semibold text-slate-800">{preset.name.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Desktop Image URL
                      </label>
                      <input
                        type="url"
                        value={heroCfg.media?.desktopImageUrl ?? config.heroImage ?? ''}
                        onChange={e => updateHero({ media: { desktopImageUrl: e.target.value } })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        placeholder="https://images.unsplash.com/..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Tablet Image URL (Optional)
                      </label>
                      <input
                        type="url"
                        value={heroCfg.media?.tabletImageUrl ?? ''}
                        onChange={e => updateHero({ media: { tabletImageUrl: e.target.value } })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        placeholder="Falls back to Desktop image if empty"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Mobile Image URL (Optional)
                      </label>
                      <input
                        type="url"
                        value={heroCfg.media?.mobileImageUrl ?? ''}
                        onChange={e => updateHero({ media: { mobileImageUrl: e.target.value } })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        placeholder="Falls back to Tablet image if empty"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Video URL (MP4 / WebM - Optional)
                      </label>
                      <input
                        type="url"
                        value={heroCfg.media?.videoUrl ?? ''}
                        onChange={e => updateHero({ media: { videoUrl: e.target.value } })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        placeholder="https://cdn.example.com/hero-video.mp4"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Video Poster Fallback Image URL
                      </label>
                      <input
                        type="url"
                        value={heroCfg.media?.posterImageUrl ?? ''}
                        onChange={e => updateHero({ media: { posterImageUrl: e.target.value } })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                        placeholder="https://images.unsplash.com/..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Image Alt Text (SEO & Accessibility)
                      </label>
                      <input
                        type="text"
                        value={heroCfg.media?.altText ?? config.heroImageAlt ?? ''}
                        onChange={e => updateHero({ media: { altText: e.target.value } })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                        placeholder="TheUnbound B2B Destination Operations Hub"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Dark Overlay Scrim: {Math.round((heroCfg.media?.overlayOpacity ?? config.heroOverlayOpacity ?? 0.65) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="0.95"
                        step="0.05"
                        value={heroCfg.media?.overlayOpacity ?? config.heroOverlayOpacity ?? 0.65}
                        onChange={e => updateHero({ media: { overlayOpacity: parseFloat(e.target.value) } })}
                        className="w-full accent-[#00C6A6] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Section 3: CTA */}
            {heroConfigSection === 'CTA' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">Action CTA Buttons & Destinations Routing</h4>
                  <p className="text-xs text-slate-500">Configure button visibility, labels, and target destinations for the Hero buttons.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Primary CTA */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Primary Button</label>
                      <label className="flex items-center space-x-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={heroCfg.ctas?.showPrimaryCta !== false}
                          onChange={e => {
                            const curr = heroCfg.ctas || {};
                            updateHero({ ctas: { ...curr, showPrimaryCta: e.target.checked } });
                          }}
                          className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                        />
                        <span>Show</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Button Label</label>
                      <input
                        type="text"
                        value={heroCfg.ctas?.primaryCtaText || 'EXPLORE PACKAGES'}
                        onChange={e => {
                          const curr = heroCfg.ctas || {};
                          updateHero({ ctas: { ...curr, primaryCtaText: e.target.value } });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold bg-white"
                      />
                    </div>
                  </div>

                  {/* Secondary CTA */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Secondary Button</label>
                      <label className="flex items-center space-x-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={heroCfg.ctas?.showSecondaryCta !== false}
                          onChange={e => {
                            const curr = heroCfg.ctas || {};
                            updateHero({ ctas: { ...curr, showSecondaryCta: e.target.checked } });
                          }}
                          className="rounded text-[#00C6A6] focus:ring-[#00C6A6]"
                        />
                        <span>Show</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Button Label</label>
                      <input
                        type="text"
                        value={heroCfg.ctas?.secondaryCtaText || 'BECOME A PARTNER'}
                        onChange={e => {
                          const curr = heroCfg.ctas || {};
                          updateHero({ ctas: { ...curr, secondaryCtaText: e.target.value } });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Section 4: OPERATIONS PANEL */}
            {heroConfigSection === 'OPERATIONS' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900">B2B Operations Terminal & Stats Panel</h4>
                  <p className="text-xs text-slate-500">Configure the right-hand operational card, quick terminal login, live ground dispatch highlights, and metrics.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Visual Panel Badge
                    </label>
                    <input
                      type="text"
                      value={config.heroVisualPanelBadge ?? 'DIRECT OPERATIONS CENTER'}
                      onChange={e => {
                        const updated = { ...config, heroVisualPanelBadge: e.target.value };
                        setConfig(updated);
                        db.updateHomepageConfig(updated, user);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                      placeholder="DIRECT OPERATIONS CENTER"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Visual Panel Title
                    </label>
                    <input
                      type="text"
                      value={config.heroVisualPanelTitle ?? 'Trade Terminal • Ground Operations'}
                      onChange={e => {
                        const updated = { ...config, heroVisualPanelTitle: e.target.value };
                        setConfig(updated);
                        db.updateHomepageConfig(updated, user);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                      placeholder="Trade Terminal • Ground Operations"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Visual Panel Description
                  </label>
                  <input
                    type="text"
                    value={config.heroVisualPanelDescription ?? 'Licensed Ground Fulfillment & Live B2B Wholesale Desks'}
                    onChange={e => {
                      const updated = { ...config, heroVisualPanelDescription: e.target.value };
                      setConfig(updated);
                      db.updateHomepageConfig(updated, user);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    placeholder="Licensed Ground Fulfillment & Live B2B Wholesale Desks"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Visual Panel Image URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={config.heroVisualImageUrl ?? 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=1200&auto=format&fit=crop'}
                      onChange={e => {
                        const updated = { ...config, heroVisualImageUrl: e.target.value };
                        setConfig(updated);
                        db.updateHomepageConfig(updated, user);
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
                      placeholder="https://images.unsplash.com/..."
                    />
                    {config.heroVisualImageUrl && (
                      <img
                        src={config.heroVisualImageUrl}
                        alt="Preview"
                        className="w-12 h-9 rounded-lg object-cover border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                </div>

                {/* Operational Highlights */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Ground Operational Highlights (Bullet Points)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const current = [...(config.heroOperationalHighlights || [
                          '24–48h Custom FIT Itinerary Turnaround',
                          'Direct Wholesale Ground Contracts (Zero Broker Layers)',
                          'Private Chauffeur & VIP Coach Fleets',
                          'Licensed Bilingual Destination Experts'
                        ])];
                        current.push('New Operational Capability');
                        const updated = { ...config, heroOperationalHighlights: current };
                        setConfig(updated);
                        db.updateHomepageConfig(updated, user);
                      }}
                      className="inline-flex items-center space-x-1 text-xs font-bold text-[#008972] hover:text-[#00C6A6] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Highlight</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(config.heroOperationalHighlights || [
                      '24–48h Custom FIT Itinerary Turnaround',
                      'Direct Wholesale Ground Contracts (Zero Broker Layers)',
                      'Private Chauffeur & VIP Coach Fleets',
                      'Licensed Bilingual Destination Experts'
                    ]).map((highlight, hIdx) => (
                      <div key={hIdx} className="flex items-center space-x-2">
                        <Check className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
                        <input
                          type="text"
                          value={highlight}
                          onChange={e => {
                            const updatedList = [...(config.heroOperationalHighlights || [])];
                            updatedList[hIdx] = e.target.value;
                            const updated = { ...config, heroOperationalHighlights: updatedList };
                            setConfig(updated);
                            db.updateHomepageConfig(updated, user);
                          }}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updatedList = (config.heroOperationalHighlights || []).filter((_, idx) => idx !== hIdx);
                            const updated = { ...config, heroOperationalHighlights: updatedList };
                            setConfig(updated);
                            db.updateHomepageConfig(updated, user);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Hero Key Stats / Metrics
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(config.heroQuickStats || [
                      { label: 'Turnaround', value: '48h', sublabel: 'SLA' },
                      { label: 'Trade Access', value: '100%', sublabel: 'B2B Only' },
                      { label: 'Ground Duty', value: '24/7', sublabel: 'Dispatch' }
                    ]).map((stat, sIdx) => (
                      <div key={sIdx} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Value</label>
                          <input
                            type="text"
                            value={stat.value}
                            onChange={e => {
                              const updatedStats = [...(config.heroQuickStats || [])];
                              updatedStats[sIdx] = { ...updatedStats[sIdx], value: e.target.value };
                              const updated = { ...config, heroQuickStats: updatedStats };
                              setConfig(updated);
                              db.updateHomepageConfig(updated, user);
                            }}
                            className="w-full px-2 py-1 rounded bg-white border border-slate-200 text-xs font-black text-[#008972]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Label</label>
                          <input
                            type="text"
                            value={stat.label}
                            onChange={e => {
                              const updatedStats = [...(config.heroQuickStats || [])];
                              updatedStats[sIdx] = { ...updatedStats[sIdx], label: e.target.value };
                              const updated = { ...config, heroQuickStats: updatedStats };
                              setConfig(updated);
                              db.updateHomepageConfig(updated, user);
                            }}
                            className="w-full px-2 py-1 rounded bg-white border border-slate-200 text-xs font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Sublabel</label>
                          <input
                            type="text"
                            value={stat.sublabel || ''}
                            onChange={e => {
                              const updatedStats = [...(config.heroQuickStats || [])];
                              updatedStats[sIdx] = { ...updatedStats[sIdx], sublabel: e.target.value };
                              const updated = { ...config, heroQuickStats: updatedStats };
                              setConfig(updated);
                              db.updateHomepageConfig(updated, user);
                            }}
                            className="w-full px-2 py-1 rounded bg-white border border-slate-200 text-[11px] text-slate-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleSave()}
                className="inline-flex items-center space-x-2 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold px-8 py-3 rounded-xl shadow-xs transition-all cursor-pointer text-xs"
              >
                <Save className="w-4 h-4" />
                <span>Publish Hero Changes Live</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* SUB TAB: HOMEPAGE HUBS & GATEWAYS */}
      {activeSubTab === 'HUBS' && (
        <div className="space-y-6">
          {/* Hubs Control Header & Layout Settings */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#008972] flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-slate-900">Homepage City Hubs & Regional Gateways</h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Real Firestore Sync
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Curate, reorder, and configure direct ground hubs displayed on the live homepage. Connected to authoritative Firestore <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">city_hubs</code> and live B2B inventory counts.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddHubModalOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Hub to Homepage</span>
                </button>
              </div>
            </div>

            {/* Section Visibility & Display Settings */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Homepage Hubs Section Display</h4>
                  <p className="text-[11px] text-slate-500">Toggle whether the City Hubs & Regional Gateways block appears on the live homepage.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showCityHubs !== false}
                    onChange={e => {
                      const updated = { ...config, showCityHubs: e.target.checked };
                      setConfig(updated);
                      db.updateHomepageConfig(updated, user);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#008972]"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Section Eyebrow / Badge
                  </label>
                  <input
                    type="text"
                    value={config.hubSectionBadge ?? 'DIRECT GROUND DESKS & GATEWAYS'}
                    onChange={e => {
                      const updated = { ...config, hubSectionBadge: e.target.value };
                      setConfig(updated);
                      db.updateHomepageConfig(updated, user);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white"
                    placeholder="DIRECT GROUND DESKS & GATEWAYS"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Section Title
                  </label>
                  <input
                    type="text"
                    value={config.hubSectionTitle ?? 'Direct Operations Hubs & Regional Gateways'}
                    onChange={e => {
                      const updated = { ...config, hubSectionTitle: e.target.value };
                      setConfig(updated);
                      db.updateHomepageConfig(updated, user);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white font-bold"
                    placeholder="Direct Operations Hubs & Regional Gateways"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Grid Columns
                  </label>
                  <select
                    value={config.hubGridColumns || 3}
                    onChange={e => {
                      const updated = { ...config, hubGridColumns: parseInt(e.target.value, 10) as 2 | 3 | 4 };
                      setConfig(updated);
                      db.updateHomepageConfig(updated, user);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white font-bold"
                  >
                    <option value={2}>2 Columns (Spacious Cards)</option>
                    <option value={3}>3 Columns (Standard Grid)</option>
                    <option value={4}>4 Columns (Dense B2B Directory)</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Section Subtitle / Description
                  </label>
                  <input
                    type="text"
                    value={config.hubSectionSubtitle ?? 'Direct ground dispatch teams, owned vehicle fleets, and immediate wholesale allotments across top destinations.'}
                    onChange={e => {
                      const updated = { ...config, hubSectionSubtitle: e.target.value };
                      setConfig(updated);
                      db.updateHomepageConfig(updated, user);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white"
                    placeholder="Bilingual ground dispatch teams, owned vehicle fleets..."
                  />
                </div>
              </div>
            </div>

            {/* Hubs Filtering & Quick Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">
                  Configured Hubs ({config.homepageHubs?.length || 0})
                </span>
                <span className="text-[11px] text-slate-500">
                  • Active in Firestore: {cityHubs.filter(h => h.status === 'ACTIVE').length}
                </span>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={hubSearchQuery}
                  onChange={e => setHubSearchQuery(e.target.value)}
                  placeholder="Filter configured hubs..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {/* List of Configured Homepage Hubs */}
            <div className="space-y-3">
              {(!config.homepageHubs || config.homepageHubs.length === 0) ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">No Hubs Configured on Homepage</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Click "Add Hub to Homepage" above to select active ground hubs from your Firestore database to feature on the live homepage.
                  </p>
                </div>
              ) : (
                config.homepageHubs
                  .filter(item => {
                    if (!hubSearchQuery) return true;
                    const hub = cityHubs.find(h => h.id === item.hubId || h.id === `hub-${item.hubId}` || item.hubId.endsWith(h.id));
                    const dest = destinations.find(d => d.id === hub?.destinationId || d.slug === hub?.destinationId);
                    const q = hubSearchQuery.toLowerCase();
                    return (
                      (item.titleOverride && item.titleOverride.toLowerCase().includes(q)) ||
                      (hub?.name && hub.name.toLowerCase().includes(q)) ||
                      (dest?.name && dest.name.toLowerCase().includes(q))
                    );
                  })
                  .map((item, idx) => {
                    const hub = cityHubs.find(h => h.id === item.hubId || h.id === `hub-${item.hubId}` || item.hubId.endsWith(h.id));
                    const dest = destinations.find(d => d.id === hub?.destinationId || d.slug === hub?.destinationId);
                    const region = regions.find(r => r.id === dest?.regionId || r.id === (dest as any)?.masterRegionId || r.id === (hub as any)?.regionId);
                    const counts = hub ? countingEngine.getCountsBreakdown({ hubId: hub.id }) : { totalProducts: 0, hotels: 0, activities: 0, transfers: 0, customFit: 0 };
                    const isArchivedOrMissing = !hub || hub.status === 'ARCHIVED';

                    const displayName = item.titleOverride || hub?.name || item.hubId;
                    const displayImage = item.imageOverride || hub?.heroImage || dest?.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=600&auto=format&fit=crop';
                    const displayBadge = item.badge || (item.featured ? 'Featured Hub' : 'Direct Ground Desk');

                    return (
                      <div
                        key={`homepage-hub-cfg-${item.hubId}-${idx}`}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all gap-4 ${
                          item.enabled === false
                            ? 'border-slate-200 bg-slate-100/70 opacity-65'
                            : isArchivedOrMissing
                            ? 'border-amber-200 bg-amber-50/50'
                            : item.featured
                            ? 'border-teal-300 bg-teal-50/20 shadow-xs'
                            : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                        }`}
                      >
                        {/* Hub Thumbnail & Info */}
                        <div className="flex items-center space-x-4 min-w-0">
                          <span className="w-6 text-center text-xs font-mono font-bold text-slate-400 shrink-0">
                            {idx + 1}
                          </span>
                          <img
                            src={displayImage}
                            alt={displayName}
                            className="w-14 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <h4 className="text-xs font-bold text-slate-900 truncate">{displayName}</h4>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                {displayBadge}
                              </span>
                              {isArchivedOrMissing && (
                                <span className="inline-flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Missing in Firestore</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                              <span>
                                {item.destinationOverride ? (
                                  <span className="font-semibold text-teal-700">{item.destinationOverride} (Custom Dest)</span>
                                ) : (
                                  <>{region ? `${region.name} • ` : ''}{dest?.name || hub?.destinationName || 'Ground Gateway'}</>
                                )}
                              </span>
                              <span>•</span>
                              <span className="font-semibold text-slate-700">
                                {item.inventoryCountOverride !== undefined ? (
                                  <span className="text-teal-700 font-bold">{item.inventoryCountOverride} Services (Override)</span>
                                ) : (
                                  <>{counts.totalProducts} Direct Services</>
                                )}
                              </span>
                              <span>•</span>
                              <span className="font-semibold text-slate-700">
                                {item.hotelsCountOverride !== undefined ? (
                                  <span className="text-teal-700 font-bold">{item.hotelsCountOverride} Hotels (Override)</span>
                                ) : (
                                  <>{counts.hotels} Hotel Allotments</>
                                )}
                              </span>
                              {item.customUrl && (
                                <>
                                  <span>•</span>
                                  <span className="text-[10px] font-mono text-slate-500 truncate max-w-[150px]" title={item.customUrl}>
                                    Link: {item.customUrl}
                                  </span>
                                </>
                              )}
                            </div>
                            {item.titleOverride && (
                              <p className="text-[10px] text-teal-700 font-medium">
                                Title override active (Original: {hub?.name || item.hubId})
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Hub Actions & Controls */}
                        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                          {/* Featured Toggle */}
                          <button
                            type="button"
                            onClick={() => toggleHubFeatured(item.hubId)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              item.featured
                                ? 'bg-teal-100 text-[#008972] border border-teal-300 font-black'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                            title="Toggle featured status"
                          >
                            {item.featured ? '★ Featured Hub' : 'Standard'}
                          </button>

                          {/* Visibility Toggle */}
                          <button
                            type="button"
                            onClick={() => toggleHubVisibility(item.hubId)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              item.enabled !== false
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                            title="Toggle live homepage visibility"
                          >
                            {item.enabled !== false ? 'Active' : 'Hidden'}
                          </button>

                          {/* Customization Overrides Button */}
                          <button
                            type="button"
                            onClick={() => setEditingHubItem(item)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                            title="Customize CMS Overrides"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Reordering Controls */}
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveHub(idx, 'up')}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === (config.homepageHubs?.length || 0) - 1}
                              onClick={() => moveHub(idx, 'down')}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={() => removeHubFromHomepage(item.hubId)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Remove from Homepage"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD HUB TO HOMEPAGE */}
      {isAddHubModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col animate-in fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add City Hub to Homepage</h3>
                <p className="text-xs text-slate-500">
                  Select an active Firestore hub to display on the live homepage directory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddHubModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filters */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={addHubSearch}
                  onChange={e => setAddHubSearch(e.target.value)}
                  placeholder="Search hub by name or city..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                />
              </div>

              <select
                value={addHubRegionFilter}
                onChange={e => setAddHubRegionFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-bold"
              >
                <option value="ALL">All Master Regions</option>
                {regions.map(reg => (
                  <option key={reg.id} value={reg.id}>{reg.name}</option>
                ))}
              </select>
            </div>

            {/* Hubs Selection List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {cityHubs
                .filter(hub => hub.status === 'ACTIVE')
                .filter(hub => !(config.homepageHubs || []).some(h => h.hubId === hub.id))
                .filter(hub => {
                  if (!addHubSearch) return true;
                  const q = addHubSearch.toLowerCase();
                  return hub.name.toLowerCase().includes(q) || hub.destinationName.toLowerCase().includes(q);
                })
                .filter(hub => {
                  if (addHubRegionFilter === 'ALL') return true;
                  const dest = destinations.find(d => d.id === hub.destinationId || d.slug === hub.destinationId);
                  return dest?.regionId === addHubRegionFilter || (dest as any)?.masterRegionId === addHubRegionFilter;
                })
                .map(hub => {
                  const dest = destinations.find(d => d.id === hub.destinationId || d.slug === hub.destinationId);
                  const breakdown = countingEngine.getCountsBreakdown({ hubId: hub.id });

                  return (
                    <div
                      key={`add-hub-option-${hub.id}`}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <img
                          src={hub.heroImage || dest?.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=300&auto=format&fit=crop'}
                          alt={hub.name}
                          className="w-12 h-10 rounded-lg object-cover border border-slate-200"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{hub.name}</h4>
                          <p className="text-[11px] text-slate-500">
                            {dest?.name || hub.destinationName} • {breakdown.totalProducts} services • {breakdown.hotels} hotels
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => addHubToHomepage(hub.id)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Homepage</span>
                      </button>
                    </div>
                  );
                })}

              {cityHubs
                .filter(hub => hub.status === 'ACTIVE')
                .filter(hub => !(config.homepageHubs || []).some(h => h.hubId === hub.id)).length === 0 && (
                <div className="p-8 text-center text-slate-500 text-xs">
                  All active Firestore hubs are already added to the homepage.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAddHubModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT HUB CMS OVERRIDES */}
      {editingHubItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Customize Hub Homepage Appearance</h3>
                <p className="text-xs text-slate-500">Override title, description, or image specifically for the homepage.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingHubItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Title Override (Optional)
                </label>
                <input
                  type="text"
                  value={editingHubItem.titleOverride || ''}
                  onChange={e => setEditingHubItem({ ...editingHubItem, titleOverride: e.target.value })}
                  placeholder="e.g. Tokyo Operations & Kanto Gateway"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">Leave blank to use the standard Firestore Hub Name.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Badge Text (Optional)
                </label>
                <input
                  type="text"
                  value={editingHubItem.badge || ''}
                  onChange={e => setEditingHubItem({ ...editingHubItem, badge: e.target.value })}
                  placeholder="e.g. Primary Airport Hub, VIP Ground Fleet"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description Override (Optional)
                </label>
                <textarea
                  rows={3}
                  value={editingHubItem.descriptionOverride || ''}
                  onChange={e => setEditingHubItem({ ...editingHubItem, descriptionOverride: e.target.value })}
                  placeholder="Custom operational summary for the homepage card..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Hero Image URL Override (Optional)
                </label>
                <input
                  type="text"
                  value={editingHubItem.imageOverride || ''}
                  onChange={e => setEditingHubItem({ ...editingHubItem, imageOverride: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Destination Name Override (Optional)
                </label>
                <input
                  type="text"
                  value={editingHubItem.destinationOverride || ''}
                  onChange={e => setEditingHubItem({ ...editingHubItem, destinationOverride: e.target.value })}
                  placeholder="e.g. Japan • Kanto Region"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">Overrides the region/destination line on the homepage card.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Destination Custom Link / URL (Optional)
                </label>
                <input
                  type="text"
                  value={editingHubItem.customUrl || ''}
                  onChange={e => setEditingHubItem({ ...editingHubItem, customUrl: e.target.value })}
                  placeholder="e.g. /catalog?destination=japan or /hub/tokyo"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">Default destination navigates to catalog filtered by hub.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Direct Services Count (Optional)
                  </label>
                  <input
                    type="number"
                    value={editingHubItem.inventoryCountOverride ?? ''}
                    onChange={e => setEditingHubItem({ 
                      ...editingHubItem, 
                      inventoryCountOverride: e.target.value === '' ? undefined : Number(e.target.value) 
                    })}
                    placeholder="Leave blank for live Firestore count"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Manual override for total products/services.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Hotel Allotments Count (Optional)
                  </label>
                  <input
                    type="number"
                    value={editingHubItem.hotelsCountOverride ?? ''}
                    onChange={e => setEditingHubItem({ 
                      ...editingHubItem, 
                      hotelsCountOverride: e.target.value === '' ? undefined : Number(e.target.value) 
                    })}
                    placeholder="Leave blank for live Firestore count"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Manual override for hotel allocations.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  CTA Button Label (Optional)
                </label>
                <input
                  type="text"
                  value={editingHubItem.ctaLabel || ''}
                  onChange={e => setEditingHubItem({ ...editingHubItem, ctaLabel: e.target.value })}
                  placeholder="e.g. Explore Tokyo Operations"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingHubItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveHubOverrides(editingHubItem)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 transition-all shadow-xs"
              >
                Save Overrides
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 3: DESTINATIONS & ORDERING */}
      {activeSubTab === 'DESTINATIONS' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <LayoutTemplate className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Destination Hubs Ordering & Featured Status</h3>
                  <p className="text-xs text-slate-500">Search, select, reorder, and toggle featured badges for destination hubs on the homepage.</p>
                </div>
              </div>

              {/* Destination Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={destSearchQuery}
                  onChange={e => setDestSearchQuery(e.target.value)}
                  placeholder="Search destination..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            {/* Destination Selection & Reordering List */}
            <div className="space-y-3">
              {(config.destinationOrdering || [])
                .filter(destId => {
                  if (!destSearchQuery) return true;
                  const d = destinations.find(dest => dest.id === destId || dest.slug === destId);
                  return d?.name.toLowerCase().includes(destSearchQuery.toLowerCase());
                })
                .map((destId, idx) => {
                  const destination = destinations.find(d => d.id === destId || d.slug === destId);
                  if (!destination) return null;
                  const isFeatured = (config.featuredDestinationIds || []).some(id => id === destId || id === destination.id || id === destination.slug);

                  return (
                    <div 
                      key={`homepage-dest-order-${destId}-${destination.id}-${idx}`}
                      className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <span className="w-6 text-center text-xs font-mono font-bold text-slate-400">
                          {idx + 1}
                        </span>
                        <img 
                          src={destination.heroImage} 
                          alt={destination.name} 
                          className="w-12 h-10 rounded-lg object-cover border border-slate-200" 
                        />
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{destination.name}</h4>
                          <p className="text-[11px] text-slate-500">{destination.tagline || destination.country}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <button
                          type="button"
                          onClick={() => toggleFeaturedDestination(destination.id || destId)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            isFeatured 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold' 
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {isFeatured ? '★ Featured on Home' : 'Standard'}
                        </button>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveDestination(idx, 'up')}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === (config.destinationOrdering?.length || 0) - 1}
                            onClick={() => moveDestination(idx, 'down')}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Unlisted Destinations Pool */}
            {destinations.some(d => !(config.destinationOrdering || []).some(id => id === d.id || id === d.slug)) && (
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Available Destinations (Click to Add to Homepage Ordering)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {destinations
                    .filter(d => !(config.destinationOrdering || []).some(id => id === d.id || id === d.slug))
                    .map((d, dIdx) => (
                      <button
                        key={`unlisted-dest-${d.id || d.slug}-${dIdx}`}
                        onClick={() => toggleDestinationInOrdering(d.id)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#00C6A6]/20 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#00C6A6]" />
                        <span>{d.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB TAB: HOMEPAGE CONTENT SECTIONS */}
      {activeSubTab === 'SECTIONS' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#008972] flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900">Live Homepage Content Sections</h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Direct Live Sync
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Control the headlines, badges, subtitles, and visibility for every major section rendered on the live storefront.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSave()}
              className="inline-flex items-center space-x-2 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer text-xs"
            >
              <Save className="w-4 h-4" />
              <span>Publish Sections Live</span>
            </button>
          </div>

          {/* Section 2: Brand Introduction & Architecture */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                  02
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Section 2: Brand Introduction & Architecture</h4>
                  <p className="text-xs text-slate-500">Direct DMC ground handling architecture, value proposition, and wholesale SLA guarantees.</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showBrandIntroduction !== false}
                  onChange={e => {
                    const updated = { ...config, showBrandIntroduction: e.target.checked };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#008972]"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Eyebrow Badge
                </label>
                <input
                  type="text"
                  value={config.brandIntroductionBadge ?? 'DIRECT DMC GROUND HANDLING ARCHITECTURE'}
                  onChange={e => {
                    const updated = { ...config, brandIntroductionBadge: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium"
                  placeholder="DIRECT DMC GROUND HANDLING ARCHITECTURE"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Main Headline
                </label>
                <input
                  type="text"
                  value={config.brandIntroductionTitle ?? 'One Contract. 20+ In-Country Desks. Zero Intermediary Markups.'}
                  onChange={e => {
                    const updated = { ...config, brandIntroductionTitle: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold"
                  placeholder="One Contract. 20+ In-Country Desks. Zero Intermediary Markups."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Supporting Description
                </label>
                <textarea
                  rows={2}
                  value={config.brandIntroductionSubtitle ?? 'TheUnbound operates dedicated, fully licensed DMC infrastructure across premier global destinations. We provide licensed travel advisors, wholesalers, and corporate buyers with unmediated supplier rates, verified quality assurance, and end-to-end ground coordination.'}
                  onChange={e => {
                    const updated = { ...config, brandIntroductionSubtitle: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Destination Operations & Global Desks */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#008972] flex items-center justify-center font-bold text-xs">
                  03
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Section 3: Destination Operations & Global Desks</h4>
                  <p className="text-xs text-slate-500">Contracted destination corridors, active ground desks, and region filter tabs.</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showDestinationFilter !== false}
                  onChange={e => {
                    const updated = { ...config, showDestinationFilter: e.target.checked };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#008972]"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Eyebrow Badge
                </label>
                <input
                  type="text"
                  value={config.destinationSectionBadge ?? 'DESTINATION OPERATIONS & GLOBAL DESKS'}
                  onChange={e => {
                    const updated = { ...config, destinationSectionBadge: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium"
                  placeholder="DESTINATION OPERATIONS & GLOBAL DESKS"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Section Headline
                </label>
                <input
                  type="text"
                  value={config.destinationSectionTitle ?? 'Contracted Global Desks & Direct Handling Corridors'}
                  onChange={e => {
                    const updated = { ...config, destinationSectionTitle: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold"
                  placeholder="Contracted Global Desks & Direct Handling Corridors"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Section Subtitle
                </label>
                <input
                  type="text"
                  value={config.destinationSectionSubtitle ?? 'Explore dedicated in-country destination offices, active ground teams, and direct wholesale inventory.'}
                  onChange={e => {
                    const updated = { ...config, destinationSectionSubtitle: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                  placeholder="Explore dedicated in-country destination offices..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Grid Columns
                </label>
                <select
                  value={config.destinationGridColumns || 3}
                  onChange={e => {
                    const updated = { ...config, destinationGridColumns: parseInt(e.target.value, 10) as 2 | 3 | 4 };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white font-bold"
                >
                  <option value={2}>2 Columns (Large Cards)</option>
                  <option value={3}>3 Columns (Standard Grid)</option>
                  <option value={4}>4 Columns (Dense Catalog)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Why Travel Agents Partner With TheUnbound */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                  04
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Section 4: Why Travel Agents Partner With TheUnbound</h4>
                  <p className="text-xs text-slate-500">Core B2B partner advantages, SLA commitments, margin protection, and operations.</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showPartnershipBenefits !== false}
                  onChange={e => {
                    const updated = { ...config, showPartnershipBenefits: e.target.checked };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#008972]"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Eyebrow Badge
                </label>
                <input
                  type="text"
                  value={config.partnershipBenefitsBadge ?? 'B2B ADVANTAGE FOR TRAVEL ADVISORS & WHOLESALERS'}
                  onChange={e => {
                    const updated = { ...config, partnershipBenefitsBadge: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium"
                  placeholder="B2B ADVANTAGE FOR TRAVEL ADVISORS & WHOLESALERS"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Section Headline
                </label>
                <input
                  type="text"
                  value={config.partnershipBenefitsTitle ?? 'Why Travel Agents Partner With TheUnbound'}
                  onChange={e => {
                    const updated = { ...config, partnershipBenefitsTitle: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold"
                  placeholder="Why Travel Agents Partner With TheUnbound"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Section Subtitle
                </label>
                <input
                  type="text"
                  value={config.partnershipBenefitsSubtitle ?? 'We eliminate middlemen, protect your margins, and provide dedicated on-the-ground support so you can deliver exceptional travel experiences with complete confidence.'}
                  onChange={e => {
                    const updated = { ...config, partnershipBenefitsSubtitle: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                  placeholder="We eliminate middlemen, protect your margins..."
                />
              </div>
            </div>
          </div>

          {/* Section 5: Partner Onboarding Process */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#008972] flex items-center justify-center font-bold text-xs">
                  05
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Section 5: Partner Onboarding Process</h4>
                  <p className="text-xs text-slate-500">4-step trade application, vetting, net rate access, and operations execution process.</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showOnboardingProcess !== false}
                  onChange={e => {
                    const updated = { ...config, showOnboardingProcess: e.target.checked };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#008972]"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Eyebrow Badge
                </label>
                <input
                  type="text"
                  value={config.onboardingProcessBadge ?? 'HOW TO WORK WITH US'}
                  onChange={e => {
                    const updated = { ...config, onboardingProcessBadge: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium"
                  placeholder="HOW TO WORK WITH US"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Section Headline
                </label>
                <input
                  type="text"
                  value={config.onboardingProcessTitle ?? 'Start Booking in 4 Simple Steps'}
                  onChange={e => {
                    const updated = { ...config, onboardingProcessTitle: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold"
                  placeholder="Start Booking in 4 Simple Steps"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Section Subtitle
                </label>
                <input
                  type="text"
                  value={config.onboardingProcessSubtitle ?? 'Our onboarding is seamless and tailored to licensed travel advisors and wholesale buyers.'}
                  onChange={e => {
                    const updated = { ...config, onboardingProcessSubtitle: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                  placeholder="Our onboarding is seamless..."
                />
              </div>
            </div>
          </div>

          {/* Section 8: Final Trade Conversion CTA */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                  08
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Section 8: B2B Conversion & Quotation CTA</h4>
                  <p className="text-xs text-slate-500">Bottom conversion banner with trade access registration and direct support desk contacts.</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showConversionCTA !== false}
                  onChange={e => {
                    const updated = { ...config, showConversionCTA: e.target.checked };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#008972]"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Banner Headline
                </label>
                <input
                  type="text"
                  value={config.ctaTitle ?? 'Ready to Streamline Your Ground Operations?'}
                  onChange={e => {
                    const updated = { ...config, ctaTitle: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold"
                  placeholder="Ready to Streamline Your Ground Operations?"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Banner Subtitle
                </label>
                <input
                  type="text"
                  value={config.ctaSubtitle ?? 'Join 500+ luxury travel agencies and tour operators who trust TheUnbound for direct ground dispatch and wholesale FIT contracting.'}
                  onChange={e => {
                    const updated = { ...config, ctaSubtitle: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                  placeholder="Join 500+ luxury travel agencies..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Primary Action Button Text
                </label>
                <input
                  type="text"
                  value={config.ctaButtonText ?? 'Apply for Trade Access'}
                  onChange={e => {
                    const updated = { ...config, ctaButtonText: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-[#008972]"
                  placeholder="Apply for Trade Access"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Trade Desk Email
                </label>
                <input
                  type="email"
                  value={config.tradeContactEmail ?? 'partners@theunbound.com'}
                  onChange={e => {
                    const updated = { ...config, tradeContactEmail: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                  placeholder="partners@theunbound.com"
                />
              </div>
            </div>
          </div>

          {/* Bottom Save Action */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => handleSave()}
              className="inline-flex items-center space-x-2 bg-[#008972] hover:bg-[#00C6A6] text-white hover:text-slate-950 font-bold px-8 py-3 rounded-xl shadow-xs transition-all cursor-pointer text-xs"
            >
              <Save className="w-4 h-4" />
              <span>Publish All Section Changes Live</span>
            </button>
          </div>
        </div>
      )}

      {/* SUB TAB: REGULATORY AFFILIATIONS (JATA / MSME / NIDHI) */}
      {activeSubTab === 'AFFILIATIONS' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#008972] border border-teal-200 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5 text-[#008972]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Regulatory Affiliations Manager (JATA / MSME / NIDHI)</h3>
                  <p className="text-xs text-slate-500">
                    Manage authoritative regulatory registrations, accreditation references, official government links, and display order.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const updated = { ...config, affiliations: INITIAL_AFFILIATIONS };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset to JATA / MSME / NIDHI Triad</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAffiliationForm({
                      name: '',
                      fullName: '',
                      type: 'Regulatory Verification',
                      description: '',
                      verificationReference: '',
                      officialLink: '',
                      displayOrder: ((config.affiliations || INITIAL_AFFILIATIONS).length) + 1,
                      isActive: true
                    });
                    setIsEditingAffiliation(true);
                  }}
                  className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4 text-[#00C6A6]" />
                  <span>Add Affiliation</span>
                </button>
              </div>
            </div>

            {/* Section Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Section Badge
                </label>
                <input
                  type="text"
                  value={config.affiliationsSectionBadge || 'REGULATORY AFFILIATIONS & ACCREDITATIONS'}
                  onChange={e => {
                    const updated = { ...config, affiliationsSectionBadge: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Section Title
                </label>
                <input
                  type="text"
                  value={config.affiliationsSectionTitle || 'Regulatory Verification & Recognized Trade Affiliations'}
                  onChange={e => {
                    const updated = { ...config, affiliationsSectionTitle: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Section Subtitle
                </label>
                <input
                  type="text"
                  value={config.affiliationsSectionSubtitle || 'TheUnbound operates under rigorous regulatory oversight and recognized tourism bodies.'}
                  onChange={e => {
                    const updated = { ...config, affiliationsSectionSubtitle: e.target.value };
                    setConfig(updated);
                    db.updateHomepageConfig(updated, user);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white"
                />
              </div>
            </div>

            {/* Affiliations Cards List */}
            <div className="space-y-3">
              {(config.affiliations && config.affiliations.length > 0 ? config.affiliations : INITIAL_AFFILIATIONS).map((aff, idx) => (
                <div 
                  key={aff.id}
                  className={`p-4 rounded-xl border transition-all ${
                    aff.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          Order #{aff.displayOrder || idx + 1}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-teal-50 text-[#008972] rounded">
                          {aff.type}
                        </span>
                        {!aff.isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-600 rounded">
                            Inactive / Hidden
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline space-x-2 pt-0.5">
                        <span className="text-sm font-black text-slate-900">{aff.name}</span>
                        <span className="text-xs font-medium text-slate-600">— {aff.fullName}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{aff.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                        {aff.verificationReference && (
                          <span className="text-slate-500">
                            <strong>Reference:</strong> <code className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{aff.verificationReference}</code>
                          </span>
                        )}
                        {aff.officialLink && (
                          <a 
                            href={aff.officialLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[#008972] hover:underline flex items-center space-x-1"
                          >
                            <span>Official Destination URL</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleAffiliation(aff.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                          aff.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {aff.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAffiliationForm(aff);
                          setIsEditingAffiliation(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="Edit Affiliation"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAffiliation(aff.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Delete Affiliation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'NEWSLETTER' && (
        <NewsletterManager />
      )}

      {activeSubTab === 'FAQS' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Homepage FAQs Manager (General & Trade Operations)</h3>
                  <p className="text-xs text-slate-500">
                    Dedicated general FAQs displayed on the home storefront (distinct from destination-specific FAQs).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFaqForm({ question: '', answer: '', category: 'Operations', displayOrder: (config.homepageFAQs?.length || 0) + 1, isPublished: true });
                  setIsEditingFaq(true);
                }}
                className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-[#00C6A6]" />
                <span>Add Homepage FAQ</span>
              </button>
            </div>

            {/* FAQs List */}
            <div className="space-y-3">
              {(config.homepageFAQs || []).map((faq, idx) => (
                <div 
                  key={faq.id}
                  className={`p-4 rounded-xl border transition-all ${
                    faq.isPublished ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          Order #{faq.displayOrder || idx + 1}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded">
                          {faq.category || 'General'}
                        </span>
                        {!faq.isPublished && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-600 rounded">
                            Draft / Hidden
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 pt-1">{faq.question}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">{faq.answer}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleFaqPublished(faq.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                          faq.isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {faq.isPublished ? 'Published' : 'Hidden'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFaqForm(faq);
                          setIsEditingFaq(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="Edit FAQ"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFaq(faq.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Delete FAQ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {(!config.homepageFAQs || (config.homepageFAQs || []).length === 0) && (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  No homepage FAQs defined yet. Click &quot;Add Homepage FAQ&quot; to create one.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create FAQ Modal */}
      {isEditingFaq && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveFaq} className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {faqForm.id ? 'Edit Homepage FAQ' : 'Add New Homepage FAQ'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingFaq(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <input
                type="text"
                placeholder="e.g. Operations, Bookings & SLA, B2B Quotations"
                value={faqForm.category || ''}
                onChange={e => setFaqForm({ ...faqForm, category: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Question</label>
              <input
                type="text"
                required
                placeholder="e.g. What is TheUnbound ground network coverage?"
                value={faqForm.question || ''}
                onChange={e => setFaqForm({ ...faqForm, question: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Answer</label>
              <textarea
                rows={4}
                required
                placeholder="Provide a clear, detailed answer for travel advisors and prospective clients..."
                value={faqForm.answer || ''}
                onChange={e => setFaqForm({ ...faqForm, answer: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Display Order</label>
                <input
                  type="number"
                  min={1}
                  value={faqForm.displayOrder || 1}
                  onChange={e => setFaqForm({ ...faqForm, displayOrder: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center pt-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={faqForm.isPublished !== false}
                    onChange={e => setFaqForm({ ...faqForm, isPublished: e.target.checked })}
                    className="w-4 h-4 text-[#008972] rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">Published Live</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditingFaq(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#008972] text-white hover:bg-[#00C6A6] hover:text-slate-950 cursor-pointer shadow-xs"
              >
                Save FAQ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit/Create Affiliation Modal */}
      {isEditingAffiliation && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleSaveAffiliation} className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {affiliationForm.id ? 'Edit Regulatory Affiliation' : 'Add Regulatory Affiliation'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingAffiliation(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Acronym / Code *</label>
                <input
                  type="text"
                  required
                  value={affiliationForm.name || ''}
                  onChange={e => setAffiliationForm({ ...affiliationForm, name: e.target.value })}
                  placeholder="e.g. JATA, MSME, NIDHI"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Accreditation Type</label>
                <input
                  type="text"
                  value={affiliationForm.type || ''}
                  onChange={e => setAffiliationForm({ ...affiliationForm, type: e.target.value })}
                  placeholder="e.g. Accredited Allied Partner"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Entity Name *</label>
              <input
                type="text"
                required
                value={affiliationForm.fullName || ''}
                onChange={e => setAffiliationForm({ ...affiliationForm, fullName: e.target.value })}
                placeholder="e.g. Japan Association of Travel Agents"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
              <textarea
                rows={2}
                value={affiliationForm.description || ''}
                onChange={e => setAffiliationForm({ ...affiliationForm, description: e.target.value })}
                placeholder="Description of regulatory status and accreditation..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Registration / Verification Reference</label>
              <input
                type="text"
                value={affiliationForm.verificationReference || ''}
                onChange={e => setAffiliationForm({ ...affiliationForm, verificationReference: e.target.value })}
                placeholder="e.g. UDYAM-DL-08-0049281 or Allied Member #JATA-INTL-2025"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Official Website Link</label>
              <input
                type="url"
                value={affiliationForm.officialLink || ''}
                onChange={e => setAffiliationForm({ ...affiliationForm, officialLink: e.target.value })}
                placeholder="https://www.jata-net.or.jp/"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Display Order</label>
                <input
                  type="number"
                  min={1}
                  value={affiliationForm.displayOrder || 1}
                  onChange={e => setAffiliationForm({ ...affiliationForm, displayOrder: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={affiliationForm.isActive !== false}
                    onChange={e => setAffiliationForm({ ...affiliationForm, isActive: e.target.checked })}
                    className="w-4 h-4 text-[#008972] rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">Active & Published</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditingAffiliation(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#008972] text-white hover:bg-[#00C6A6] hover:text-slate-950 cursor-pointer shadow-xs"
              >
                Save Affiliation
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
