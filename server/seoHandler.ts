import { Request, Response } from 'express';
import { DESTINATIONS } from '../src/data/destinations';
import { INITIAL_PRODUCTS } from '../src/data/initialProducts';
import { INITIAL_MASTER_REGIONS } from '../src/data/initialRegions';
import { INITIAL_HOTELS } from '../src/data/initialHotels';
import { INITIAL_BLOGS } from '../src/data/initialBlogs';
import { INITIAL_VISAS } from '../src/data/initialVisas';
import { INITIAL_B2B_PACKAGES } from '../src/data/initialPackages';
import { INITIAL_CITY_HUBS } from '../src/data/initialCityHubs';
import {
  DEFAULT_GLOBAL_SEO_DEFAULTS,
  buildFallbackSEO,
  generateStructuredData,
  generateSitemapXml,
  generateRobotsTxt,
  auditEntitySEO,
  sanitizeSlug
} from '../src/services/seoEngine';
import { EntitySEO, SEOEntityType, SEOAuditItem } from '../src/types/seo';

export function getAllAuditItemsForServer(): SEOAuditItem[] {
  const items: SEOAuditItem[] = [];

  // 1. Homepage
  const home = {
    id: 'home',
    name: 'TheUnbound Official Homepage',
    slug: '',
    description: DEFAULT_GLOBAL_SEO_DEFAULTS.defaultMetaDescription
  };
  items.push(auditEntitySEO('HOMEPAGE', home, undefined, DEFAULT_GLOBAL_SEO_DEFAULTS));

  // 2. Destinations
  for (const d of DESTINATIONS) {
    items.push(auditEntitySEO('DESTINATION', d, d.seo, DEFAULT_GLOBAL_SEO_DEFAULTS));
  }

  // 3. Regions
  for (const r of INITIAL_MASTER_REGIONS) {
    items.push(auditEntitySEO('REGION', r, r.seo, DEFAULT_GLOBAL_SEO_DEFAULTS));
  }

  // 4. City Hubs
  for (const c of INITIAL_CITY_HUBS) {
    items.push(auditEntitySEO('CITY_HUB', c, c.seo, DEFAULT_GLOBAL_SEO_DEFAULTS));
  }

  // 5. Products
  for (const p of INITIAL_PRODUCTS) {
    items.push(auditEntitySEO('PRODUCT', p, p.seo, DEFAULT_GLOBAL_SEO_DEFAULTS));
  }

  // 6. Hotels
  for (const h of INITIAL_HOTELS) {
    items.push(auditEntitySEO('HOTEL', h, h.seo, DEFAULT_GLOBAL_SEO_DEFAULTS));
  }

  // 7. Packages
  for (const pkg of INITIAL_B2B_PACKAGES) {
    items.push(auditEntitySEO('PACKAGE', pkg, (pkg as any).seo, DEFAULT_GLOBAL_SEO_DEFAULTS));
  }

  // 8. Blogs
  for (const b of INITIAL_BLOGS) {
    items.push(auditEntitySEO('BLOG', b, b.seo, DEFAULT_GLOBAL_SEO_DEFAULTS));
  }

  // 9. Visas
  for (const v of INITIAL_VISAS) {
    items.push(auditEntitySEO('VISA', v, v.seo, DEFAULT_GLOBAL_SEO_DEFAULTS));
  }

  // 10. Institutional Pages
  const institutionalPages = [
    {
      id: 'about',
      name: 'About TheUnbound DMC',
      slug: 'about',
      description: 'About TheUnbound luxury Destination Management Company, operations network, and leadership.'
    },
    {
      id: 'contact',
      name: 'Contact TheUnbound Operations',
      slug: 'contact',
      description: 'Contact TheUnbound global operations, itinerary architects, and concierge team.'
    },
    {
      id: 'terms',
      name: 'Terms & Conditions of Ground Service',
      slug: 'terms',
      description: 'Terms of ground handling and booking conditions with TheUnbound.'
    },
    {
      id: 'privacy',
      name: 'Privacy & Data Protection Policy',
      slug: 'privacy',
      description: 'TheUnbound privacy and traveler data protection standards.'
    },
    {
      id: 'refund',
      name: 'Cancellation & Refund Policy',
      slug: 'refund',
      description: 'Official cancellation timelines and refund terms for all travel arrangements.'
    }
  ];

  for (const lp of institutionalPages) {
    items.push(auditEntitySEO('LEGAL', lp, undefined, DEFAULT_GLOBAL_SEO_DEFAULTS));
  }

  return items;
}

