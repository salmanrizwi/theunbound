/**
 * Image Utilities for TheUnbound DMC Platform
 * Handles URL sanitization, Unsplash webpage-to-CDN URL conversion,
 * direct photo uploads (file to data URL), and topic-based Unsplash photo fetching.
 */

export const DEFAULT_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1200&auto=format&fit=crop';

export const DESTINATION_FALLBACKS: Record<string, string> = {
  japan: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
  tokyo: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop',
  kyoto: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
  osaka: 'https://images.unsplash.com/photo-1590559899731-a3f376ec4e22?q=80&w=1200&auto=format&fit=crop',
  fuji: 'https://images.unsplash.com/photo-1578637387939-43c525550085?q=80&w=1200&auto=format&fit=crop',
  uk: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop',
  europe: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=1200&auto=format&fit=crop',
  thailand: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?q=80&w=1200&auto=format&fit=crop',
  dubai: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1200&auto=format&fit=crop',
  usa: 'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?q=80&w=1200&auto=format&fit=crop',
  australia: 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?q=80&w=1200&auto=format&fit=crop'
};

/**
 * Curated Unsplash photo database for instant fetching across topics & categories
 */
export const CURATED_UNSPLASH_LIBRARY: Record<string, { title: string; url: string; category: string }[]> = {
  customers: [
    {
      title: 'Happy Couple at Kyoto Fushimi Inari Shrine',
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1200&auto=format&fit=crop',
      category: 'Happy Customers'
    },
    {
      title: 'Travelers admiring Tokyo Skyline from Shibuya Sky',
      url: 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?q=80&w=1200&auto=format&fit=crop',
      category: 'Happy Customers'
    },
    {
      title: 'VIP Guests experiencing Traditional Tea Ceremony',
      url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=1200&auto=format&fit=crop',
      category: 'Happy Customers'
    },
    {
      title: 'Family in Kimonos strolling through Gion Kyoto',
      url: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?q=80&w=1200&auto=format&fit=crop',
      category: 'Happy Customers'
    },
    {
      title: 'Travelers enjoying Hakone Hot Springs & Mt Fuji view',
      url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop',
      category: 'Happy Customers'
    },
    {
      title: 'Delighted guests on Private Bullet Train Transfer',
      url: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=1200&auto=format&fit=crop',
      category: 'Happy Customers'
    }
  ],
  hotels: [
    {
      title: 'Luxury 5-Star Hotel Grand Lobby & Lounge',
      url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?q=80&w=1200&auto=format&fit=crop',
      category: 'Hotels'
    },
    {
      title: 'Presidential Suite with City Skyline View',
      url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1200&auto=format&fit=crop',
      category: 'Hotels'
    },
    {
      title: 'Traditional Ryokan with Private Onsen Bath',
      url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop',
      category: 'Hotels'
    },
    {
      title: 'Deluxe King Bedroom with Panoramic Windows',
      url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1200&auto=format&fit=crop',
      category: 'Hotels'
    },
    {
      title: 'Luxury Hotel Infinity Pool overlooking Mt Fuji',
      url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?q=80&w=1200&auto=format&fit=crop',
      category: 'Hotels'
    },
    {
      title: 'Executive Twin Room with Tatami Accents',
      url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=1200&auto=format&fit=crop',
      category: 'Hotels'
    },
    {
      title: 'Boutique Hotel Garden Villa',
      url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=1200&auto=format&fit=crop',
      category: 'Hotels'
    }
  ],
  products: [
    {
      title: 'Tokyo Neon & Shinjuku Night Walking Tour',
      url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop',
      category: 'Tours & Experiences'
    },
    {
      title: 'Kyoto Golden Pavilion & Bamboo Forest Day Tour',
      url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop',
      category: 'Tours & Experiences'
    },
    {
      title: 'Private Chauffeur Mercedes Sprinter Transfer',
      url: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=1200&auto=format&fit=crop',
      category: 'Tours & Experiences'
    },
    {
      title: 'Mt Fuji 5th Station & Lake Kawaguchiko Cruise',
      url: 'https://images.unsplash.com/photo-1578637387939-43c525550085?q=80&w=1200&auto=format&fit=crop',
      category: 'Tours & Experiences'
    },
    {
      title: 'Osaka Dotonbori Street Food Gastronomy Safari',
      url: 'https://images.unsplash.com/photo-1590559899731-a3f376ec4e22?q=80&w=1200&auto=format&fit=crop',
      category: 'Tours & Experiences'
    },
    {
      title: 'Hiroshima Peace Memorial & Miyajima Floating Torii',
      url: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?q=80&w=1200&auto=format&fit=crop',
      category: 'Tours & Experiences'
    },
    {
      title: 'London Historic Westminster & Tower Bridge Tour',
      url: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop',
      category: 'Tours & Experiences'
    }
  ]
};

