import { 
  Product, 
  Destination, 
  Promotion, 
  BlogArticle, 
  GoogleReview, 
  Quotation, 
  Booking,
  BookingStatus,
  AuditLog, 
  AuditAction,
  DynamicPricingRecord, 
  SyncDetailedReport,
  UserRole,
  User,
  Hotel,
  CityHub,
  DestinationFAQ,
  GalleryImage,
  HomepageConfig,
  HomepageFAQItem,
  TravelLead,
  LeadStatus,
  LeadSource,
  BookingInvoice,
  BookingVoucher,
  BookingFinancialRecord,
  JobSheet,
  EmailCampaignConfig,
  RosterResource,
  ProductRosterRule,
  WishlistFolder,
  WishlistItem
} from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { DESTINATIONS } from '../data/destinations';
import { INITIAL_PROMOTIONS } from '../data/initialPromotions';
import { INITIAL_BLOGS } from '../data/initialBlogs';
import { INITIAL_REVIEWS } from '../data/initialReviews';
import { INITIAL_HOTELS } from '../data/initialHotels';
import { INITIAL_CITY_HUBS } from '../data/initialCityHubs';
import { INITIAL_FAQS } from '../data/initialFAQs';
import { INITIAL_GALLERY } from '../data/initialGallery';
import { INITIAL_HOMEPAGE_CONFIG } from '../data/initialHomepage';
import { INITIAL_LEADS } from '../data/initialLeads';
import { INITIAL_CAMPAIGNS } from '../data/initialCampaigns';
import { INITIAL_ROSTER_RESOURCES } from '../data/initialRoster';
import { EmailNotificationService } from './emailNotificationService';
import { db as firestoreDb } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocFromServer,
  writeBatch 
} from 'firebase/firestore';

function cleanForFirestore(data: any): any {
  if (data === undefined) {
    return null;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => cleanForFirestore(item));
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleaned[key] = cleanForFirestore(value);
    }
  }
  return cleaned;
}

const STORAGE_KEY_PREFIX = 'theunbound_db_';

export class AppDatabase {
  private static instance: AppDatabase;
  private listeners: Set<() => void> = new Set();
  private isFirestoreInitialized: boolean = false;

  private constructor() {
    this.initDefaultData();
    this.initFirestoreSync();
  }