export function handleSitemapXml(req: Request, res: Response) {
  try {
    const host = req.get('host') || 'theunbound.luxury';
    const canonicalDomain = `${req.protocol}://${host}`;
    const dynamicDefaults = {
      ...DEFAULT_GLOBAL_SEO_DEFAULTS,
      canonicalDomain
    };

    const auditItems = getAllAuditItemsForServer();
    const xml = generateSitemapXml(auditItems, dynamicDefaults);

    res.header('Content-Type', 'application/xml; charset=utf-8');
    res.header('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap.xml:', error);
    res.status(500).send('<!-- Error generating sitemap -->');
  }
}

export function handleRobotsTxt(req: Request, res: Response) {
  try {
    const host = req.get('host') || 'theunbound.luxury';
    const canonicalDomain = `${req.protocol}://${host}`;
    const dynamicDefaults = {
      ...DEFAULT_GLOBAL_SEO_DEFAULTS,
      canonicalDomain
    };

    const robots = generateRobotsTxt(dynamicDefaults);

    res.header('Content-Type', 'text/plain; charset=utf-8');
    res.header('Cache-Control', 'public, max-age=86400');
    res.send(robots);
  } catch (error) {
    console.error('Error generating robots.txt:', error);
    res.status(500).send('User-agent: *\nAllow: /\n');
  }
}

/**
 * Resolves the SEO metadata for a requested URL path
 */
export function resolveSEOFoPath(urlPath: string, host: string): { seo: EntitySEO; structuredData: string } {
  const normalizedPath = urlPath.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
  const canonicalDomain = `https://${host}`;
  const dynamicDefaults = {
    ...DEFAULT_GLOBAL_SEO_DEFAULTS,
    canonicalDomain
  };
  const segments = normalizedPath.split('/').filter(Boolean);

  let targetType: SEOEntityType = 'HOMEPAGE';
  let targetEntity: any = {
    id: 'home',
    name: 'TheUnbound Official Homepage',
    slug: '',
    description: dynamicDefaults.defaultMetaDescription
  };
  let entitySEO: EntitySEO | undefined = undefined;

  if (segments.length === 0) {
    // Homepage
    targetType = 'HOMEPAGE';
  } else {
    const [section, slug] = segments;

    if (section === 'destinations') {
      if (slug) {
        const foundDest = DESTINATIONS.find(d => d.slug.toLowerCase() === slug.toLowerCase());
        if (foundDest) {
          targetType = 'DESTINATION';
          targetEntity = foundDest;
          entitySEO = foundDest.seo;
        } else {
          const foundRegion = INITIAL_MASTER_REGIONS.find(r => r.slug.toLowerCase() === slug.toLowerCase());
          if (foundRegion) {
            targetType = 'REGION';
            targetEntity = foundRegion;
            entitySEO = foundRegion.seo;
          }
        }
      } else {
        targetType = 'DESTINATION';
        targetEntity = {
          id: 'destinations-index',
          name: 'Explore Global Destinations',
          slug: 'destinations',
          description: 'Browse luxury travel destinations in Europe, UK, Japan, and Southeast Asia curated by TheUnbound.'
        };
      }
    } else if (section === 'products' || section === 'experiences' || section === 'activities') {
      if (slug) {
        const found = INITIAL_PRODUCTS.find(p => (p.slug && p.slug.toLowerCase() === slug.toLowerCase()) || p.id === slug);
        if (found) {
          targetType = 'PRODUCT';
          targetEntity = found;
          entitySEO = found.seo;
        }
      }
    } else if (section === 'hotels') {
      if (slug) {
        const found = INITIAL_HOTELS.find(h => ((h as any).slug && (h as any).slug.toLowerCase() === slug.toLowerCase()) || h.id === slug);
        if (found) {
          targetType = 'HOTEL';
          targetEntity = found;
          entitySEO = found.seo;
        }
      }
    } else if (section === 'packages' || section === 'itineraries') {
      if (slug) {
        const found = INITIAL_B2B_PACKAGES.find(pkg => ((pkg as any).slug && (pkg as any).slug.toLowerCase() === slug.toLowerCase()) || pkg.id === slug);
        if (found) {
          targetType = 'PACKAGE';
          targetEntity = found;
          entitySEO = (found as any).seo;
        }
      }
    } else if (section === 'blogs' || section === 'journal') {
      if (slug) {
        const found = INITIAL_BLOGS.find(b => b.slug.toLowerCase() === slug.toLowerCase());
        if (found) {
          targetType = 'BLOG';
          targetEntity = found;
          entitySEO = found.seo;
        }
      }
    } else if (section === 'visas') {
      if (slug) {
        const found = INITIAL_VISAS.find(v => sanitizeSlug(v.country) === slug.toLowerCase() || v.id === slug);
        if (found) {
          targetType = 'VISA';
          targetEntity = found;
          entitySEO = found.seo;
        }
      }
    } else if (section === 'about' || section === 'contact' || section === 'terms' || section === 'privacy' || section === 'refund') {
      targetType = 'LEGAL';
      targetEntity = {
        id: section,
        name: section.charAt(0).toUpperCase() + section.slice(1),
        slug: section,
        description: `Official ${section} page for TheUnbound Destination Management Company.`
      };
    }
  }

  const resolvedSEO = entitySEO && entitySEO.title ? entitySEO : buildFallbackSEO(targetType, targetEntity, dynamicDefaults);
  const jsonLd = generateStructuredData(targetType, targetEntity, resolvedSEO, dynamicDefaults);

  return {
    seo: resolvedSEO,
    structuredData: JSON.stringify(jsonLd)
  };
}

