import { DestinationFAQ } from '../types';

export const INITIAL_FAQS: DestinationFAQ[] = [
  // Japan FAQs
  {
    id: 'faq-jp-01',
    destinationId: 'japan',
    destinationName: 'Japan',
    question: 'How do ground transfers work between Tokyo, Kyoto, and Osaka?',
    answer: 'TheUnbound operates seamless private Shinkansen bullet train seat allocations with door-to-door luggage forwarding (Takkyubin) and VIP private vehicle station transfers at both arrival and departure ends.',
    displayOrder: 1,
    isPublished: true,
    category: 'Logistics & Transit'
  },
  {
    id: 'faq-jp-02',
    destinationId: 'japan',
    destinationName: 'Japan',
    question: 'Are guides licensed, bilingual, and verified in advance?',
    answer: 'Yes. All guides dispatched by TheUnbound hold official National Government Licensed Guide Interpreter certifications with minimum 5+ years of VIP touring experience, fluent English proficiency, and deep historical expertise.',
    displayOrder: 2,
    isPublished: true,
    category: 'Guides & Operations'
  },
  {
    id: 'faq-jp-03',
    destinationId: 'japan',
    destinationName: 'Japan',
    question: 'What is the policy for dietary preferences (Halal, Vegetarian, Vegan)?',
    answer: 'We coordinate all meal requirements in advance directly with our partner ryokans, kaiseki establishments, and private chefs to ensure dietary restrictions are strictly honored with authentic substitutes.',
    displayOrder: 3,
    isPublished: true,
    category: 'Dining & Experiences'
  },

  // Southeast Asia / Thailand FAQs
  {
    id: 'faq-th-01',
    destinationId: 'southeast-asia',
    destinationName: 'Southeast Asia',
    question: 'What types of vehicles are deployed for Bangkok & Phuket private ground transfers?',
    answer: 'We exclusively deploy modern, air-conditioned Toyota Commuter VIP 9-seaters and luxury Toyota Alphard/Vellfire vehicles equipped with bottled water, refreshing towels, and complimentary mobile Wi-Fi.',
    displayOrder: 1,
    isPublished: true,
    category: 'Transfers & Vehicles'
  },
  {
    id: 'faq-th-02',
    destinationId: 'southeast-asia',
    destinationName: 'Southeast Asia',
    question: 'How are island speedboats and private yacht charters vetted?',
    answer: 'All marine charters undergo bi-monthly marine safety inspections, maintain licensed captains, and include premium life jackets for adults and children, marine insurance, and certified crew.',
    displayOrder: 2,
    isPublished: true,
    category: 'Safety & Marine'
  },

  // United Kingdom FAQs
  {
    id: 'faq-uk-01',
    destinationId: 'united-kingdom',
    destinationName: 'United Kingdom',
    question: 'Do London and Scottish Highland tours include Blue Badge certified guides?',
    answer: 'Yes. All UK heritage tours feature official Blue Badge Tourist Guides—the highest qualification in British guiding, granting privileged skip-the-line access to Westminster Abbey, Tower of London, and Edinburgh Castle.',
    displayOrder: 1,
    isPublished: true,
    category: 'Guides & Heritage'
  },
  {
    id: 'faq-uk-02',
    destinationId: 'united-kingdom',
    destinationName: 'United Kingdom',
    question: 'Can private airport transfers accommodate oversized luggage and golf clubs?',
    answer: 'Yes. When booking transfers, you can specify Mercedes V-Class Executive MPVs or Range Rover Long Wheelbases tailored for oversized luggage and sporting equipment.',
    displayOrder: 2,
    isPublished: true,
    category: 'Transfers'
  }
];
