import { Router, Request, Response } from 'express';
import { verifyAdminBearerToken } from './performanceMiddleware';
import {
  parseAndValidateYouTubeUrl,
  getYouTubeEmbedUrl,
  getYouTubeWatchUrl,
  getYouTubeThumbnailCandidates,
} from '../src/utils/youtubeValidation';

/**
 * Authenticated Admin CMS router for validating YouTube URLs server-side.
 * Mounted at /api/admin/homepage
 *
 * Security notes:
 * - Strictly requires a verified Admin/CMS Firebase Bearer token (401/403 otherwise).
 * - Strictly validates YouTube URL & 11-character video ID before any outbound check.
 * - Outbound oEmbed check is SSRF-locked exclusively to https://www.youtube.com/oembed
 *   with an encoded validated 11-character video ID and a 5-second timeout.
 */
export function createHomepageVideoRouter(): Router {
  const router = Router();

  router.post('/validate-youtube', async (req: Request, res: Response) => {
    const authCheck = await verifyAdminBearerToken(req);
    if (authCheck.ok === false && 'status' in authCheck) {
      return res.status(authCheck.status).json({ valid: false, error: authCheck.error });
    }

    const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
    const parsed = parseAndValidateYouTubeUrl(rawUrl);

    if (!parsed.valid || !parsed.videoId) {
      return res.status(400).json({
        valid: false,
        error: parsed.error || 'Invalid YouTube video URL.',
      });
    }

    const videoId = parsed.videoId;
    const watchUrl = getYouTubeWatchUrl(videoId);
    const embedUrl = getYouTubeEmbedUrl(videoId);
    const thumbnails = getYouTubeThumbnailCandidates(videoId);

    // Perform SSRF-safe YouTube oEmbed lookup to check availability & embeddability
    let availabilityStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'EMBED_DISABLED' | 'UNVERIFIED' = 'UNVERIFIED';
    let title: string | undefined;
    let authorName: string | undefined;
    let oembedThumbnail: string | undefined;
    let embeddable = true;
    let warning: string | undefined;

    try {
      const oembedEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
      const oembedRes = await fetch(oembedEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (oembedRes.ok) {
        const data: any = await oembedRes.json();
        availabilityStatus = 'AVAILABLE';
        embeddable = true;
        title = typeof data?.title === 'string' ? data.title : undefined;
        authorName = typeof data?.author_name === 'string' ? data.author_name : undefined;
        if (typeof data?.thumbnail_url === 'string' && data.thumbnail_url.startsWith('https://')) {
          oembedThumbnail = data.thumbnail_url;
        }
      } else if (oembedRes.status === 401 || oembedRes.status === 403) {
        availabilityStatus = 'EMBED_DISABLED';
        embeddable = false;
        warning = 'This YouTube video has embedding disabled or is restricted. Visitors will see a fallback link to watch on YouTube.';
      } else if (oembedRes.status === 404 || oembedRes.status === 400) {
        availabilityStatus = 'UNAVAILABLE';
        embeddable = false;
        return res.status(422).json({
          valid: false,
          videoId,
          canonicalUrl: watchUrl,
          availabilityStatus,
          embeddable: false,
          error: 'This YouTube video appears unavailable, private, or deleted. Please verify the video visibility on YouTube.',
        });
      }
    } catch {
      availabilityStatus = 'UNVERIFIED';
      warning = 'YouTube URL format is valid. Live availability could not be checked right now due to network timeout.';
    }

    return res.status(200).json({
      valid: true,
      videoId,
      canonicalUrl: watchUrl,
      embedUrl,
      thumbnailUrl: oembedThumbnail || thumbnails[0],
      availabilityStatus,
      embeddable,
      title,
      authorName,
      warning,
    });
  });

  return router;
}