/**
 * Converts any Unsplash webpage URL (e.g. unsplash.com/photos/...) or dirty link
 * into a directly renderable, high-res images.unsplash.com CDN URL.
 */
export function convertUnsplashUrl(inputUrl: string): string {
  if (!inputUrl || typeof inputUrl !== 'string') return '';
  const trimmed = inputUrl.trim();

  // If already a base64 data URL, return as is
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  // Handle Unsplash webpage URLs:
  // e.g. https://unsplash.com/photos/a-mountain-lake-1503899036084-c55cdd92da26
  // e.g. https://unsplash.com/photos/8yTsdY9sK4E
  // e.g. https://unsplash.com/de/fotos/tokyo-tower-xyz
  if (trimmed.includes('unsplash.com/photos/') || trimmed.includes('unsplash.com/fotos/')) {
    try {
      const urlObj = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const segments = urlObj.pathname.split('/').filter(Boolean);
      // Photo ID is usually the last segment or after the last dash
      const lastSegment = segments[segments.length - 1];
      if (lastSegment) {
        // If slug like "a-snow-covered-mountain-abc123xyz"
        const parts = lastSegment.split('-');
        const photoId = parts[parts.length - 1] || lastSegment;
        
        // If it starts with numeric photo format like photo-1503899...
        if (photoId.startsWith('1') || lastSegment.includes('photo-')) {
          return `https://images.unsplash.com/photo-${photoId.replace('photo-', '')}?auto=format&fit=crop&q=80&w=1200`;
        }
        
        // For standard alphanumeric Unsplash ID (e.g. 8yTsdY9sK4E or similar):
        // Return high-res direct Unsplash CDN resolver
        return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&q=80&w=1200`;
      }
    } catch {
      // Ignore parse error and proceed
    }
  }

  // If already images.unsplash.com, ensure proper query params
  if (trimmed.includes('images.unsplash.com')) {
    if (!trimmed.includes('auto=format')) {
      const separator = trimmed.includes('?') ? '&' : '?';
      return `${trimmed}${separator}auto=format&fit=crop&q=80&w=1200`;
    }
    return trimmed;
  }

  return trimmed;
}

/**
 * Sanitizes and cleans an image URL.
 * Fixes broken query parameters, Unsplash missing dimensions, and data URLs.
 */
export function sanitizeImageUrl(url?: string | null, fallbackKey?: string): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    if (fallbackKey && DESTINATION_FALLBACKS[fallbackKey.toLowerCase()]) {
      return DESTINATION_FALLBACKS[fallbackKey.toLowerCase()];
    }
    return DEFAULT_FALLBACK_IMAGE;
  }

  const clean = convertUnsplashUrl(url);
  return clean || DEFAULT_FALLBACK_IMAGE;
}

/**
 * Converts a File object to base64 Data URL for instant preview and database storage.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Fetches matching Unsplash images for a query or topic.
 */
export function fetchUnsplashImagesByQuery(query: string, category: string = 'all'): { title: string; url: string; category: string }[] {
  const cleanQ = (query || '').toLowerCase().trim();
  let pool: { title: string; url: string; category: string }[] = [];

  if (category === 'customers') {
    pool = CURATED_UNSPLASH_LIBRARY.customers;
  } else if (category === 'hotels') {
    pool = CURATED_UNSPLASH_LIBRARY.hotels;
  } else if (category === 'products') {
    pool = CURATED_UNSPLASH_LIBRARY.products;
  } else {
    pool = [...CURATED_UNSPLASH_LIBRARY.customers, ...CURATED_UNSPLASH_LIBRARY.hotels, ...CURATED_UNSPLASH_LIBRARY.products];
  }

  if (!cleanQ) {
    return pool;
  }

  const matches = pool.filter(p => 
    p.title.toLowerCase().includes(cleanQ) || 
    p.category.toLowerCase().includes(cleanQ) ||
    cleanQ.split(' ').some(word => p.title.toLowerCase().includes(word))
  );

  return matches.length > 0 ? matches : pool;
}
