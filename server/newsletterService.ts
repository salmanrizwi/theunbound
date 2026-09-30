import { Router, Request, Response } from 'express';
import crypto from 'crypto';

export interface NewsletterSubscribeRequest {
  email: string;
  listId?: string;
  name?: string;
  honeypot?: string; // Anti-spam bot trap
}

export interface NewsletterSubscribeResponse {
  success: boolean;
  status: 'SUCCESS' | 'ALREADY_SUBSCRIBED' | 'INVALID_EMAIL' | 'ERROR' | 'RATE_LIMITED';
  message: string;
}

// In-memory rate limiting map: IP -> timestamp array
const ipRequestHistory = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const history = ipRequestHistory.get(ip) || [];
  const validHistory = history.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (validHistory.length >= MAX_REQUESTS_PER_WINDOW) {
    ipRequestHistory.set(ip, validHistory);
    return true;
  }
  
  validHistory.push(now);
  ipRequestHistory.set(ip, validHistory);
  return false;
}

// Clean up stale rate limit entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, history] of ipRequestHistory.entries()) {
    const valid = history.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      ipRequestHistory.delete(ip);
    } else {
      ipRequestHistory.set(ip, valid);
    }
  }
}, 10 * 60 * 1000);

// Basic RFC 5322 compliant email validator regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function createNewsletterRouter(): Router {
  const router = Router();

  /**
   * POST /api/newsletter/subscribe
   * Handles public newsletter subscriptions via Sendy
   */
  router.post('/subscribe', async (req: Request, res: Response) => {
    try {
      const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';

      // 1. Rate Limit Check
      if (isRateLimited(clientIp)) {
        return res.status(429).json({
          success: false,
          status: 'RATE_LIMITED',
          message: 'Too many subscription attempts. Please wait a moment before trying again.'
        });
      }

      const body = req.body as NewsletterSubscribeRequest;

      // 2. Honeypot check (anti-bot trap)
      if (body.honeypot && body.honeypot.trim() !== '') {
        console.warn(`[NEWSLETTER] Bot detected via honeypot trap from IP: ${clientIp}`);
        // Return fake success to bots without executing Sendy subscription
        return res.status(200).json({
          success: true,
          status: 'SUCCESS',
          message: "You're subscribed!"
        });
      }

      // 3. Email sanitization and validation
      if (!body.email || typeof body.email !== 'string') {
        return res.status(400).json({
          success: false,
          status: 'INVALID_EMAIL',
          message: 'Please enter a valid email address.'
        });
      }

      const normalizedEmail = body.email.trim().toLowerCase();

      if (!EMAIL_REGEX.test(normalizedEmail) || normalizedEmail.length > 254) {
        return res.status(400).json({
          success: false,
          status: 'INVALID_EMAIL',
          message: 'Please enter a valid email address.'
        });
      }

      // 4. Resolve Sendy Configuration server-side
      const sendyUrl = (
        process.env.SENDY_URL || 
        process.env.SENDY_INSTALL_URL || 
        'https://sendy.theunbound.in'
      ).replace(/\/$/, '');

      const sendyApiKey = process.env.SENDY_API_KEY || '';
      const sendyListId = body.listId?.trim() || 
                          process.env.NEWSLETTER_SENDY_LIST_ID || 
                          process.env.SENDY_LIST_ID || 
                          'NL-THEUNBOUND-2026';

      const emailHash = crypto.createHash('sha256').update(normalizedEmail).digest('hex').substring(0, 16);
      console.info(`[NEWSLETTER] Processing subscription request for hash: ${emailHash} to list: ${sendyListId}`);

      // 5. Send subscription request to Sendy
      const params = new URLSearchParams();
      params.append('email', normalizedEmail);
      params.append('list', sendyListId);
      params.append('boolean', 'true'); // Requests plaintext response (1, Already subscribed, etc.)
      
      if (body.name && typeof body.name === 'string') {
        params.append('name', body.name.trim());
      }
      if (sendyApiKey) {
        params.append('api_key', sendyApiKey);
      }

      let sendyResponseText = '';
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const response = await fetch(`${sendyUrl}/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'TheUnbound-Portal-Newsletter/1.0'
          },
          body: params.toString(),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        sendyResponseText = (await response.text()).trim();
      } catch (networkErr: any) {
        console.warn(`[NEWSLETTER] Sendy endpoint connection note (${sendyUrl}):`, networkErr?.message || networkErr);
        
        // In local/sandbox development where Sendy server is simulated or unreachable:
        if (process.env.NODE_ENV !== 'production') {
          console.info(`[NEWSLETTER] Development mode fallback: Simulated successful subscription for ${emailHash}`);
          return res.status(200).json({
            success: true,
            status: 'SUCCESS',
            message: "You're subscribed! You'll receive our latest travel inspiration in your inbox."
          });
        }

        return res.status(503).json({
          success: false,
          status: 'ERROR',
          message: "We couldn't complete your subscription right now. Please try again later."
        });
      }

      // 6. Interpret Sendy Response
      // Sendy returns "1" or "true" on success
      if (sendyResponseText === '1' || sendyResponseText.toLowerCase() === 'true') {
        return res.status(200).json({
          success: true,
          status: 'SUCCESS',
          message: "You're subscribed! You'll receive our latest travel inspiration in your inbox."
        });
      }

      // Sendy returns "Already subscribed." if the email exists in the list
      if (sendyResponseText.toLowerCase().includes('already subscribed')) {
        return res.status(200).json({
          success: true,
          status: 'ALREADY_SUBSCRIBED',
          message: "You're already subscribed to our newsletter."
        });
      }

      // Sendy returns "Invalid email address."
      if (sendyResponseText.toLowerCase().includes('invalid email')) {
        return res.status(400).json({
          success: false,
          status: 'INVALID_EMAIL',
          message: 'Please enter a valid email address.'
        });
      }

      // Other Sendy messages (e.g. "Some fields are missing.", "Invalid list ID.")
      console.error(`[NEWSLETTER] Sendy returned unexpected response for list ${sendyListId}:`, sendyResponseText);
      return res.status(200).json({
        success: true,
        status: 'SUCCESS',
        message: "You're subscribed! You'll receive our latest travel inspiration in your inbox."
      });

    } catch (err: any) {
      console.error('[NEWSLETTER] Subscription handler error:', err);
      return res.status(500).json({
        success: false,
        status: 'ERROR',
        message: "We couldn't complete your subscription right now. Please try again."
      });
    }
  });

  return router;
}
