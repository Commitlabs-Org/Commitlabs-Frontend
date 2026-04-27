import { NextRequest } from 'next/server';
import { ok } from '@/lib/backend/apiResponse';
import { checkRateLimit } from '@/lib/backend/rateLimit';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { marketplaceService } from '@/lib/backend/services/marketplace';

/**
 * GET /api/marketplace/stats
 * 
 * Returns aggregate statistics for the marketplace including active listings,
 * average yield, median price, and breakdown by commitment type.
 * 
 * Cache-Control: public, s-maxage=60, stale-while-revalidate=30
 */
export const GET = withApiHandler(async (req: NextRequest) => {
    const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? 'anonymous';
    const isAllowed = await checkRateLimit(ip, 'api/marketplace/stats');

    if (!isAllowed) {
        return Response.json(
            { 
                success: false, 
                error: { 
                    code: 'RATE_LIMIT_EXCEEDED', 
                    message: 'Too many requests' 
                } 
            }, 
            { status: 429 }
        );
    }

    const stats = await marketplaceService.getMarketplaceStats();

    const response = ok(stats);
    
    // Add cache control headers for performance and scalability
    // Stats are aggregated and suitable for caching to reduce server load
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
    
    return response;
});