/**
 * Injects SEO tags, Open Graph, Twitter Cards, Canonical URL, and JSON-LD structured data into raw HTML
 */
export function injectSEOIntoHtml(html: string, urlPath: string, host: string): string {
  try {
    const { seo, structuredData } = resolveSEOFoPath(urlPath, host);
    const canonical = seo.canonicalUrl || `https://${host}${urlPath.split('?')[0]}`;
    const robots = `${seo.robots?.index !== false ? 'index' : 'noindex'}, ${seo.robots?.follow !== false ? 'follow' : 'nofollow'}`;
    const allKeywords = [seo.focusKeyword, ...(seo.secondaryKeywords || [])].filter(Boolean) as string[];

    const tagsToInject = `
    <!-- SEO Management Engine Injected Meta -->
    <title>${seo.title}</title>
    <meta name="description" content="${(seo.metaDescription || '').replace(/"/g, '&quot;')}" />
    ${allKeywords.length ? `<meta name="keywords" content="${allKeywords.join(', ').replace(/"/g, '&quot;')}" />` : ''}
    <link rel="canonical" href="${canonical}" />
    <meta name="robots" content="${robots}" />
    
    <!-- Open Graph (Facebook / WhatsApp / LinkedIn) -->
    <meta property="og:title" content="${(seo.ogTitle || seo.title).replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${(seo.ogDescription || seo.metaDescription || '').replace(/"/g, '&quot;')}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:type" content="website" />
    ${seo.ogImage ? `<meta property="og:image" content="${seo.ogImage}" />` : ''}
    <meta property="og:site_name" content="${DEFAULT_GLOBAL_SEO_DEFAULTS.siteName}" />

    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${(seo.twitterTitle || seo.ogTitle || seo.title).replace(/"/g, '&quot;')}" />
    <meta name="twitter:description" content="${(seo.twitterDescription || seo.ogDescription || seo.metaDescription || '').replace(/"/g, '&quot;')}" />
    ${(seo.twitterImage || seo.ogImage) ? `<meta name="twitter:image" content="${seo.twitterImage || seo.ogImage}" />` : ''}
    ${DEFAULT_GLOBAL_SEO_DEFAULTS.socialProfiles.twitter ? `<meta name="twitter:site" content="${DEFAULT_GLOBAL_SEO_DEFAULTS.socialProfiles.twitter}" />` : ''}

    <!-- Structured Data (JSON-LD) -->
    <script type="application/ld+json" id="server-seo-jsonld">
    ${structuredData}
    </script>
`;

    // Replace existing <title> and inject before </head>
    let output = html.replace(/<title>.*?<\/title>/i, '');
    output = output.replace(/<meta name="description".*?>/i, '');
    output = output.replace(/<meta property="og:title".*?>/i, '');
    output = output.replace(/<meta property="og:description".*?>/i, '');
    output = output.replace(/<\/head>/i, `${tagsToInject}\n  </head>`);

    return output;
  } catch (err) {
    console.error('Error injecting SEO into HTML:', err);
    return html;
  }
}

