import type {
  EntitySEO,
  GlobalSEODefaults,
  SEOAuditItem,
  SEOEntityType,
  BreadcrumbItem,
  StructuredDataType,
  SEORedirect
} from '../types/seo';

export const DEFAULT_GLOBAL_SEO_DEFAULTS: GlobalSEODefaults = {
  titleSuffix: ' | TheUnbound DMC',
  canonicalDomain: 'https://theunbound.in',
  organizationName: 'TheUnbound DMC',
  organizationLogo: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=300&q=80',
  siteName: 'TheUnbound - Premier Destination Management Company',
  defaultMetaDescription:
    'TheUnbound is a premier Destination Management Company (DMC) delivering curated luxury travel experiences, ground operations, tours, activities, and hotel allotments worldwide.',
  defaultOgImage:
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
  defaultTwitterImage:
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
  defaultRobots: {
    index: true,
    follow: true,
    noarchive: false,
    nosnippet: false
  },
  defaultSchemaType: 'Organization',
  contactEmail: 'operations@theunbound.in',
  contactPhone: '+91 98765 43210',
  socialProfiles: {
    facebook: 'https://facebook.com/theunboundtravel',
    instagram: 'https://instagram.com/theunboundtravel',
    twitter: 'https://twitter.com/theunboundtravel',
    linkedin: 'https://linkedin.com/company/theunbound'
  },
  templates: {
    destination: {
      titleTemplate: '{name} DMC Travel Guide, Ground Operations & Tours',
      descTemplate:
        'Discover authentic luxury travel experiences in {name}. Partner with TheUnbound DMC for verified ground transport, private tours, bespoke guides, and vetted hotel allotments.'
    },
    cityHub: {
      titleTemplate: '{name} Experiences, Sightseeing & Local Ground Services',
      descTemplate:
        'Explore curated tours, activities, transfers, and premier hotels in {name}, {destinationName}. Curated by TheUnbound destination specialists.'
    },
    product: {
      titleTemplate: '{title} | {destinationName} Tours & Transfers',
      descTemplate:
        'Book {title} in {destinationName}. Guaranteed departures, licensed guides, and premium fleet managed directly by TheUnbound DMC.'
    },
    hotel: {
      titleTemplate: '{name} - Luxury Hotel & Allotments in {destinationName}',
      descTemplate:
        'Contracted luxury accommodation at {name} in {destinationName}. Direct DMC rates, instant allotment confirmation, and VIP amenities with TheUnbound.'
    },
    package: {
      titleTemplate: '{title} - {durationDays} Days Itinerary',
      descTemplate:
        'Experience our bespoke circuit package: {title}. Complete multi-day luxury tour with curated hotels, private transfers, and premier excursions across {destinationName}.'
    },
    activity: {
      titleTemplate: '{title} - Top Rated Ground Activity in {destinationName}',
      descTemplate:
        'Reserve {title} in {destinationName}. Premier private and small-group tours operated with utmost care and verified standards.'
    },
    blog: {
      titleTemplate: '{title} | TheUnbound Travel Insights',
      descTemplate:
        'Read {title}. Insider perspectives, curated destination guides, and operational insights from TheUnbound travel leaders.'
    },
    visa: {
      titleTemplate: '{country} Visa Requirements, Eligibility & Consular Guide',
      descTemplate:
        'Complete consular guidance for {country} travel visas. Processing time, required documentation, entry regulations, and seamless support from TheUnbound.'
    },
    customPage: {
      titleTemplate: '{title} | TheUnbound DMC',
      descTemplate:
        '{title} - Essential information, services, and policies from TheUnbound Destination Management Company.'
    }
  },
  robotsTxtCustomDirectives: `User-agent: *
Disallow: /admin
Disallow: /admin/*
Disallow: /cms
Disallow: /cms/*
Disallow: /b2b/*
Disallow: /account
Disallow: /account/*
Disallow: /dashboard
Disallow: /dashboard/*
Disallow: /cart
Disallow: /booking/*
Allow: /
Allow: /destinations
Allow: /destinations/*
Allow: /destination/*
Allow: /products/*
Allow: /product/*
Allow: /packages/*
Allow: /package/*
Allow: /hotels/*
Allow: /hotel/*
Allow: /blogs
Allow: /blogs/*
Allow: /visas
Allow: /visas/*
Allow: /pages/*
Allow: /page/*
Allow: /about
Allow: /contact
Allow: /terms
Allow: /privacy
Allow: /refund

Sitemap: https://theunbound.in/sitemap.xml`
};

