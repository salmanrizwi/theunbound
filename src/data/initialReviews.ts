import { GoogleReview } from '../types';

/**
 * Clean initial reviews array.
 * Strictly adheres to zero-mock rule: Real Google Business Profile reviews are synced
 * directly from the authenticated Google Business Profile API into Firestore collection 'google_reviews'.
 */
export const INITIAL_REVIEWS: GoogleReview[] = [];
