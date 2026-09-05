export type StructuredDataType =
  | 'Organization'
  | 'WebSite'
  | 'WebPage'
  | 'TouristDestination'
  | 'TouristAttraction'
  | 'Product'
  | 'Offer'
  | 'Hotel'
  | 'LodgingBusiness'
  | 'TouristTrip'
  | 'Trip'
  | 'Article'
  | 'BlogPosting'
  | 'FAQPage'
  | 'BreadcrumbList'
  | 'LocalBusiness'
  | 'Custom';

export interface RobotsDirectives {
  index: boolean;
  follow: boolean;
  noarchive?: boolean;
  nosnippet?: boolean;
}

export interface EntitySEO {
  title: string;
  metaDescription: string;
  slug: string;
  canonicalUrl?: string;
  robots: RobotsDirectives;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  focusKeyword?: string;
  secondaryKeywords?: string[];
  imageAltText?: string;
  schemaType?: StructuredDataType | string;
  schemaEnabled: boolean;
  customSchema?: string;
  breadcrumbTitle?: string;
  seoIntro?: string;
  lastUpdated?: string;
  updatedBy?: string;
  isDraft?: boolean;
}

export type SEOHealthStatus = 'COMPLETE' | 'WARNING' | 'ERROR' | 'NOINDEX';

export interface SEORedirect {
  id: string;
  sourceUrl: string;
  destinationUrl: string;
  statusCode: 301 | 302;
  createdAt: string;
  createdBy: string;
  hits: number;
  active: boolean;
  entityType?: string;
  entityId?: string;
  notes?: string;
}

export interface SEOTemplate {
  titleTemplate: string;
  descTemplate: string;
}

export interface GlobalSEODefaults {
  titleSuffix: string;
  defaultMetaDescription: string;
  defaultOgImage: string;
  defaultTwitterImage: string;
  defaultRobots: RobotsDirectives;
  canonicalDomain: string;
  organizationName: string;
  organizationLogo: string;
  siteName: string;
  defaultSchemaType: string;
  contactEmail: string;
  contactPhone: string;
  socialProfiles: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  templates: {
    destination: SEOTemplate;
    cityHub: SEOTemplate;
    product: SEOTemplate;
    hotel: SEOTemplate;
    package: SEOTemplate;
    activity: SEOTemplate;
    blog: SEOTemplate;
    visa: SEOTemplate;
    customPage: SEOTemplate;
  };
  robotsTxtCustomDirectives?: string;
}

export type SEOEntityType =
  | 'HOMEPAGE'
  | 'DESTINATION'
  | 'REGION'
  | 'CITY_HUB'
  | 'PRODUCT'
  | 'HOTEL'
  | 'PACKAGE'
  | 'VISA'
  | 'BLOG'
  | 'CUSTOM_PAGE'
  | 'LEGAL'
  | 'LANDING_PAGE';

export interface SEOAuditItem {
  id: string;
  entityId: string;
  entityType: SEOEntityType;
  name: string;
  url: string;
  seo: EntitySEO;
  health: SEOHealthStatus;
  issues: string[];
  warnings: string[];
  score: number;
  lastUpdated?: string;
  published: boolean;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
  position: number;
}