export function sanitizeSlug(input: string): string {
  if (!input) return '';
  return input
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildFullUrl(path: string, domain: string = DEFAULT_GLOBAL_SEO_DEFAULTS.canonicalDomain): string {
  const cleanDomain = domain.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanDomain}${cleanPath}`;
}

export function resolveSEOTemplate(
  template: string,
  variables: Record<string, string | number | undefined>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const valStr = value !== undefined && value !== null ? String(value) : '';
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), valStr);
  }
  return result.replace(/\s+/g, ' ').trim();
}

export function buildFallbackSEO(
  entityType: SEOEntityType,
  entity: any,
  globalDefaults: GlobalSEODefaults = DEFAULT_GLOBAL_SEO_DEFAULTS
): EntitySEO {
  const name = entity.name || entity.title || entity.country || 'TheUnbound Destination Management';
  const slug = entity.slug || sanitizeSlug(name);
  const destinationName = entity.destinationName || (entity.country ? entity.country : '');
  const heroImage = entity.heroImage || entity.bannerImage || entity.featuredImage || globalDefaults.defaultOgImage;
  const rawDesc = entity.description || entity.summary || entity.travelGuideIntro || globalDefaults.defaultMetaDescription;
  const cleanDesc = typeof rawDesc === 'string' ? rawDesc.replace(/<[^>]*>?/gm, '').slice(0, 155) : globalDefaults.defaultMetaDescription;

  let resolvedTitle = `${name}${globalDefaults.titleSuffix}`;
  let resolvedDesc = cleanDesc;
  let defaultSchema: StructuredDataType = 'WebPage';
  let pathPrefix = '';

  switch (entityType) {
    case 'HOMEPAGE':
      resolvedTitle = `TheUnbound | Premier Destination Management Company (DMC)`;
      resolvedDesc = globalDefaults.defaultMetaDescription;
      defaultSchema = 'Organization';
      pathPrefix = '/';
      break;
    case 'DESTINATION':
      resolvedTitle = resolveSEOTemplate(globalDefaults.templates.destination.titleTemplate, { name, destinationName });
      resolvedDesc = resolveSEOTemplate(globalDefaults.templates.destination.descTemplate, { name, destinationName });
      defaultSchema = 'TouristDestination';
      pathPrefix = `/destinations/${slug}`;
      break;
    case 'CITY_HUB':
      resolvedTitle = resolveSEOTemplate(globalDefaults.templates.cityHub.titleTemplate, { name, destinationName });
      resolvedDesc = resolveSEOTemplate(globalDefaults.templates.cityHub.descTemplate, { name, destinationName });
      defaultSchema = 'TouristDestination';
      pathPrefix = `/destinations/${entity.destinationSlug || 'japan'}/${slug}`;
      break;
    case 'PRODUCT':
      resolvedTitle = resolveSEOTemplate(globalDefaults.templates.product.titleTemplate, { title: name, destinationName });
      resolvedDesc = resolveSEOTemplate(globalDefaults.templates.product.descTemplate, { title: name, destinationName });
      defaultSchema = 'Product';
      pathPrefix = `/products/${slug}`;
      break;
    case 'HOTEL':
      resolvedTitle = resolveSEOTemplate(globalDefaults.templates.hotel.titleTemplate, { name, destinationName });
      resolvedDesc = resolveSEOTemplate(globalDefaults.templates.hotel.descTemplate, { name, destinationName });
      defaultSchema = 'Hotel';
      pathPrefix = `/hotels/${slug}`;
      break;
    case 'PACKAGE':
      resolvedTitle = resolveSEOTemplate(globalDefaults.templates.package.titleTemplate, {
        title: name,
        destinationName,
        durationDays: entity.durationDays || (entity.itinerary ? entity.itinerary.length : 7)
      });
      resolvedDesc = resolveSEOTemplate(globalDefaults.templates.package.descTemplate, {
        title: name,
        destinationName,
        durationDays: entity.durationDays || (entity.itinerary ? entity.itinerary.length : 7)
      });
      defaultSchema = 'TouristTrip';
      pathPrefix = `/packages/${slug}`;
      break;
    case 'BLOG':
      resolvedTitle = resolveSEOTemplate(globalDefaults.templates.blog.titleTemplate, { title: name });
      resolvedDesc = cleanDesc.slice(0, 155);
      defaultSchema = 'Article';
      pathPrefix = `/blogs/${slug}`;
      break;
    case 'VISA':
      resolvedTitle = resolveSEOTemplate(globalDefaults.templates.visa.titleTemplate, { country: entity.country || name });
      resolvedDesc = resolveSEOTemplate(globalDefaults.templates.visa.descTemplate, { country: entity.country || name });
      defaultSchema = 'WebPage';
      pathPrefix = `/visas/${slug}`;
      break;
    case 'CUSTOM_PAGE':
      resolvedTitle = resolveSEOTemplate(globalDefaults.templates.customPage.titleTemplate, { title: name });
      resolvedDesc = cleanDesc.slice(0, 155);
      defaultSchema = 'WebPage';
      pathPrefix = `/pages/${slug}`;
      break;
    case 'LEGAL':
      resolvedTitle = `${name}${globalDefaults.titleSuffix}`;
      resolvedDesc = cleanDesc.slice(0, 155);
      defaultSchema = 'WebPage';
      pathPrefix = `/${slug}`;
      break;
    default:
      pathPrefix = `/${slug}`;
  }

  // Ensure title includes title suffix if not present
  if (!resolvedTitle.includes(globalDefaults.titleSuffix.trim()) && entityType !== 'HOMEPAGE') {
    resolvedTitle = `${resolvedTitle}${globalDefaults.titleSuffix}`;
  }

  return {
    title: resolvedTitle,
    metaDescription: resolvedDesc,
    slug,
    canonicalUrl: buildFullUrl(pathPrefix, globalDefaults.canonicalDomain),
    robots: {
      index: true,
      follow: true,
      noarchive: false,
      nosnippet: false
    },
    ogTitle: resolvedTitle,
    ogDescription: resolvedDesc,
    ogImage: heroImage,
    twitterTitle: resolvedTitle,
    twitterDescription: resolvedDesc,
    twitterImage: heroImage,
    focusKeyword: name,
    secondaryKeywords: entity.tags || [],
    imageAltText: `${name} - TheUnbound DMC`,
    schemaType: defaultSchema,
    schemaEnabled: true,
    breadcrumbTitle: name,
    lastUpdated: new Date().toISOString()
  };
}

export function generateStructuredData(
  entityType: SEOEntityType,
  entity: any,
  seo: EntitySEO,
  globalDefaults: GlobalSEODefaults = DEFAULT_GLOBAL_SEO_DEFAULTS
): Record<string, any> | null {
  if (!seo.schemaEnabled) return null;

  if (seo.customSchema && seo.customSchema.trim()) {
    try {
      return JSON.parse(seo.customSchema);
    } catch {
      // fallback to generated
    }
  }

  const name = entity.name || entity.title || entity.country || seo.title;
  const description = seo.metaDescription || globalDefaults.defaultMetaDescription;
  const url = seo.canonicalUrl || globalDefaults.canonicalDomain;
  const image = seo.ogImage || globalDefaults.defaultOgImage;

  const baseOrg = {
    '@type': 'TravelAgency',
    '@id': `${globalDefaults.canonicalDomain}/#organization`,
    name: globalDefaults.organizationName,
    url: globalDefaults.canonicalDomain,
    logo: globalDefaults.organizationLogo,
    email: globalDefaults.contactEmail,
    telephone: globalDefaults.contactPhone,
    sameAs: Object.values(globalDefaults.socialProfiles).filter(Boolean)
  };

  switch (entityType) {
    case 'HOMEPAGE':
      return {
        '@context': 'https://schema.org',
        '@graph': [
          baseOrg,
          {
            '@type': 'WebSite',
            '@id': `${globalDefaults.canonicalDomain}/#website`,
            url: globalDefaults.canonicalDomain,
            name: globalDefaults.siteName,
            description,
            publisher: { '@id': `${globalDefaults.canonicalDomain}/#organization` },
            potentialAction: {
              '@type': 'SearchAction',
              target: `${globalDefaults.canonicalDomain}/destinations?search={search_term_string}`,
              'query-input': 'required name=search_term_string'
            }
          }
        ]
      };

    case 'DESTINATION':
      return {
        '@context': 'https://schema.org',
        '@type': 'TouristDestination',
        name,
        description,
        url,
        image,
        touristType: ['Luxury Traveler', 'Cultural Enthusiast', 'Family Vacation'],
        provider: baseOrg,
        ...(entity.highlights && entity.highlights.length > 0
          ? {
              touristAttraction: entity.highlights.map((h: string) => ({
                '@type': 'TouristAttraction',
                name: h
              }))
            }
          : {})
      };

    case 'CITY_HUB':
      return {
        '@context': 'https://schema.org',
        '@type': 'TouristDestination',
        name,
        description,
        url,
        image,
        containedInPlace: {
          '@type': 'Country',
          name: entity.destinationName || 'Destination'
        },
        provider: baseOrg
      };

    case 'PRODUCT': {
      const currency = entity.pricing?.currency || entity.currency || 'USD';
      const startingPrice = entity.pricing?.retailPrice || entity.pricing?.b2bPrice || 100;
      return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name,
        description,
        image,
        sku: entity.sku || `SKU-${entity.id}`,
        brand: {
          '@type': 'Brand',
          name: globalDefaults.organizationName
        },
        offers: {
          '@type': 'Offer',
          url,
          priceCurrency: currency,
          price: startingPrice,
          availability: 'https://schema.org/InStock',
          validFrom: new Date().toISOString().split('T')[0],
          priceValidUntil: `${new Date().getFullYear() + 1}-12-31`
        },
        category: entity.category || 'Tour'
      };
    }

    case 'HOTEL':
      return {
        '@context': 'https://schema.org',
        '@type': 'Hotel',
        name,
        description,
        image,
        url,
        starRating: {
          '@type': 'Rating',
          ratingValue: entity.stars || 4,
          bestRating: 5
        },
        address: {
          '@type': 'PostalAddress',
          streetAddress: entity.address || '',
          addressCountry: entity.destinationName || ''
        },
        priceRange: '$$$$'
      };

    case 'PACKAGE':
      return {
        '@context': 'https://schema.org',
        '@type': 'TouristTrip',
        name,
        description,
        image,
        url,
        touristType: entity.tripType || 'Luxury',
        provider: baseOrg,
        ...(entity.itinerary && entity.itinerary.length > 0
          ? {
              itinerary: {
                '@type': 'ItemList',
                itemListElement: entity.itinerary.map((day: any, idx: number) => ({
                  '@type': 'ListItem',
                  position: idx + 1,
                  item: {
                    '@type': 'Day',
                    name: `Day ${day.dayNumber || idx + 1}: ${day.title || day.city || ''}`,
                    description: day.description || ''
                  }
                }))
              }
            }
          : {})
      };

    case 'BLOG':
      return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: name,
        description,
        image,
        url,
        datePublished: entity.publishDate || entity.createdAt || new Date().toISOString(),
        dateModified: entity.updatedAt || entity.createdAt || new Date().toISOString(),
        author: {
          '@type': 'Person',
          name: entity.author || 'TheUnbound Editorial Board'
        },
        publisher: baseOrg,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': url
        }
      };

    default:
      return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name,
        description,
        url,
        publisher: baseOrg
      };
  }
}