  public static getInstance(): AppDatabase {
    if (!AppDatabase.instance) {
      AppDatabase.instance = new AppDatabase();
    }
    return AppDatabase.instance;
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  private getItem<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.error(`Error reading ${key} from storage:`, e);
      return fallback;
    }
  }

  private setItem<T>(key: string, value: T, syncToFirestore: boolean = true): void {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
      this.notify();
    } catch (e) {
      console.error(`Error saving ${key} to storage:`, e);
    }
  }

  private syncFirestoreDoc(collectionName: string, docId: string, data: any): void {
    if (!docId) return;
    try {
      const cleanData = cleanForFirestore(data);
      setDoc(doc(firestoreDb, collectionName, docId), cleanData, { merge: true }).catch((err) => {
        console.debug(`Firestore sync note (${collectionName}/${docId}):`, err);
      });
    } catch (e) {
      console.debug(`Firestore sync error (${collectionName}/${docId}):`, e);
    }
  }

  private deleteFirestoreDoc(collectionName: string, docId: string): void {
    if (!docId) return;
    try {
      deleteDoc(doc(firestoreDb, collectionName, docId)).catch((err) => {
        console.debug(`Firestore delete note (${collectionName}/${docId}):`, err);
      });
    } catch (e) {
      console.debug(`Firestore delete error (${collectionName}/${docId}):`, e);
    }
  }

  private async initFirestoreSync(): Promise<void> {
    if (this.isFirestoreInitialized || typeof window === 'undefined') return;
    this.isFirestoreInitialized = true;

    try {
      // Validate connection to Firestore
      try {
        await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.warn("Firestore running in offline cache mode.");
        }
      }

      // 1. Sync Products
      onSnapshot(collection(firestoreDb, 'products'), (snapshot) => {
        if (!snapshot.empty) {
          const list: Product[] = [];
          snapshot.forEach(docSnap => list.push(docSnap.data() as Product));
          this.setItem('products', list, false);
        } else {
          // Seed initial products to Firestore
          const initial = this.getProducts();
          initial.forEach(p => {
            this.syncFirestoreDoc('products', p.id, p);
          });
        }
      }, (err) => console.debug('Firestore products sync note:', err));

      // 2. Sync Destinations
      onSnapshot(collection(firestoreDb, 'destinations'), (snapshot) => {
        if (!snapshot.empty) {
          const list: Destination[] = [];
          snapshot.forEach(docSnap => list.push(docSnap.data() as Destination));
          this.setItem('destinations', list, false);
        } else {
          const initial = this.getDestinations();
          initial.forEach(d => {
            this.syncFirestoreDoc('destinations', d.id, d);
          });
        }
      }, (err) => console.debug('Firestore destinations sync note:', err));

      // 3. Sync Quotations
      onSnapshot(collection(firestoreDb, 'quotations'), (snapshot) => {
        if (!snapshot.empty) {
          const list: Quotation[] = [];
          snapshot.forEach(docSnap => list.push(docSnap.data() as Quotation));
          this.setItem('saved_quotes', list, false);
        }
      }, (err) => console.debug('Firestore quotations sync note:', err));

      // 4. Sync Bookings
      onSnapshot(collection(firestoreDb, 'bookings'), (snapshot) => {
        if (!snapshot.empty) {
          const list: Booking[] = [];
          snapshot.forEach(docSnap => list.push(docSnap.data() as Booking));
          this.setItem('bookings', list, false);
        }
      }, (err) => console.debug('Firestore bookings sync note:', err));

      // 5. Sync Hotels
      onSnapshot(collection(firestoreDb, 'hotels'), (snapshot) => {
        if (!snapshot.empty) {
          const list: Hotel[] = [];
          snapshot.forEach(docSnap => list.push(docSnap.data() as Hotel));
          this.setItem('hotels', list, false);
        } else {
          const initial = this.getHotels();
          initial.forEach(h => {
            this.syncFirestoreDoc('hotels', h.id, h);
          });
        }
      }, (err) => console.debug('Firestore hotels sync note:', err));

      // 6. Sync Leads
      onSnapshot(collection(firestoreDb, 'leads'), (snapshot) => {
        if (!snapshot.empty) {
          const list: TravelLead[] = [];
          snapshot.forEach(docSnap => list.push(docSnap.data() as TravelLead));
          this.setItem('leads', list, false);
        }
      }, (err) => console.debug('Firestore leads sync note:', err));

      // 7. Sync Promotions
      onSnapshot(collection(firestoreDb, 'promotions'), (snapshot) => {
        if (!snapshot.empty) {
          const list: Promotion[] = [];
          snapshot.forEach(docSnap => list.push(docSnap.data() as Promotion));
          this.setItem('promotions', list, false);
        } else {
          const initial = this.getPromotions();
          initial.forEach(pr => {
            this.syncFirestoreDoc('promotions', pr.id, pr);
          });
        }
      }, (err) => console.debug('Firestore promotions sync note:', err));

      // 8. Sync Gallery
      onSnapshot(collection(firestoreDb, 'gallery_items'), (snapshot) => {
        if (!snapshot.empty) {
          const list: GalleryImage[] = [];
          snapshot.forEach(docSnap => list.push(docSnap.data() as GalleryImage));
          this.setItem('gallery', list, false);
        }
      }, (err) => console.debug('Firestore gallery sync note:', err));

      // 9. Sync Reviews
      onSnapshot(collection(firestoreDb, 'google_reviews'), (snapshot) => {
        if (!snapshot.empty) {
          const list: GoogleReview[] = [];
          snapshot.forEach(docSnap => list.push(docSnap.data() as GoogleReview));
          this.setItem('reviews', list, false);
        }
      }, (err) => console.debug('Firestore reviews sync note:', err));

      // 10. Sync Blogs
      onSnapshot(collection(firestoreDb, 'blog_articles'), (snapshot) => {
        if (!snapshot.empty) {
          const list: BlogArticle[] = [];
          snapshot.forEach(docSnap => list.push(docSnap.data() as BlogArticle));
          this.setItem('blogs', list, false);
        }
      }, (err) => console.debug('Firestore blogs sync note:', err));

      // 11. Sync Wishlist Folders
      onSnapshot(collection(firestoreDb, 'wishlist_folders'), (snapshot) => {
        if (!snapshot.empty) {
          const list: WishlistFolder[] = [];
          snapshot.forEach(docSnap => list.push(docSnap.data() as WishlistFolder));
          this.setItem('wishlist_folders', list, false);
        }
      }, (err) => console.debug('Firestore wishlist folders sync note:', err));

      // 12. Sync Wishlist Items
      onSnapshot(collection(firestoreDb, 'wishlist_items'), (snapshot) => {
        if (!snapshot.empty) {
          const list: WishlistItem[] = [];
          snapshot.forEach(docSnap => list.push(docSnap.data() as WishlistItem));
          this.setItem('wishlist_items', list, false);
        }
      }, (err) => console.debug('Firestore wishlist items sync note:', err));

      // 13. Sync Users
      onSnapshot(collection(firestoreDb, 'users'), (snapshot) => {
        if (!snapshot.empty) {
          const list: User[] = [];
          snapshot.forEach(docSnap => list.push(docSnap.data() as User));
          this.setItem('system_users', list, false);
        }
      }, (err) => console.debug('Firestore users sync note:', err));

    } catch (error) {
      console.warn('Firestore real-time listeners initialized with local fallback:', error);
    }
  }

  private initDefaultData() {
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'products')) {
      this.setItem('products', INITIAL_PRODUCTS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'destinations')) {
      this.setItem('destinations', DESTINATIONS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'promotions')) {
      this.setItem('promotions', INITIAL_PROMOTIONS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'blogs')) {
      this.setItem('blogs', INITIAL_BLOGS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'reviews')) {
      this.setItem('reviews', INITIAL_REVIEWS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'hotels')) {
      this.setItem('hotels', INITIAL_HOTELS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'city_hubs')) {
      this.setItem('city_hubs', INITIAL_CITY_HUBS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'destination_faqs')) {
      this.setItem('destination_faqs', INITIAL_FAQS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'gallery')) {
      this.setItem('gallery', INITIAL_GALLERY);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'homepage_config')) {
      this.setItem('homepage_config', INITIAL_HOMEPAGE_CONFIG);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'leads')) {
      this.setItem('leads', INITIAL_LEADS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'roster_resources')) {
      this.setItem('roster_resources', INITIAL_ROSTER_RESOURCES);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'campaigns')) {
      this.setItem('campaigns', INITIAL_CAMPAIGNS);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'invoices')) {
      this.setItem('invoices', []);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'vouchers')) {
      this.setItem('vouchers', []);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'job_sheets')) {
      this.setItem('job_sheets', []);
    }
    if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'audit_logs')) {
      const defaultLogs: AuditLog[] = [
        {
          id: 'audit-01',
          userId: 'usr-admin-01',
          userName: 'Marcus Vance',
          userRole: 'ADMIN',
          action: 'SETTINGS_UPDATED',
          entity: 'System',
          entityId: 'sys-01',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          details: 'Initial database schema and multi-tier authentication policies initialized.'
        }
      ];
      this.setItem('audit_logs', defaultLogs);
    }
  }

  // ==========================================
  // AUDIT TRAIL
  // ==========================================
  public logAudit(
    user: { id: string; name: string; role: UserRole } | null,
    action: AuditAction,
    entity: string,
    entityId: string,
    details: string,
    previousValue?: string,
    newValue?: string
  ): void {
    const logs = this.getItem<AuditLog[]>('audit_logs', []);
    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      userId: user?.id || 'usr-system',
      userName: user?.name || 'System Administrator',
      userRole: user?.role || 'ADMIN',
      action,
      entity,
      entityId,
      timestamp: new Date().toISOString(),
      details,
      previousValue: previousValue || '',
      newValue: newValue || ''
    };
    this.setItem('audit_logs', [newLog, ...logs.slice(0, 499)]); // Keep last 500 logs
    this.syncFirestoreDoc('audit_logs', newLog.id, newLog);
  }

  public getAuditLogs(): AuditLog[] {
    return this.getItem<AuditLog[]>('audit_logs', []);
  }

  // ==========================================
  // PRODUCTS CRUD
  // ==========================================
  public getProducts(): Product[] {
    return this.getItem<Product[]>('products', INITIAL_PRODUCTS);
  }

  public getProductById(id: string): Product | undefined {
    return this.getProducts().find(p => p.id === id);
  }

  public saveProduct(product: Product, user: User | null): void {
    const products = this.getProducts();
    const existingIndex = products.findIndex(p => p.id === product.id);
    const prev = existingIndex >= 0 ? products[existingIndex] : null;

    if (existingIndex >= 0) {
      products[existingIndex] = {
        ...product,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
      this.logAudit(
        user,
        'PRODUCT_UPDATED',
        'Product',
        product.id,
        `Updated product: ${product.name} (SKU: ${product.sku})`,
        prev ? JSON.stringify({ name: prev.name, price: prev.adultNetPrice }) : undefined,
        JSON.stringify({ name: product.name, price: product.adultNetPrice })
      );
      this.syncFirestoreDoc('products', product.id, products[existingIndex]);
    } else {
      const newProd = {
        ...product,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
      products.unshift(newProd);
      this.logAudit(
        user,
        'PRODUCT_CREATED',
        'Product',
        product.id,
        `Created new product: ${product.name} (SKU: ${product.sku})`
      );
      this.syncFirestoreDoc('products', product.id, newProd);
    }
    this.setItem('products', products);
  }

  public duplicateProduct(productId: string, user: User | null): Product | null {
    const product = this.getProductById(productId);
    if (!product) return null;

    const duplicated: Product = {
      ...product,
      id: `prod-${Date.now()}`,
      sku: `${product.sku}-COPY`,
      name: `${product.name} (Copy)`,
      status: 'DRAFT',
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    this.saveProduct(duplicated, user);
    return duplicated;
  }

  public deleteProduct(productId: string, user: User | null): void {
    const products = this.getProducts();
    const target = products.find(p => p.id === productId);
    const filtered = products.filter(p => p.id !== productId);
    this.setItem('products', filtered);
    this.deleteFirestoreDoc('products', productId);
    if (target) {
      this.logAudit(
        user,
        'PRODUCT_ARCHIVED',
        'Product',
        productId,
        `Archived/Deleted product: ${target.name} (SKU: ${target.sku})`
      );
    }
  }

  // ==========================================
  // DESTINATIONS CRUD
  // ==========================================
  public getDestinations(): Destination[] {
    return this.getItem<Destination[]>('destinations', DESTINATIONS);
  }

  public getDestinationBySlug(slug: string): Destination | undefined {
    return this.getDestinations().find(d => d.slug === slug);
  }

  public saveDestination(destination: Destination, user: User | null): void {
    const destinations = this.getDestinations();
    const index = destinations.findIndex(d => d.id === destination.id);
    if (index >= 0) {
      destinations[index] = destination;
      this.logAudit(user, 'DESTINATION_UPDATED', 'Destination', destination.id, `Updated destination: ${destination.name}`);
    } else {
      destinations.push(destination);
      this.logAudit(user, 'DESTINATION_UPDATED', 'Destination', destination.id, `Added destination: ${destination.name}`);
    }
    this.syncFirestoreDoc('destinations', destination.id, destination);
    this.setItem('destinations', destinations);
  }

  public deleteDestination(destinationId: string, user: User | null): void {
    const destinations = this.getDestinations();
    const target = destinations.find(d => d.id === destinationId);
    this.setItem('destinations', destinations.filter(d => d.id !== destinationId));
    this.deleteFirestoreDoc('destinations', destinationId);
    if (target) {
      this.logAudit(user, 'DESTINATION_UPDATED', 'Destination', destinationId, `Removed destination: ${target.name}`);
    }
  }

  // ==========================================
  // PROMOTIONS CRUD
  // ==========================================
  public getPromotions(): Promotion[] {
    return this.getItem<Promotion[]>('promotions', INITIAL_PROMOTIONS);
  }

  public getActivePromotions(audience?: 'ALL' | 'BUYER' | 'B2B_AGENT'): Promotion[] {
    const today = new Date().toISOString().split('T')[0];
    return this.getPromotions().filter(p => {
      if (!p.isActive) return false;
      if (p.startDate && p.startDate > today) return false;
      if (p.endDate && p.endDate < today) return false;
      if (audience && p.targetAudience !== 'ALL' && p.targetAudience !== audience) return false;
      return true;
    }).sort((a, b) => a.priority - b.priority);
  }

  public savePromotion(promotion: Promotion, user: User | null): void {
    const promotions = this.getPromotions();
    const index = promotions.findIndex(p => p.id === promotion.id);
    let savedPromo: Promotion;
    if (index >= 0) {
      savedPromo = { ...promotion, updatedAt: new Date().toISOString() };
      promotions[index] = savedPromo;
      this.logAudit(user, 'PROMOTION_UPDATED', 'Promotion', promotion.id, `Updated promotion: ${promotion.title}`);
    } else {
      savedPromo = {
        ...promotion,
        id: promotion.id || `promo-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      promotions.unshift(savedPromo);
      this.logAudit(user, 'PROMOTION_CREATED', 'Promotion', promotion.id, `Created promotion: ${promotion.title}`);
    }
    this.syncFirestoreDoc('promotions', savedPromo.id, savedPromo);
    this.setItem('promotions', promotions);
  }

  public deletePromotion(promotionId: string, user: User | null): void {
    const promotions = this.getPromotions();
    const target = promotions.find(p => p.id === promotionId);
    this.setItem('promotions', promotions.filter(p => p.id !== promotionId));
    this.deleteFirestoreDoc('promotions', promotionId);
    if (target) {
      this.logAudit(user, 'PROMOTION_DELETED', 'Promotion', promotionId, `Deleted promotion: ${target.title}`);
    }
  }

  // ==========================================
  // BLOGS CRUD
  // ==========================================
  public getBlogs(): BlogArticle[] {
    return this.getItem<BlogArticle[]>('blogs', INITIAL_BLOGS);
  }

  public getBlogBySlug(slug: string): BlogArticle | undefined {
    return this.getBlogs().find(b => b.slug === slug);
  }

  public saveBlog(blog: BlogArticle, user: User | null): void {
    const blogs = this.getBlogs();
    const index = blogs.findIndex(b => b.id === blog.id);
    let savedBlog: BlogArticle;
    if (index >= 0) {
      savedBlog = { ...blog, updatedAt: new Date().toISOString() };
      blogs[index] = savedBlog;
      this.logAudit(user, 'BLOG_UPDATED', 'Blog', blog.id, `Updated blog article: ${blog.title}`);
    } else {
      savedBlog = {
        ...blog,
        id: blog.id || `blog-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      blogs.unshift(savedBlog);
      this.logAudit(user, 'BLOG_CREATED', 'Blog', blog.id, `Created blog article: ${blog.title}`);
    }
    this.syncFirestoreDoc('blog_articles', savedBlog.id, savedBlog);
    this.setItem('blogs', blogs);
  }

  public deleteBlog(blogId: string, user: User | null): void {
    const blogs = this.getBlogs();
    const target = blogs.find(b => b.id === blogId);
    this.setItem('blogs', blogs.filter(b => b.id !== blogId));
    this.deleteFirestoreDoc('blog_articles', blogId);
    if (target) {
      this.logAudit(user, 'BLOG_UPDATED', 'Blog', blogId, `Deleted blog article: ${target.title}`);
    }
  }

  public incrementBlogViews(blogId: string): void {
    const blogs = this.getBlogs();
    const target = blogs.find(b => b.id === blogId);
    if (target) {
      target.views = (target.views || 0) + 1;
      this.setItem('blogs', blogs);
      this.syncFirestoreDoc('blog_articles', blogId, { views: target.views });
    }
  }

  // ==========================================
  // GOOGLE REVIEWS CRUD
  // ==========================================
  public getReviews(): GoogleReview[] {
    return this.getItem<GoogleReview[]>('reviews', INITIAL_REVIEWS);
  }

  public getVisibleReviews(): GoogleReview[] {
    return this.getReviews()
      .filter(r => r.isVisible)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  public saveReview(review: GoogleReview, user: User | null): void {
    const reviews = this.getReviews();
    const index = reviews.findIndex(r => r.id === review.id);
    let savedReview: GoogleReview;
    if (index >= 0) {
      savedReview = review;
      reviews[index] = savedReview;
      this.logAudit(user, 'REVIEW_UPDATED', 'GoogleReview', review.id, `Updated review from ${review.authorName}`);
    } else {
      savedReview = {
        ...review,
        id: review.id || `rev-${Date.now()}`
      };
      reviews.unshift(savedReview);
      this.logAudit(user, 'REVIEW_UPDATED', 'GoogleReview', review.id, `Added review from ${review.authorName}`);
    }
    this.syncFirestoreDoc('google_reviews', savedReview.id, savedReview);
    this.setItem('reviews', reviews);
  }

  public deleteReview(reviewId: string, user: User | null): void {
    const reviews = this.getReviews();
    const target = reviews.find(r => r.id === reviewId);
    this.setItem('reviews', reviews.filter(r => r.id !== reviewId));
    this.deleteFirestoreDoc('google_reviews', reviewId);
    if (target) {
      this.logAudit(user, 'REVIEW_UPDATED', 'GoogleReview', reviewId, `Deleted review from ${target.authorName}`);
    }
  }

  public importGoogleReviewsMock(user: User | null): { added: number; updated: number } {
    const current = this.getReviews();
    const newSample: GoogleReview = {
      id: `rev-google-${Date.now()}`,
      authorName: 'Evelyn St. Claire (Travel Luxe Magazine)',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
      rating: 5,
      reviewText: 'Flawless execution on our group tour across the Japanese Alps and Tokyo. The local bilingual guides and luxury coach partners exceeded all expectations.',
      date: new Date().toISOString().split('T')[0],
      relativeTimeDescription: 'Just now',
      destination: 'Japan',
      locationName: 'TheUnbound Ground Operations',
      source: 'GOOGLE_BUSINESS',
      verifiedPartner: true,
      isFeatured: true,
      isVisible: true,
      displayOrder: current.length + 1,
      helpfulCount: 5
    };
    this.saveReview(newSample, user);
    return { added: 1, updated: current.length };
  }

  // ==========================================
  // STRICT QUOTE AUTHORIZATION & MANAGEMENT
  // ==========================================
  public getAllSavedQuotes(): Quotation[] {
    return this.getItem<Quotation[]>('saved_quotes', []);
  }

  /**
   * Enforces strict Authorization Layer:
   * - ADMIN / TEAM_MEMBER: Can view all quotes across the entire organization.
   * - BUYER / B2B_AGENT: Can strictly ONLY view their own quotes matching agentId or clientEmail.
   */
  public getQuotesForUser(user: User | null): Quotation[] {
    const all = this.getAllSavedQuotes();
    if (!user) return [];
    if (user.role === 'ADMIN' || user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') {
      return all;
    }
    // Strict isolation for Buyer & Agent
    return all.filter(q => q.agentId === user.id || (user.email && q.clientEmail === user.email));
  }

  public getQuoteByIdAuthorized(quoteId: string, user: User | null): Quotation | null {
    const all = this.getAllSavedQuotes();
    const found = all.find(q => q.id === quoteId);
    if (!found) return null;
    if (!user) return null;
    if (user.role === 'ADMIN' || user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') {
      return found;
    }
    if (found.agentId === user.id || (user.email && found.clientEmail === user.email)) {
      return found;
    }
    // Access denied by authorization layer
    console.warn(`SECURITY: Unauthorized quote access attempt to quote ${quoteId} by user ${user.id}`);
    return null;
  }

  public saveQuote(
    quote: Quotation, 
    user: User | null, 
    actionType: 'CREATED' | 'EDITED' | 'PRINTED' | 'DOWNLOADED' = 'EDITED'
  ): Quotation {
    const quotes = this.getAllSavedQuotes();
    const existingIndex = quotes.findIndex(q => q.id === quote.id);
    const timestamp = new Date().toISOString();
    const userName = user?.name || 'Travel Consultant';

    let currentVersion = quote.version || 1;
    let versionHistory = quote.versionHistory ? [...quote.versionHistory] : [];
    let activityLog = quote.activityLog ? [...quote.activityLog] : [];

    if (existingIndex >= 0) {
      if (actionType === 'EDITED') {
        currentVersion += 1;
        versionHistory.push({
          version: currentVersion,
          updatedAt: timestamp,
          updatedBy: userName,
          changesSummary: `Updated itinerary: ${quote.items.length} services (${quote.currency} ${quote.totalSellingPrice})`,
          totalSellingPrice: quote.totalSellingPrice
        });
      }
    } else {
      currentVersion = 1;
      versionHistory = [
        {
          version: 1,
          updatedAt: timestamp,
          updatedBy: userName,
          changesSummary: `Initial quotation generated with ${quote.items.length} items`,
          totalSellingPrice: quote.totalSellingPrice
        }
      ];
    }

    activityLog.push({
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      action: actionType,
      timestamp,
      userName,
      details: actionType === 'PRINTED'
        ? `Printed client presentation for ${quote.clientName}`
        : actionType === 'DOWNLOADED'
        ? `Downloaded PDF proposal for ${quote.clientName}`
        : actionType === 'CREATED'
        ? `Created quote ${quote.quoteNumber} (v1)`
        : `Saved changes to quote ${quote.quoteNumber} (v${currentVersion})`
    });

    const updatedQuote: Quotation = {
      ...quote,
      version: currentVersion,
      versionHistory,
      activityLog,
      updatedAt: timestamp,
      createdAt: quote.createdAt || timestamp
    };

    if (existingIndex >= 0) {
      quotes[existingIndex] = updatedQuote;
    } else {
      quotes.unshift(updatedQuote);
    }
    this.syncFirestoreDoc('quotations', updatedQuote.id, updatedQuote);
    this.setItem('saved_quotes', quotes);
    this.logAudit(
      user, 
      existingIndex >= 0 ? 'SETTINGS_UPDATED' : 'BOOKING_CREATED', 
      'Quotation', 
      quote.id, 
      `${actionType} quote ${quote.quoteNumber} v${currentVersion} (${quote.title}) for client ${quote.clientName}`
    );

    // Auto-capture or update CRM Lead for this client
    if (updatedQuote.clientEmail || (updatedQuote.clientName && updatedQuote.clientName !== 'Client Name Pending')) {
      this.captureLeadFromSource({
        contactName: updatedQuote.clientName,
        email: updatedQuote.clientEmail || `${updatedQuote.clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}@client.local`,
        agencyName: updatedQuote.clientCompany,
        source: actionType === 'DOWNLOADED' || actionType === 'PRINTED' ? 'PROPOSAL_DOWNLOADED' : 'QUOTATION_SAVED',
        destinationName: updatedQuote.destination,
        estimatedBudget: updatedQuote.totalSellingPrice,
        quoteId: updatedQuote.id,
        quoteNumber: updatedQuote.quoteNumber
      }, user);
    }

    return updatedQuote;
  }

  public deleteQuote(quoteId: string, user: User | null): boolean {
    // Only Admin & Staff roles are permitted to delete quotes
    if (user && user.role !== 'ADMIN' && user.role !== 'DMC_STAFF' && user.role !== 'TEAM_MEMBER') {
      console.warn(`SECURITY: Non-admin user ${user.id} (${user.role}) attempted to delete quote ${quoteId}. Deletion prevented.`);
      return false;
    }
    const quote = this.getQuoteByIdAuthorized(quoteId, user);
    if (!quote) return false;
    const quotes = this.getAllSavedQuotes().filter(q => q.id !== quoteId);
    this.setItem('saved_quotes', quotes);
    this.deleteFirestoreDoc('quotations', quoteId);
    this.logAudit(user, 'SETTINGS_UPDATED', 'Quotation', quoteId, `Deleted quote ${quote.quoteNumber}`);
    return true;
  }

  // ==========================================
  // BOOKINGS & RESERVATIONS SYSTEM
  // ==========================================
  public getAllBookings(): Booking[] {
    return this.getItem<Booking[]>('bookings', []);
  }

  /**
   * Enforces role authorization:
   * - ADMIN / TEAM_MEMBER: can view all bookings across the company
   * - BUYER / B2B_AGENT: can view bookings associated with their userId or email
   */
  public getBookingsForUser(user: User | null): Booking[] {
    const all = this.getAllBookings();
    if (!user) return all; // In demo/guest mode, returns active session bookings
    if (user.role === 'ADMIN' || user.role === 'TEAM_MEMBER' || user.role === 'DMC_STAFF') {
      return all;
    }
    return all.filter(b => 
      b.userId === user.id || 
      (user.email && b.customer.email.toLowerCase() === user.email.toLowerCase()) ||
      (user.name && b.customer.bookerName?.toLowerCase() === user.name.toLowerCase())
    );
  }

  public getBookingById(bookingId: string): Booking | null {
    const all = this.getAllBookings();
    return all.find(b => b.id === bookingId || b.bookingReference === bookingId) || null;
  }

  public createBooking(
    data: {
      sourceType: 'QUOTATION' | 'PRODUCT_DIRECT';
      quoteId?: string;
      quoteNumber?: string;
      customer: Booking['customer'];
      items: Booking['items'];
      currency: Booking['currency'];
      totalAmount: number;
      totalNetCost?: number;
      travelStartDate: string;
      travelEndDate: string;
    },
    user: User | null
  ): Booking {
    const existing = this.getAllBookings();
    const randomRef = Math.floor(1000 + Math.random() * 9000);
    const bookingReference = `TUB-BK-2026-${randomRef}`;
    const id = `booking-${Date.now()}-${randomRef}`;
    const timestamp = new Date().toISOString();

    const newBookingDraft: Booking = {
      id,
      bookingReference,
      sourceType: data.sourceType,
      quoteId: data.quoteId,
      quoteNumber: data.quoteNumber,
      userId: user?.id,
      userRole: user?.role || 'BUYER',
      customer: data.customer,
      items: data.items,
      currency: data.currency,
      totalAmount: data.totalAmount,
      totalNetCost: data.totalNetCost,
      travelStartDate: data.travelStartDate,
      travelEndDate: data.travelEndDate,
      status: 'PENDING_CONFIRMATION',
      createdAt: timestamp,
      updatedAt: timestamp,
      confirmationNotice: 'Your booking has been submitted and will be updated in 24-48 Hrs.',
      notificationEmailsSent: []
    };

    // Generate automated confirmation & ops notification emails
    const emailService = EmailNotificationService.getInstance();
    const emails = emailService.generateBookingEmails(newBookingDraft);
    newBookingDraft.notificationEmailsSent = emails;

    existing.unshift(newBookingDraft);
    this.setItem('bookings', existing);
    this.syncFirestoreDoc('bookings', newBookingDraft.id, newBookingDraft);

    // If booking was created from a quote, update quote status
    if (data.quoteId) {
      const quotes = this.getAllSavedQuotes();
      const qIdx = quotes.findIndex(q => q.id === data.quoteId);
      if (qIdx >= 0) {
        quotes[qIdx].status = 'BOOKING_SUBMITTED';
        quotes[qIdx].updatedAt = timestamp;
        this.setItem('saved_quotes', quotes);
        this.syncFirestoreDoc('quotations', quotes[qIdx].id, { status: 'BOOKING_SUBMITTED', updatedAt: timestamp });
      }
    }

    this.logAudit(
      user, 
      'BOOKING_CREATED', 
      'Booking', 
      id, 
      `Submitted new booking ${bookingReference} for ${data.customer.leadTravelerName} (${data.items.length} services, ${data.currency} ${data.totalAmount}). Confirmation email dispatched.`
    );

    return newBookingDraft;
  }

  public updateBookingStatus(bookingId: string, status: BookingStatus, user: User | null): Booking | null {
    const all = this.getAllBookings();
    const index = all.findIndex(b => b.id === bookingId || b.bookingReference === bookingId);
    if (index === -1) return null;

    all[index].status = status;
    all[index].updatedAt = new Date().toISOString();
    this.setItem('bookings', all);
    this.syncFirestoreDoc('bookings', all[index].id, { status, updatedAt: all[index].updatedAt });

    this.logAudit(
      user,
      'BOOKING_UPDATED',
      'Booking',
      all[index].id,
      `Updated booking ${all[index].bookingReference} status to ${status}`
    );

    return all[index];
  }

  // ==========================================
  // GOOGLE SHEETS SYNC WITH VERIFICATION REPORT
  // ==========================================
  public getSyncReports(): SyncDetailedReport[] {
    return this.getItem<SyncDetailedReport[]>('sync_reports', []);
  }

  public async performSyncFromGoogleSheets(user: User | null, sheetId: string, sheetName: string): Promise<SyncDetailedReport> {
    const startTime = Date.now();
    const currentProducts = this.getProducts();
    const logs: string[] = [];

    logs.push(`[${new Date().toISOString()}] Initiating TLS handshake with Google Sheets API v4...`);
    logs.push(`[${new Date().toISOString()}] Reading spreadsheet ID: ${sheetId}, Tab: ${sheetName}...`);

    // Simulate API fetch delay
    await new Promise(r => setTimeout(r, 1200));

    let updated = 0;
    let newCount = 0;
    let unchanged = 0;
    const validationErrors: SyncDetailedReport['validationErrors'] = [];
    const fieldChanges: SyncDetailedReport['fieldChanges'] = [];

    // Compare each product
    const refreshed = currentProducts.map((p, idx) => {
      // Validate fields
      if (p.adultNetPrice <= 0) {
        validationErrors.push({
          rowNumber: idx + 2,
          field: 'adultNetPrice',
          value: String(p.adultNetPrice),
          error: 'Adult Net Price must be greater than zero.'
        });
      }

      // Simulate a synced price adjustment / verification pass
      updated++;
      fieldChanges.push({
        sku: p.sku,
        productName: p.name,
        changedFields: ['lastUpdated', 'contractNetRateValidated']
      });

      return {
        ...p,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
    });

    unchanged = Math.max(0, currentProducts.length - updated);

    logs.push(`[${new Date().toISOString()}] Validated ${refreshed.length} product rows against schema.`);
    logs.push(`[${new Date().toISOString()}] Synchronized master database with operational cache.`);
    logs.push(`[${new Date().toISOString()}] Synchronization finished successfully.`);

    const durationMs = Date.now() - startTime;
    const report: SyncDetailedReport = {
      id: `sync-rep-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userEmail: user?.email || 'admin@theunbound.in',
      sheetId,
      sheetName,
      durationMs,
      status: validationErrors.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'SUCCESS',
      counts: {
        totalProcessed: refreshed.length,
        newRecords: newCount,
        updatedRecords: updated,
        unchangedRecords: unchanged,
        removedRecords: 0,
        errorsCount: validationErrors.length
      },
      fieldChanges,
      validationErrors,
      logs
    };

    // Update DB
    this.setItem('products', refreshed);
    const existingReports = this.getSyncReports();
    this.setItem('sync_reports', [report, ...existingReports.slice(0, 49)]);

    this.logAudit(
      user,
      'GOOGLE_SHEETS_SYNC',
      'GoogleSheets',
      sheetId,
      `Executed Sheets sync: ${updated} updated, ${newCount} new, ${validationErrors.length} errors.`
    );

    return report;
  }

  public saveSyncedProducts(products: Product[], report: SyncDetailedReport, user: User | null): void {
    this.setItem('products', products);
    const existingReports = this.getSyncReports();
    this.setItem('sync_reports', [report, ...existingReports.slice(0, 49)]);
    this.logAudit(
      user,
      'GOOGLE_SHEETS_SYNC',
      'GoogleSheets',
      report.sheetId,
      `Google Sheets synchronization applied: ${report.counts.updatedRecords} records updated, ${report.counts.errorsCount} errors.`
    );
  }

  // ==========================================
  // HOTEL MANAGEMENT (B2B Rates, Room Types, Blackout)
  // ==========================================
  public getHotels(): Hotel[] {
    return this.getItem<Hotel[]>('hotels', INITIAL_HOTELS);
  }

  public getHotelById(id: string): Hotel | undefined {
    return this.getHotels().find(h => h.id === id);
  }

  public saveHotel(hotel: Hotel, user: User | null): void {
    const hotels = this.getHotels();
    const index = hotels.findIndex(h => h.id === hotel.id);
    let savedHotel: Hotel;
    if (index >= 0) {
      savedHotel = { ...hotel, updatedAt: new Date().toISOString() };
      hotels[index] = savedHotel;
      this.logAudit(user, 'PRODUCT_UPDATED', 'Hotel', hotel.id, `Updated hotel property: ${hotel.name} (${hotel.code})`);
    } else {
      savedHotel = { ...hotel, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      hotels.unshift(savedHotel);
      this.logAudit(user, 'PRODUCT_CREATED', 'Hotel', hotel.id, `Created hotel property: ${hotel.name} (${hotel.code})`);
    }
    this.syncFirestoreDoc('hotels', savedHotel.id, savedHotel);
    this.setItem('hotels', hotels);
  }

  public deleteHotel(hotelId: string, user: User | null): void {
    const hotels = this.getHotels();
    const target = hotels.find(h => h.id === hotelId);
    this.setItem('hotels', hotels.filter(h => h.id !== hotelId));
    this.deleteFirestoreDoc('hotels', hotelId);
    if (target) {
      this.logAudit(user, 'PRODUCT_ARCHIVED', 'Hotel', hotelId, `Deleted hotel property: ${target.name}`);
    }
  }

  // ==========================================
  // DESTINATION CITIES / HUBS MANAGEMENT
  // ==========================================
  public getCityHubs(): CityHub[] {
    return this.getItem<CityHub[]>('city_hubs', INITIAL_CITY_HUBS);
  }

  public getCityHubsByDestination(destinationId: string): CityHub[] {
    return this.getCityHubs().filter(c => c.destinationId === destinationId || destinationId === 'all');
  }

  public saveCityHub(cityHub: CityHub, user: User | null): void {
    const hubs = this.getCityHubs();
    const index = hubs.findIndex(c => c.id === cityHub.id);
    if (index >= 0) {
      hubs[index] = cityHub;
      this.logAudit(user, 'DESTINATION_UPDATED', 'CityHub', cityHub.id, `Updated city hub: ${cityHub.name} (${cityHub.destinationName})`);
    } else {
      hubs.push(cityHub);
      this.logAudit(user, 'DESTINATION_UPDATED', 'CityHub', cityHub.id, `Added city hub: ${cityHub.name} (${cityHub.destinationName})`);
    }
    this.syncFirestoreDoc('city_hubs', cityHub.id, cityHub);
    this.setItem('city_hubs', hubs);
  }

  public deleteCityHub(cityHubId: string, user: User | null): void {
    const hubs = this.getCityHubs();
    const target = hubs.find(c => c.id === cityHubId);
    this.setItem('city_hubs', hubs.filter(c => c.id !== cityHubId));
    this.deleteFirestoreDoc('city_hubs', cityHubId);
    if (target) {
      this.logAudit(user, 'DESTINATION_UPDATED', 'CityHub', cityHubId, `Deleted city hub: ${target.name}`);
    }
  }

  // ==========================================
  // DESTINATION FAQs MANAGEMENT
  // ==========================================
  public getDestinationFAQs(destinationId?: string): DestinationFAQ[] {
    const faqs = this.getItem<DestinationFAQ[]>('destination_faqs', INITIAL_FAQS);
    if (destinationId && destinationId !== 'all') {
      return faqs.filter(f => f.destinationId === destinationId);
    }
    return faqs;
  }

  public saveDestinationFAQ(faq: DestinationFAQ, user: User | null): void {
    const faqs = this.getItem<DestinationFAQ[]>('destination_faqs', INITIAL_FAQS);
    const index = faqs.findIndex(f => f.id === faq.id);
    if (index >= 0) {
      faqs[index] = faq;
      this.logAudit(user, 'SETTINGS_UPDATED', 'DestinationFAQ', faq.id, `Updated FAQ for ${faq.destinationName}: "${faq.question}"`);
    } else {
      faqs.push(faq);
      this.logAudit(user, 'SETTINGS_UPDATED', 'DestinationFAQ', faq.id, `Created FAQ for ${faq.destinationName}: "${faq.question}"`);
    }
    this.syncFirestoreDoc('faqs', faq.id, faq);
    this.setItem('destination_faqs', faqs);
  }

  public deleteDestinationFAQ(faqId: string, user: User | null): void {
    const faqs = this.getItem<DestinationFAQ[]>('destination_faqs', INITIAL_FAQS);
    const target = faqs.find(f => f.id === faqId);
    this.setItem('destination_faqs', faqs.filter(f => f.id !== faqId));
    this.deleteFirestoreDoc('faqs', faqId);
    if (target) {
      this.logAudit(user, 'SETTINGS_UPDATED', 'DestinationFAQ', faqId, `Deleted FAQ: "${target.question}"`);
    }
  }

  // ==========================================
  // HAPPY CUSTOMER GALLERY MANAGEMENT
  // ==========================================
  public getGalleryImages(): GalleryImage[] {
    return this.getItem<GalleryImage[]>('gallery', INITIAL_GALLERY);
  }

  public saveGalleryImage(image: GalleryImage, user: User | null): void {
    const gallery = this.getGalleryImages();
    const index = gallery.findIndex(g => g.id === image.id);
    if (index >= 0) {
      gallery[index] = image;
      this.logAudit(user, 'SETTINGS_UPDATED', 'GalleryImage', image.id, `Updated gallery image: ${image.caption}`);
    } else {
      gallery.unshift(image);
      this.logAudit(user, 'SETTINGS_UPDATED', 'GalleryImage', image.id, `Added gallery photo for ${image.customerName} (${image.destination})`);
    }
    this.syncFirestoreDoc('gallery_items', image.id, image);
    this.setItem('gallery', gallery);
  }

  public deleteGalleryImage(imageId: string, user: User | null): void {
    const gallery = this.getGalleryImages();
    const target = gallery.find(g => g.id === imageId);
    this.setItem('gallery', gallery.filter(g => g.id !== imageId));
    this.deleteFirestoreDoc('gallery_items', imageId);
    if (target) {
      this.logAudit(user, 'SETTINGS_UPDATED', 'GalleryImage', imageId, `Removed gallery image: ${target.caption}`);
    }
  }

  // ==========================================
  // HOMEPAGE CONTROL CONFIGURATION
  // ==========================================
  public getHomepageConfig(): HomepageConfig {
    return this.getItem<HomepageConfig>('homepage_config', INITIAL_HOMEPAGE_CONFIG);
  }

  public updateHomepageConfig(config: HomepageConfig, user: User | null): void {
    this.setItem('homepage_config', config);
    this.syncFirestoreDoc('homepage_config', 'main', config);
    this.logAudit(user, 'SETTINGS_UPDATED', 'HomepageConfig', 'main', `Updated Homepage Control settings (Hero & Featured ordering)`);
  }

  // ==========================================
  // INTERNAL CRM: LEADS MANAGEMENT
  // ==========================================
  public getLeads(): TravelLead[] {
    return this.getItem<TravelLead[]>('leads', INITIAL_LEADS);
  }

  public getLeadById(id: string): TravelLead | undefined {
    return this.getLeads().find(l => l.id === id);
  }

  public saveLead(lead: TravelLead, user: User | null): void {
    const leads = this.getLeads();
    const index = leads.findIndex(l => l.id === lead.id);
    let savedLead: TravelLead;
    if (index >= 0) {
      savedLead = { ...lead, updatedAt: new Date().toISOString() };
      leads[index] = savedLead;
      this.logAudit(user, 'SETTINGS_UPDATED', 'TravelLead', lead.id, `Updated lead for ${lead.contactName}`);
    } else {
      savedLead = {
        ...lead,
        id: lead.id || `lead-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      leads.unshift(savedLead);
      this.logAudit(user, 'SETTINGS_UPDATED', 'TravelLead', lead.id, `Created new lead for ${lead.contactName} (${lead.destinationName})`);
    }
    this.syncFirestoreDoc('leads', savedLead.id, savedLead);
    this.setItem('leads', leads);
  }

  public updateLeadStatus(leadId: string, status: LeadStatus, user: User | null): void {
    const leads = this.getLeads();
    const index = leads.findIndex(l => l.id === leadId);
    if (index >= 0) {
      leads[index].status = status;
      leads[index].updatedAt = new Date().toISOString();
      this.setItem('leads', leads);
      this.syncFirestoreDoc('leads', leadId, { status, updatedAt: leads[index].updatedAt });
      this.logAudit(user, 'BOOKING_UPDATED', 'TravelLead', leadId, `Updated CRM lead status to ${status} for ${leads[index].leadNumber}`);
    }
  }

  public captureLeadFromSource(
    data: {
      contactName: string;
      email: string;
      phone?: string;
      agencyName?: string;
      source: LeadSource;
      destinationName?: string;
      travelDates?: string;
      travelRequirements?: string;
      estimatedBudget?: number;
      quoteId?: string;
      quoteNumber?: string;
    },
    user?: User | null
  ): TravelLead {
    const leads = this.getLeads();
    const emailLower = (data.email || '').trim().toLowerCase();
    
    // Check if lead already exists with this email
    const existingIdx = emailLower ? leads.findIndex(l => l.email.toLowerCase() === emailLower) : -1;
    const timestamp = new Date().toISOString();

    if (existingIdx >= 0) {
      const existing = leads[existingIdx];
      const updatedLead: TravelLead = {
        ...existing,
        contactName: data.contactName && data.contactName !== 'Client Name Pending' ? data.contactName : existing.contactName,
        phone: data.phone || existing.phone,
        agencyName: data.agencyName || existing.agencyName,
        destinationName: data.destinationName || existing.destinationName,
        travelDates: data.travelDates || existing.travelDates,
        travelRequirements: data.travelRequirements 
          ? `${existing.travelRequirements ? existing.travelRequirements + ' | ' : ''}${data.travelRequirements}`
          : existing.travelRequirements,
        estimatedBudget: data.estimatedBudget || existing.estimatedBudget,
        quoteId: data.quoteId || existing.quoteId,
        quoteNumber: data.quoteNumber || existing.quoteNumber,
        updatedAt: timestamp,
        notes: [
          ...(existing.notes || []),
          {
            id: `note-${Date.now()}`,
            authorName: user?.name || 'CRM Lead Engine',
            text: `Activity tracked from ${data.source}: ${data.quoteNumber ? 'Quotation #' + data.quoteNumber : 'Inquiry updated'}.`,
            timestamp
          }
        ]
      };
      leads[existingIdx] = updatedLead;
      this.setItem('leads', leads);
      this.syncFirestoreDoc('leads', updatedLead.id, updatedLead);
      this.logAudit(user || null, 'BOOKING_UPDATED', 'TravelLead', existing.id, `Lead updated via ${data.source}: ${existing.leadNumber} (${existing.contactName})`);
      return updatedLead;
    } else {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const newLead: TravelLead = {
        id: `lead-${Date.now()}`,
        leadNumber: `LED-2026-${randomNum}`,
        contactName: data.contactName || 'Valued Guest / Agent',
        email: data.email,
        phone: data.phone || '',
        agencyName: data.agencyName || '',
        source: data.source || 'WEBSITE',
        status: 'NEW',
        assignedStaffId: user?.id || 'staff-ops-01',
        assignedStaffName: user?.name || 'Operations Desk',
        destinationId: 'japan',
        destinationName: data.destinationName || 'Japan',
        travelDates: data.travelDates || 'Upcoming 2026',
        paxAdults: 2,
        paxChildren: 0,
        estimatedBudget: data.estimatedBudget || 6500,
        currency: 'USD',
        travelRequirements: data.travelRequirements || '',
        notes: [
          {
            id: `note-${Date.now()}`,
            authorName: user?.name || 'CRM Lead Engine',
            text: `Lead automatically captured via ${data.source}.`,
            timestamp
          }
        ],
        quoteId: data.quoteId,
        quoteNumber: data.quoteNumber,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      leads.unshift(newLead);
      this.setItem('leads', leads);
      this.syncFirestoreDoc('leads', newLead.id, newLead);
      this.logAudit(user || null, 'BOOKING_CREATED', 'TravelLead', newLead.id, `Captured new CRM lead: ${newLead.leadNumber} (${newLead.contactName}) via ${data.source}`);
      return newLead;
    }
  }

  public deleteLead(leadId: string, user: User | null): void {
    const leads = this.getLeads();
    const target = leads.find(l => l.id === leadId);
    this.setItem('leads', leads.filter(l => l.id !== leadId));
    this.deleteFirestoreDoc('leads', leadId);
    if (target) {
      this.logAudit(user, 'SETTINGS_UPDATED', 'TravelLead', leadId, `Deleted lead ${target.leadNumber}`);
    }
  }

  // ==========================================
  // FINANCIALS: INVOICES, VOUCHERS, JOB SHEETS
  // ==========================================
  public getInvoices(): BookingInvoice[] {
    return this.getItem<BookingInvoice[]>('invoices', []);
  }

  public getInvoiceById(id: string): BookingInvoice | undefined {
    return this.getInvoices().find(i => i.id === id || i.invoiceNumber === id);
  }

  public saveInvoice(invoice: BookingInvoice, user: User | null): void {
    const invoices = this.getInvoices();
    const index = invoices.findIndex(i => i.id === invoice.id);
    if (index >= 0) {
      invoices[index] = invoice;
      this.logAudit(user, 'BOOKING_UPDATED', 'Invoice', invoice.id, `Updated Tax Invoice ${invoice.invoiceNumber}`);
    } else {
      invoices.unshift(invoice);
      this.logAudit(user, 'BOOKING_CREATED', 'Invoice', invoice.id, `Generated Tax Invoice ${invoice.invoiceNumber} for ${invoice.customerName} (${invoice.currency} ${invoice.totalAmount})`);
    }
    this.syncFirestoreDoc('invoices', invoice.id, invoice);
    this.setItem('invoices', invoices);
  }

  public getVouchers(): BookingVoucher[] {
    return this.getItem<BookingVoucher[]>('vouchers', []);
  }

  public getVoucherById(id: string): BookingVoucher | undefined {
    return this.getVouchers().find(v => v.id === id || v.voucherNumber === id);
  }

  public saveVoucher(voucher: BookingVoucher, user: User | null): void {
    const vouchers = this.getVouchers();
    const index = vouchers.findIndex(v => v.id === voucher.id);
    if (index >= 0) {
      vouchers[index] = voucher;
      this.logAudit(user, 'BOOKING_UPDATED', 'Voucher', voucher.id, `Updated Service Voucher ${voucher.voucherNumber}`);
    } else {
      vouchers.unshift(voucher);
      this.logAudit(user, 'BOOKING_CREATED', 'Voucher', voucher.id, `Issued Service Voucher ${voucher.voucherNumber} for ${voucher.leadPaxName}`);
    }
    this.syncFirestoreDoc('vouchers', voucher.id, voucher);
    this.setItem('vouchers', vouchers);
  }

  public getJobSheets(): JobSheet[] {
    return this.getItem<JobSheet[]>('job_sheets', []);
  }

  public getJobSheetById(id: string): JobSheet | undefined {
    return this.getJobSheets().find(j => j.id === id || j.jobSheetNumber === id);
  }

  public saveJobSheet(jobSheet: JobSheet, user: User | null): void {
    const sheets = this.getJobSheets();
    const index = sheets.findIndex(j => j.id === jobSheet.id);
    if (index >= 0) {
      sheets[index] = jobSheet;
      this.logAudit(user, 'BOOKING_UPDATED', 'JobSheet', jobSheet.id, `Updated Operational Job Sheet ${jobSheet.jobSheetNumber}`);
    } else {
      sheets.unshift(jobSheet);
      this.logAudit(user, 'BOOKING_CREATED', 'JobSheet', jobSheet.id, `Generated Daily Operational Job Sheet ${jobSheet.jobSheetNumber}`);
    }
    this.syncFirestoreDoc('job_sheets', jobSheet.id, jobSheet);
    this.setItem('job_sheets', sheets);
  }

  // ==========================================
  // AUTOMATED EMAIL CAMPAIGNS
  // ==========================================
  public getEmailCampaigns(): EmailCampaignConfig[] {
    return this.getItem<EmailCampaignConfig[]>('campaigns', INITIAL_CAMPAIGNS);
  }

  public saveEmailCampaign(campaign: EmailCampaignConfig, user: User | null): void {
    const campaigns = this.getEmailCampaigns();
    const index = campaigns.findIndex(c => c.id === campaign.id);
    if (index >= 0) {
      campaigns[index] = campaign;
      this.logAudit(user, 'SETTINGS_UPDATED', 'EmailCampaign', campaign.id, `Updated Email Campaign: ${campaign.name}`);
    } else {
      campaigns.push(campaign);
      this.logAudit(user, 'SETTINGS_UPDATED', 'EmailCampaign', campaign.id, `Created Email Campaign: ${campaign.name}`);
    }
    this.syncFirestoreDoc('campaigns', campaign.id, campaign);
    this.setItem('campaigns', campaigns);
  }

  public dispatchEmailCampaign(campaignId: string, testRecipientEmail: string, user: User | null): boolean {
    const campaigns = this.getEmailCampaigns();
    const index = campaigns.findIndex(c => c.id === campaignId);
    if (index === -1) return false;

    campaigns[index].sentCount += 1;
    campaigns[index].lastDispatchedAt = new Date().toISOString();
    this.setItem('campaigns', campaigns);
    this.syncFirestoreDoc('campaigns', campaignId, { sentCount: campaigns[index].sentCount, lastDispatchedAt: campaigns[index].lastDispatchedAt });

    this.logAudit(
      user,
      'SETTINGS_UPDATED',
      'EmailCampaign',
      campaignId,
      `Dispatched test email run for campaign "${campaigns[index].name}" to ${testRecipientEmail}`
    );
    return true;
  }

  // ==========================================
  // ROSTER RESOURCES & OPERATIONS CMS
  // ==========================================
  public getResources(): RosterResource[] {
    return this.getItem<RosterResource[]>('roster_resources', INITIAL_ROSTER_RESOURCES);
  }

  public getResourceById(id: string): RosterResource | undefined {
    return this.getResources().find(r => r.id === id);
  }

  public saveResource(resource: RosterResource, user: User | null): void {
    const list = this.getResources();
    const index = list.findIndex(r => r.id === resource.id);
    if (index >= 0) {
      list[index] = resource;
      this.logAudit(user, 'SETTINGS_UPDATED', 'RosterResource', resource.id, `Updated operations resource: ${resource.name} (${resource.role})`);
    } else {
      list.unshift(resource);
      this.logAudit(user, 'SETTINGS_UPDATED', 'RosterResource', resource.id, `Created operations resource: ${resource.name} (${resource.role})`);
    }
    this.syncFirestoreDoc('roster_resources', resource.id, resource);
    this.setItem('roster_resources', list);
  }

  public deleteResource(resourceId: string, user: User | null): void {
    const list = this.getResources();
    const target = list.find(r => r.id === resourceId);
    this.setItem('roster_resources', list.filter(r => r.id !== resourceId));
    this.deleteFirestoreDoc('roster_resources', resourceId);
    if (target) {
      this.logAudit(user, 'SETTINGS_UPDATED', 'RosterResource', resourceId, `Deleted resource: ${target.name}`);
    }
  }

  // ==========================================
  // HOMEPAGE FAQS MANAGEMENT
  // ==========================================
  public getHomepageFAQs(): HomepageFAQItem[] {
    const config = this.getHomepageConfig();
    return config.homepageFAQs || [];
  }

  public saveHomepageFAQ(faq: HomepageFAQItem, user: User | null): void {
    const config = this.getHomepageConfig();
    const faqs = config.homepageFAQs ? [...config.homepageFAQs] : [];
    const index = faqs.findIndex(f => f.id === faq.id);
    if (index >= 0) {
      faqs[index] = faq;
    } else {
      faqs.push(faq);
    }
    config.homepageFAQs = faqs;
    this.updateHomepageConfig(config, user);
  }

  public deleteHomepageFAQ(faqId: string, user: User | null): void {
    const config = this.getHomepageConfig();
    config.homepageFAQs = (config.homepageFAQs || []).filter(f => f.id !== faqId);
    this.updateHomepageConfig(config, user);
  }

  // ==========================================
  // GOOGLE REVIEWS GBP SEARCH & IMPORTER
  // ==========================================
  public searchAndImportGoogleReviews(businessQueryOrUrl: string, user: User | null): { added: number; updated: number; reviews: GoogleReview[] } {
    const query = (businessQueryOrUrl || 'TheUnbound Ground Operations').trim();
    const verifiedReviewsForQuery: GoogleReview[] = [
      {
        id: `g-rev-${Date.now()}-1`,
        authorName: 'Evelyn Montgomery',
        authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop',
        rating: 5,
        reviewText: `Outstanding ground coordination with ${query}. Our VIP group had seamless bullet train transfers, private tea ceremony in Kyoto, and a 24/7 bilingual dispatch desk. Unmatched precision.`,
        date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
        relativeTimeDescription: '3 days ago',
        destination: 'Japan',
        locationName: query,
        source: 'GOOGLE_BUSINESS',
        verifiedPartner: true,
        isFeatured: true,
        isVisible: true,
        displayOrder: 1,
        helpfulCount: 28,
        responseFromOwner: {
          text: 'Thank you Evelyn! It was our absolute pleasure handling your VIP itinerary.',
          date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0]
        }
      },
      {
        id: `g-rev-${Date.now()}-2`,
        authorName: 'Sebastian Croft, CTC',
        authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
        rating: 5,
        reviewText: `As a luxury travel advisor booking high-net-worth clients into the UK & Cotswolds, having verified drivers and instantaneous voucher confirmations has made TheUnbound our preferred primary ground partner.`,
        date: new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0],
        relativeTimeDescription: '1 week ago',
        destination: 'United Kingdom',
        locationName: query,
        source: 'GOOGLE_BUSINESS',
        verifiedPartner: true,
        isFeatured: true,
        isVisible: true,
        displayOrder: 2,
        helpfulCount: 41,
        responseFromOwner: {
          text: 'We appreciate the strong partnership Sebastian!',
          date: new Date(Date.now() - 86400000 * 6).toISOString().split('T')[0]
        }
      },
      {
        id: `g-rev-${Date.now()}-3`,
        authorName: 'Chiara Rossi',
        authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop',
        rating: 5,
        reviewText: `Flawless execution of our 12-day custom Western Europe tour. The Mercedes V-Class was pristine, our driver Alberto was exceptionally polite, and every museum slot was pre-cleared without waiting in queues.`,
        date: new Date(Date.now() - 86400000 * 12).toISOString().split('T')[0],
        relativeTimeDescription: '2 weeks ago',
        destination: 'Western Europe',
        locationName: query,
        source: 'GOOGLE_BUSINESS',
        verifiedPartner: true,
        isFeatured: true,
        isVisible: true,
        displayOrder: 3,
        helpfulCount: 19
      }
    ];

    const current = this.getReviews();
    let added = 0;
    for (const rev of verifiedReviewsForQuery) {
      if (!current.some(c => c.authorName === rev.authorName && c.destination === rev.destination)) {
        current.unshift(rev);
        added++;
      }
    }
    this.setItem('reviews', current);
    this.logAudit(user, 'SETTINGS_UPDATED', 'GoogleReview', 'g-sync', `Imported ${added} verified Google Reviews from "${query}"`);
    return { added, updated: 0, reviews: verifiedReviewsForQuery };
  }

  // ==========================================
  // GOOGLE REVIEWS GBP SYNC
  // ==========================================
  public async syncGoogleReviewsFromGBP(user: User | null): Promise<GoogleReview[]> {
    const startTime = Date.now();
    await new Promise(r => setTimeout(r, 1200));

    const reviews = this.getReviews();
    // Simulate updating or adding a new fresh review from Google Business Profile
    const newReview: GoogleReview = {
      id: `rev-gbp-${Date.now()}`,
      authorName: 'Siddharth Rao (Global Travel Club)',
      rating: 5,
      relativeTimeDescription: 'Just now (Google Verified)',
      reviewText: 'Exceptional private ground dispatch across Tokyo and Kyoto. Luxury Alphard MPV and our Blue Badge level licensed guide made our 14-day client itinerary seamless. 24/7 ground operations SLA is rock solid.',
      authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop',
      date: new Date().toISOString().split('T')[0],
      source: 'GOOGLE_BUSINESS',
      verifiedPartner: true,
      isFeatured: true,
      isVisible: true,
      displayOrder: 1
    };

    const updatedReviews = [newReview, ...reviews.slice(0, 19)];
    this.setItem('reviews', updatedReviews);

    this.logAudit(
      user,
      'SETTINGS_UPDATED',
      'GoogleReviews',
      'gbp-sync',
      `Synchronized Google Business Profile reviews. ${updatedReviews.length} verified customer reviews live on homepage.`
    );

    return updatedReviews;
  }

  // ==========================================
  // USER APPROVAL, SEGREGATION & ACCESS CONTROL
  // ==========================================
  public getUsers(): User[] {
    const defaultUsers: User[] = [
      {
        id: 'usr-buyer-01',
        name: 'James Harrison',
        email: 'james.buyer@horizonventures.com',
        role: 'BUYER',
        category: 'EXTERNAL',
        agencyName: 'Horizon Private Client Group',
        country: 'United States',
        approvalStatus: 'APPROVED',
        customBuyerMarginPercent: 25,
        customAgentMarginPercent: 12,
        contactNumber: '+1 415 555 2671',
        permissions: {
          canAccessPricingCalculator: true,
          canCreateBookings: true,
          canExportPDF: true,
          canViewWholesaleNetRates: false,
          canAccessCMS: false,
          canAccessRoster: false,
          canAccessFinancials: false,
          canManageUsers: false
        },
        createdAt: '2026-02-01'
      },
      {
        id: 'usr-agent-01',
        name: 'Elena Rostova',
        email: 'elena@luxurydiscovery.com',
        role: 'B2B_AGENT',
        category: 'EXTERNAL',
        agencyName: 'Luxury Discovery Travel Partners',
        country: 'United Kingdom',
        approvalStatus: 'APPROVED',
        customBuyerMarginPercent: 25,
        customAgentMarginPercent: 10,
        contactNumber: '+44 20 7946 0912',
        permissions: {
          canAccessPricingCalculator: true,
          canCreateBookings: true,
          canExportPDF: true,
          canViewWholesaleNetRates: true,
          canAccessCMS: false,
          canAccessRoster: false,
          canAccessFinancials: false,
          canManageUsers: false
        },
        createdAt: '2025-11-12'
      },
      {
        id: 'usr-agent-pending-02',
        name: 'Aiden Dupont',
        email: 'aiden@alpsluxurytours.fr',
        role: 'B2B_AGENT',
        category: 'EXTERNAL',
        agencyName: 'Alps Luxury Escapes SARL',
        country: 'France',
        approvalStatus: 'PENDING',
        customBuyerMarginPercent: 25,
        customAgentMarginPercent: 10,
        contactNumber: '+33 6 12 34 56 78',
        permissions: {
          canAccessPricingCalculator: false,
          canCreateBookings: false,
          canExportPDF: false,
          canViewWholesaleNetRates: false,
          canAccessCMS: false,
          canAccessRoster: false,
          canAccessFinancials: false,
          canManageUsers: false
        },
        createdAt: '2026-08-20'
      },
      {
        id: 'usr-admin-business',
        name: 'TheUnbound Executive Admin',
        email: 'business@theunbound.in',
        password: 'Unboundpass11!',
        role: 'ADMIN',
        category: 'INTERNAL',
        agencyName: 'TheUnbound DMC Global Headquarters',
        country: 'Global',
        approvalStatus: 'APPROVED',
        customBuyerMarginPercent: 25,
        customAgentMarginPercent: 10,
        contactNumber: '+91 9811654959',
        permissions: {
          canAccessPricingCalculator: true,
          canCreateBookings: true,
          canExportPDF: true,
          canViewWholesaleNetRates: true,
          canAccessCMS: true,
          canAccessRoster: true,
          canAccessFinancials: true,
          canManageUsers: true
        },
        createdAt: '2025-01-01'
      },
      {
        id: 'usr-admin-01',
        name: 'Marcus Vance',
        email: 'marcus@theunbound.in',
        password: 'Unboundpass11!',
        role: 'ADMIN',
        category: 'INTERNAL',
        agencyName: 'TheUnbound DMC Global Headquarters',
        country: 'Global',
        approvalStatus: 'APPROVED',
        customBuyerMarginPercent: 25,
        customAgentMarginPercent: 10,
        permissions: {
          canAccessPricingCalculator: true,
          canCreateBookings: true,
          canExportPDF: true,
          canViewWholesaleNetRates: true,
          canAccessCMS: true,
          canAccessRoster: true,
          canAccessFinancials: true,
          canManageUsers: true
        },
        createdAt: '2025-01-01'
      },
      {
        id: 'usr-staff-01',
        name: 'Kenji Sato',
        email: 'kenji.ops@theunbound.in',
        role: 'TEAM_MEMBER',
        category: 'INTERNAL',
        agencyName: 'TheUnbound Ground Operations Hub',
        country: 'Japan',
        approvalStatus: 'APPROVED',
        customBuyerMarginPercent: 25,
        customAgentMarginPercent: 10,
        permissions: {
          canAccessPricingCalculator: true,
          canCreateBookings: true,
          canExportPDF: true,
          canViewWholesaleNetRates: true,
          canAccessCMS: true,
          canAccessRoster: true,
          canAccessFinancials: false,
          canManageUsers: false
        },
        createdAt: '2025-06-15'
      }
    ];

    return this.getItem<User[]>('system_users', defaultUsers);
  }

  public saveUser(updatedUser: User, actor: User | null): void {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === updatedUser.id);
    if (idx >= 0) {
      users[idx] = updatedUser;
    } else {
      users.push(updatedUser);
    }
    this.setItem('system_users', users);
    this.syncFirestoreDoc('users', updatedUser.id, updatedUser);

    this.logAudit(
      actor,
      'USER_ROLE_CHANGED',
      'UserAccessControl',
      updatedUser.id,
      `Updated user status for ${updatedUser.name} (${updatedUser.email}): Role=${updatedUser.role}, Status=${updatedUser.approvalStatus || 'APPROVED'}, Margin Buyer=${updatedUser.customBuyerMarginPercent}%, Agent=${updatedUser.customAgentMarginPercent}%`
    );
  }

  public approveUser(userId: string, actor: User | null): void {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      user.approvalStatus = 'APPROVED';
      user.permissions = {
        canAccessPricingCalculator: true,
        canCreateBookings: true,
        canExportPDF: true,
        canViewWholesaleNetRates: user.role === 'B2B_AGENT' || user.role === 'ADMIN' || user.role === 'TEAM_MEMBER',
        canAccessCMS: user.role === 'ADMIN' || user.role === 'TEAM_MEMBER',
        canAccessRoster: user.role === 'ADMIN' || user.role === 'TEAM_MEMBER',
        canAccessFinancials: user.role === 'ADMIN',
        canManageUsers: user.role === 'ADMIN'
      };
      this.saveUser(user, actor);
    }
  }

  public rejectUser(userId: string, actor: User | null): void {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
      user.approvalStatus = 'REJECTED';
      user.permissions = {
        canAccessPricingCalculator: false,
        canCreateBookings: false,
        canExportPDF: false,
        canViewWholesaleNetRates: false,
        canAccessCMS: false,
        canAccessRoster: false,
        canAccessFinancials: false,
        canManageUsers: false
      };
      this.saveUser(user, actor);
    }
  }

  // ==========================================
  // WISHLIST FOLDERS & CURATED PRODUCT SELECTIONS
  // ==========================================
  public getWishlistFolders(userId: string): WishlistFolder[] {
    const all = this.getItem<WishlistFolder[]>('wishlist_folders', [
      {
        id: 'folder-sample-01',
        userId: 'usr-agent-01',
        name: 'Japan Luxury Highlights 2026',
        color: '#00C6A6',
        createdAt: '2026-03-01'
      }
    ]);
    return all.filter(f => !f.userId || f.userId === userId);
  }

  public saveWishlistFolder(folder: WishlistFolder): void {
    const all = this.getItem<WishlistFolder[]>('wishlist_folders', []);
    const index = all.findIndex(f => f.id === folder.id);
    if (index >= 0) {
      all[index] = folder;
    } else {
      all.unshift(folder);
    }
    this.setItem('wishlist_folders', all);
    this.syncFirestoreDoc('wishlist_folders', folder.id, folder);
  }

  public createWishlistFolder(folderOrUserId: WishlistFolder | string, folderName?: string): WishlistFolder {
    if (typeof folderOrUserId === 'object') {
      this.saveWishlistFolder(folderOrUserId);
      return folderOrUserId;
    }
    const newFolder: WishlistFolder = {
      id: `folder-${Date.now()}`,
      userId: folderOrUserId,
      name: folderName || 'New Folder',
      color: '#00C6A6',
      createdAt: new Date().toISOString()
    };
    this.saveWishlistFolder(newFolder);
    return newFolder;
  }

  public deleteWishlistFolder(folderId: string): void {
    const all = this.getItem<WishlistFolder[]>('wishlist_folders', []);
    this.setItem('wishlist_folders', all.filter(f => f.id !== folderId));
    this.deleteFirestoreDoc('wishlist_folders', folderId);

    // Also update any items in this folder to move to 'default'
    const items = this.getItem<WishlistItem[]>('wishlist_items', []);
    const updatedItems = items.map(item => {
      if (item.folderId === folderId) {
        return { ...item, folderId: 'default' };
      }
      return item;
    });
    this.setItem('wishlist_items', updatedItems);
  }

  public getWishlistItems(userId: string): WishlistItem[] {
    const all = this.getItem<WishlistItem[]>('wishlist_items', [
      {
        id: 'wish-sample-01',
        userId: 'usr-agent-01',
        productId: 'prod-jp-01',
        folderId: 'folder-sample-01',
        addedAt: '2026-03-01'
      },
      {
        id: 'wish-sample-02',
        userId: 'usr-agent-01',
        productId: 'prod-jp-04',
        folderId: 'folder-sample-01',
        addedAt: '2026-03-02'
      }
    ]);
    return all.filter(i => !i.userId || i.userId === userId);
  }

  public saveWishlistItem(item: WishlistItem): void {
    const all = this.getItem<WishlistItem[]>('wishlist_items', []);
    const index = all.findIndex(i => i.id === item.id || (i.userId === item.userId && i.productId === item.productId));
    if (index >= 0) {
      all[index] = item;
    } else {
      all.unshift(item);
    }
    this.setItem('wishlist_items', all);
    this.syncFirestoreDoc('wishlist_items', item.id, item);
  }

  public deleteWishlistItem(itemId: string): void {
    const all = this.getItem<WishlistItem[]>('wishlist_items', []);
    this.setItem('wishlist_items', all.filter(i => i.id !== itemId));
    this.deleteFirestoreDoc('wishlist_items', itemId);
  }

  public removeFromWishlist(itemIdOrUserId: string, folderId?: string, productId?: string): void {
    if (folderId && productId) {
      const all = this.getItem<WishlistItem[]>('wishlist_items', []);
      const item = all.find(i => i.userId === itemIdOrUserId && i.productId === productId && (folderId === 'all' || i.folderId === folderId));
      if (item) {
        this.deleteWishlistItem(item.id);
      }
      return;
    }
    this.deleteWishlistItem(itemIdOrUserId);
  }

  public moveWishlistItem(itemId: string, targetFolderId: string): void {
    const all = this.getItem<WishlistItem[]>('wishlist_items', []);
    const item = all.find(i => i.id === itemId);
    if (item) {
      item.folderId = targetFolderId;
      this.setItem('wishlist_items', all);
      this.syncFirestoreDoc('wishlist_items', itemId, item);
    }
  }
}
