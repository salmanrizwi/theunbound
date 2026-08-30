import { FooterConfig } from '../types';

export const INITIAL_FOOTER_CONFIG: FooterConfig = {
  tagline: 'The premier B2B inbound Destination Management Company powering travel designers and luxury tour operators worldwide.',
  copyrightText: '© 2026 TheUnbound DMC Operations Ltd. All rights reserved. Registered Travel Partner.',
  showSocialLinks: true,
  socialLinks: [
    { platform: 'LinkedIn', url: 'https://linkedin.com/company/theunbound' },
    { platform: 'Instagram', url: 'https://instagram.com/theunbound_dmc' },
    { platform: 'WhatsApp', url: 'https://wa.me/919811654959' }
  ],
  columns: [
    {
      id: 'col-destinations',
      title: 'Destinations & Hubs',
      displayOrder: 1,
      items: [
        { id: 'f-dest-all', label: 'All Destinations Portfolio', type: 'DESTINATION', targetId: 'all', displayOrder: 1, isVisible: true },
        { id: 'f-dest-jp', label: 'Japan (5 Connected Hubs)', type: 'DESTINATION', targetId: 'japan', displayOrder: 2, isVisible: true },
        { id: 'f-dest-uk', label: 'United Kingdom', type: 'DESTINATION', targetId: 'uk', displayOrder: 3, isVisible: true },
        { id: 'f-dest-eu', label: 'Europe (Schengen)', type: 'DESTINATION', targetId: 'europe', displayOrder: 4, isVisible: true },
        { id: 'f-dest-th', label: 'Thailand', type: 'DESTINATION', targetId: 'thailand', displayOrder: 5, isVisible: true },
        { id: 'f-dest-uae', label: 'UAE & Dubai', type: 'DESTINATION', targetId: 'dubai', displayOrder: 6, isVisible: true }
      ]
    },
    {
      id: 'col-trade-tools',
      title: 'B2B Trade Tools',
      displayOrder: 2,
      items: [
        { id: 'f-tool-builder', label: 'B2B Quotation Builder', type: 'SYSTEM_VIEW', targetId: 'b2b-builder', displayOrder: 1, isVisible: true },
        { id: 'f-tool-visas', label: 'Visa Desk & Checklists', type: 'SYSTEM_VIEW', targetId: 'visas', displayOrder: 2, isVisible: true },
        { id: 'f-tool-hotels', label: 'Contracted Hotel Rates', type: 'SYSTEM_VIEW', targetId: 'home', displayOrder: 3, isVisible: true },
        { id: 'f-tool-reviews', label: 'Google Business Reviews', type: 'SYSTEM_VIEW', targetId: 'home', displayOrder: 4, isVisible: true }
      ]
    },
    {
      id: 'col-policies',
      title: 'Legal & Company',
      displayOrder: 3,
      items: [
        { id: 'f-page-about', label: 'About TheUnbound', type: 'CUSTOM_PAGE', targetId: 'about-theunbound', displayOrder: 1, isVisible: true },
        { id: 'f-page-terms', label: 'Terms of Service', type: 'SYSTEM_VIEW', targetId: 'terms', displayOrder: 2, isVisible: true },
        { id: 'f-page-privacy', label: 'Privacy Policy', type: 'SYSTEM_VIEW', targetId: 'privacy', displayOrder: 3, isVisible: true },
        { id: 'f-page-refund', label: 'Refund & Cancellation Policy', type: 'SYSTEM_VIEW', targetId: 'refund', displayOrder: 4, isVisible: true }
      ]
    },
    {
      id: 'col-contact',
      title: 'Agent Support Desk',
      displayOrder: 4,
      items: [
        { id: 'f-contact-hub', label: 'Global Contact Hub', type: 'SYSTEM_VIEW', targetId: 'contact', displayOrder: 1, isVisible: true },
        { id: 'f-contact-email', label: 'business@theunbound.in', type: 'CUSTOM_LINK', targetId: '', customUrl: 'mailto:business@theunbound.in', displayOrder: 2, isVisible: true },
        { id: 'f-contact-tel', label: '+91 9811654959 (24/7 Operations)', type: 'CUSTOM_LINK', targetId: '', customUrl: 'tel:+919811654959', displayOrder: 3, isVisible: true }
      ]
    }
  ]
};