export function generateBreadcrumbSchema(
  items: BreadcrumbItem[],
  globalDefaults: GlobalSEODefaults = DEFAULT_GLOBAL_SEO_DEFAULTS
): Record<string, any> {
  const fullItems = [
    { name: 'Home', url: globalDefaults.canonicalDomain, position: 1 },
    ...items.map((it, idx) => ({
      name: it.name,
      url: it.url.startsWith('http') ? it.url : buildFullUrl(it.url, globalDefaults.canonicalDomain),
      position: idx + 2
    }))
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: fullItems.map((item) => ({
      '@type': 'ListItem',
      position: item.position,
      name: item.name,
      item: item.url
    }))
  };
}

export function auditEntitySEO(
  entityType: SEOEntityType,
  entity: any,
  seo?: EntitySEO,
  globalDefaults: GlobalSEODefaults = DEFAULT_GLOBAL_SEO_DEFAULTS
): SEOAuditItem {
  const entityName = entity.name || entity.title || entity.country || 'Unnamed Entity';
  const effectiveSEO = seo || buildFallbackSEO(entityType, entity, globalDefaults);

  const issues: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // Title validation
  if (!effectiveSEO.title || effectiveSEO.title.trim().length === 0) {
    issues.push('Missing SEO Title');
    score -= 30;
  } else {
    const titleLen = effectiveSEO.title.length;
    if (titleLen < 30) {
      warnings.push(`SEO Title is short (${titleLen} chars). Recommended: 50-60 characters.`);
      score -= 5;
    } else if (titleLen > 65) {
      warnings.push(`SEO Title may be truncated by Google (${titleLen} chars). Recommended: 50-60 characters.`);
      score -= 5;
    }
  }

  // Meta Description validation
  if (!effectiveSEO.metaDescription || effectiveSEO.metaDescription.trim().length === 0) {
    issues.push('Missing Meta Description');
    score -= 25;
  } else {
    const descLen = effectiveSEO.metaDescription.length;
    if (descLen < 110) {
      warnings.push(`Meta Description is short (${descLen} chars). Recommended: 120-160 characters.`);
      score -= 5;
    } else if (descLen > 165) {
      warnings.push(`Meta Description may be truncated (${descLen} chars). Recommended: 120-160 characters.`);
      score -= 5;
    }
  }

  // Canonical URL validation
  if (!effectiveSEO.canonicalUrl || effectiveSEO.canonicalUrl.trim().length === 0) {
    issues.push('Missing Canonical URL');
    score -= 15;
  } else if (!effectiveSEO.canonicalUrl.startsWith('http')) {
    issues.push('Canonical URL must be an absolute URL including https://');
    score -= 10;
  }

  // Slug check
  if (!effectiveSEO.slug || effectiveSEO.slug.trim().length === 0) {
    issues.push('Missing URL Slug');
    score -= 20;
  } else if (/[A-Z\s_]/.test(effectiveSEO.slug)) {
    warnings.push('URL Slug contains uppercase or spaces; should be lowercase hyphenated.');
    score -= 5;
  }

  // Social & Image check
  if (!effectiveSEO.ogImage && !entity.heroImage && !entity.featuredImage) {
    warnings.push('No Social Share Image (OG Image) provided; default fallback will be used.');
    score -= 5;
  }

  if (!effectiveSEO.imageAltText && (entity.heroImage || effectiveSEO.ogImage)) {
    warnings.push('Image ALT text not explicitly specified.');
    score -= 5;
  }

  // Focus keyword
  if (!effectiveSEO.focusKeyword) {
    warnings.push('No focus keyword configured.');
    score -= 5;
  } else {
    const kw = effectiveSEO.focusKeyword.toLowerCase();
    const titleHasKw = effectiveSEO.title.toLowerCase().includes(kw);
    const descHasKw = effectiveSEO.metaDescription.toLowerCase().includes(kw);
    if (!titleHasKw && !descHasKw) {
      warnings.push(`Focus keyword "${effectiveSEO.focusKeyword}" not found in title or description.`);
      score -= 5;
    }
  }

  // Robots / Index status
  let health: 'COMPLETE' | 'WARNING' | 'ERROR' | 'NOINDEX' = 'COMPLETE';
  if (effectiveSEO.robots && effectiveSEO.robots.index === false) {
    health = 'NOINDEX';
  } else if (issues.length > 0 || score < 50) {
    health = 'ERROR';
  } else if (warnings.length > 0 || score < 80) {
    health = 'WARNING';
  }

  score = Math.max(0, Math.min(100, score));

  return {
    id: `audit-${entityType.toLowerCase()}-${entity.id}`,
    entityId: entity.id,
    entityType,
    name: entityName,
    url: effectiveSEO.canonicalUrl || `/${effectiveSEO.slug}`,
    seo: effectiveSEO,
    health,
    issues,
    warnings,
    score,
    lastUpdated: effectiveSEO.lastUpdated || entity.updatedAt,
    published: entity.isPublished !== false && entity.status !== 'DRAFT' && entity.status !== 'ARCHIVED'
  };
}

export function applyHeadSEO(
  seo: EntitySEO,
  breadcrumbs?: BreadcrumbItem[],
  structuredDataJson?: Record<string, any> | null
): void {
  if (typeof document === 'undefined') return;

  // Title
  if (seo.title) {
    document.title = seo.title;
  }

  // Helper to create or update meta tags
  const setMetaTag = (selector: string, attrName: string, attrValue: string, content: string) => {
    let el = document.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  // Description
  if (seo.metaDescription) {
    setMetaTag('meta[name="description"]', 'name', 'description', seo.metaDescription);
  }

  // Robots
  const robotsParts: string[] = [];
  robotsParts.push(seo.robots.index ? 'index' : 'noindex');
  robotsParts.push(seo.robots.follow ? 'follow' : 'nofollow');
  if (seo.robots.noarchive) robotsParts.push('noarchive');
  if (seo.robots.nosnippet) robotsParts.push('nosnippet');
  setMetaTag('meta[name="robots"]', 'name', 'robots', robotsParts.join(', '));

  // Canonical link
  if (seo.canonicalUrl) {
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', seo.canonicalUrl);
  }

  // Open Graph
  const ogTitle = seo.ogTitle || seo.title;
  const ogDesc = seo.ogDescription || seo.metaDescription;
  const ogImg = seo.ogImage;

  setMetaTag('meta[property="og:title"]', 'property', 'og:title', ogTitle);
  setMetaTag('meta[property="og:description"]', 'property', 'og:description', ogDesc);
  setMetaTag('meta[property="og:type"]', 'property', 'og:type', 'website');
  if (seo.canonicalUrl) {
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', seo.canonicalUrl);
  }
  if (ogImg) {
    setMetaTag('meta[property="og:image"]', 'property', 'og:image', ogImg);
  }

  // Twitter Card
  setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', seo.twitterTitle || ogTitle);
  setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', seo.twitterDescription || ogDesc);
  if (seo.twitterImage || ogImg) {
    setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', seo.twitterImage || ogImg || '');
  }

  // Structured Data Schema injection
  let schemaEl = document.getElementById('theunbound-seo-schema');
  if (structuredDataJson && seo.schemaEnabled) {
    if (!schemaEl) {
      schemaEl = document.createElement('script');
      schemaEl.id = 'theunbound-seo-schema';
      schemaEl.setAttribute('type', 'application/ld+json');
      document.head.appendChild(schemaEl);
    }
    schemaEl.textContent = JSON.stringify(structuredDataJson);
  } else if (schemaEl) {
    schemaEl.remove();
  }

  // Breadcrumbs Schema injection
  let breadcrumbsEl = document.getElementById('theunbound-breadcrumbs-schema');
  if (breadcrumbs && breadcrumbs.length > 0) {
    const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbs);
    if (!breadcrumbsEl) {
      breadcrumbsEl = document.createElement('script');
      breadcrumbsEl.id = 'theunbound-breadcrumbs-schema';
      breadcrumbsEl.setAttribute('type', 'application/ld+json');
      document.head.appendChild(breadcrumbsEl);
    }
    breadcrumbsEl.textContent = JSON.stringify(breadcrumbSchema);
  } else if (breadcrumbsEl) {
    breadcrumbsEl.remove();
  }
}

export function generateSitemapXml(
  auditItems: SEOAuditItem[],
  globalDefaults: GlobalSEODefaults = DEFAULT_GLOBAL_SEO_DEFAULTS
): string {
  const domain = globalDefaults.canonicalDomain.replace(/\/+$/, '');
  const today = new Date().toISOString().split('T')[0];

  const indexable = auditItems.filter(
    (item) => item.published && item.seo.robots?.index !== false
  );

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  // Always include homepage
  xml += `  <url>\n`;
  xml += `    <loc>${domain}/</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>1.0</priority>\n`;
  xml += `  </url>\n`;

  for (const item of indexable) {
    if (item.entityType === 'HOMEPAGE') continue;

    let priority = '0.7';
    let changefreq = 'weekly';

    if (item.entityType === 'DESTINATION') {
      priority = '0.9';
      changefreq = 'daily';
    } else if (item.entityType === 'PRODUCT' || item.entityType === 'PACKAGE') {
      priority = '0.8';
      changefreq = 'weekly';
    } else if (item.entityType === 'BLOG') {
      priority = '0.7';
      changefreq = 'monthly';
    } else if (item.entityType === 'LEGAL') {
      priority = '0.3';
      changefreq = 'yearly';
    }

    const loc = item.seo.canonicalUrl.startsWith('http')
      ? item.seo.canonicalUrl
      : buildFullUrl(item.seo.canonicalUrl, domain);

    const lastmod = item.lastUpdated
      ? item.lastUpdated.split('T')[0]
      : today;

    xml += `  <url>\n`;
    xml += `    <loc>${loc}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += `    <changefreq>${changefreq}</changefreq>\n`;
    xml += `    <priority>${priority}</priority>\n`;

    if (item.seo.ogImage) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${item.seo.ogImage}</image:loc>\n`;
      if (item.seo.imageAltText || item.name) {
        xml += `      <image:title><![CDATA[${item.seo.imageAltText || item.name}]]></image:title>\n`;
      }
      xml += `    </image:image>\n`;
    }

    xml += `  </url>\n`;
  }

  xml += `</urlset>`;
  return xml;
}

export function generateRobotsTxt(
  globalDefaults: GlobalSEODefaults = DEFAULT_GLOBAL_SEO_DEFAULTS,
  redirects: SEORedirect[] = []
): string {
  if (globalDefaults.robotsTxtCustomDirectives?.trim()) {
    return globalDefaults.robotsTxtCustomDirectives.trim();
  }

  return `User-agent: *
Disallow: /admin
Disallow: /admin/*
Disallow: /cms
Disallow: /cms/*
Disallow: /b2b/*
Disallow: /account
Disallow: /account/*
Disallow: /dashboard
Disallow: /dashboard/*
Disallow: /cart
Disallow: /booking/*
Allow: /
Allow: /destinations
Allow: /destinations/*
Allow: /destination/*
Allow: /products/*
Allow: /product/*
Allow: /packages/*
Allow: /package/*
Allow: /hotels/*
Allow: /hotel/*
Allow: /blogs
Allow: /blogs/*
Allow: /visas
Allow: /visas/*
Allow: /pages/*
Allow: /page/*
Allow: /about
Allow: /contact
Allow: /terms
Allow: /privacy
Allow: /refund

Sitemap: ${globalDefaults.canonicalDomain.replace(/\/+$/, '')}/sitemap.xml`;
}
