import { Actor } from 'apify';
import { log } from 'apify';
import { Dataset } from 'crawlee';
import { gotScraping } from 'got-scraping';

const REVIEW_API_BASE = 'https://emerald.xboxservices.com/xboxcomfd/ratingsandreviews/summaryandreviews';
const PRODUCT_API_BASE = 'https://displaycatalog.mp.microsoft.com/v7.0/products';
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_ORDER_BY = 'MostHelpful';
const DEFAULT_STAR_FILTER = 'NoFilter';
const DEFAULT_MS_CV = 'DGU1mcuYo0WMMp+F.1';
const MAX_REVIEWS_PER_REQUEST = 25;

const extractProductId = (url) => {
    const match = url.match(/\/([A-Z0-9]{12})(?:\/|\?|$)/i);
    return match ? match[1].toUpperCase() : null;
};

const localeToMarket = (locale) => {
    const parts = locale.split('-');
    return (parts[1] || 'US').toUpperCase();
};

const localeToLanguage = (locale) => locale.toLowerCase();

const getRequestUrl = (startUrlItem) => {
    if (typeof startUrlItem === 'string') return startUrlItem;
    if (startUrlItem && typeof startUrlItem.url === 'string') return startUrlItem.url;
    return null;
};

const buildHeaders = (msCvHeader) => ({
    Accept: 'application/json',
    Origin: 'https://www.xbox.com',
    Referer: 'https://www.xbox.com/',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0',
    'MS-CV': msCvHeader || DEFAULT_MS_CV,
    'x-ms-api-version': '1.0',
});

const buildContinuationHeader = (productId, skipCount) => {
    const payload = JSON.stringify({ ProductId: productId, SkipCount: skipCount });
    return Buffer.from(payload, 'utf8').toString('base64');
};

const fetchJson = async ({ url, headers, proxyUrl }) => {
    const response = await gotScraping.get(url, {
        headers,
        proxyUrl,
        timeout: { request: 30000 },
        throwHttpErrors: false,
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`HTTP ${response.statusCode}: ${response.body?.slice(0, 250) || 'Request failed'}`);
    }

    try {
        return JSON.parse(response.body);
    } catch {
        throw new Error('Invalid JSON response received from API');
    }
};

const fetchReviewsWithPagination = async ({
    productId,
    locale,
    orderBy,
    starFilter,
    maxReviewsPerUrl,
    headers,
    proxyUrl,
}) => {
    const pageSize = Math.min(Math.max(maxReviewsPerUrl, 1), MAX_REVIEWS_PER_REQUEST);
    const aggregatedReviews = [];
    const seenReviewIds = new Set();
    let ratingsSummary = null;
    let totalReviews = null;
    let skipItems = 0;
    let page = 0;

    while (aggregatedReviews.length < maxReviewsPerUrl) {
        const params = new URLSearchParams({
            locale,
            orderBy,
            itemCount: String(pageSize),
            starFilter,
        });
        const reviewsUrl = `${REVIEW_API_BASE}/${productId}?${params.toString()}`;
        const requestHeaders = skipItems > 0
            ? { ...headers, 'x-ms-ct': buildContinuationHeader(productId, skipItems) }
            : headers;
        const response = await fetchJson({ url: reviewsUrl, headers: requestHeaders, proxyUrl });
        const batch = Array.isArray(response?.reviews) ? response.reviews : [];

        if (!ratingsSummary) ratingsSummary = response?.ratingsSummary || {};
        if (totalReviews === null || totalReviews === undefined) totalReviews = response?.totalReviews ?? null;

        if (batch.length === 0) break;

        let uniqueAdded = 0;
        for (const review of batch) {
            const reviewId = review?.reviewId || `${skipItems}-${uniqueAdded}`;
            if (seenReviewIds.has(reviewId)) continue;
            seenReviewIds.add(reviewId);
            aggregatedReviews.push(review);
            uniqueAdded++;

            if (aggregatedReviews.length >= maxReviewsPerUrl) break;
        }

        // If no unique records were added, pagination isn't advancing.
        if (uniqueAdded === 0) break;

        skipItems += batch.length;
        page++;

        // Hard stop to avoid infinite loops on unexpected API behavior.
        if (page >= 20 || batch.length < pageSize) break;
    }

    return {
        ratingsSummary: ratingsSummary || {},
        totalReviews,
        reviews: aggregatedReviews.slice(0, maxReviewsPerUrl),
    };
};

await Actor.init();

try {
    const input = (await Actor.getInput()) || {};
    const {
        startUrls = [],
        maxReviewsPerUrl: maxReviewsRaw = 20,
        proxyConfiguration: proxyConfig,
    } = input;

    if (!Array.isArray(startUrls) || startUrls.length === 0) {
        throw new Error('Input `startUrls` must be a non-empty array.');
    }

    const maxReviewsPerUrl = Number.isFinite(+maxReviewsRaw) ? Math.max(1, +maxReviewsRaw) : 20;
    const locale = DEFAULT_LOCALE;
    const orderBy = DEFAULT_ORDER_BY;
    const starFilter = DEFAULT_STAR_FILTER;
    const market = localeToMarket(locale);
    const language = localeToLanguage(locale);

    const shouldUseProxy = Boolean(
        proxyConfig
            && (proxyConfig.useApifyProxy === true || (Array.isArray(proxyConfig.proxyUrls) && proxyConfig.proxyUrls.length > 0)),
    );
    const proxy = shouldUseProxy ? await Actor.createProxyConfiguration(proxyConfig) : undefined;
    const headers = buildHeaders(DEFAULT_MS_CV);

    let totalSaved = 0;
    let processedUrls = 0;

    if (shouldUseProxy) {
        log.info('Proxy is enabled for this run.');
    } else {
        log.info('Proxy is disabled for this run.');
    }

    for (const startUrlItem of startUrls) {
        const gameUrl = getRequestUrl(startUrlItem);
        if (!gameUrl) {
            log.warning('Skipping invalid start URL item because `url` is missing.');
            continue;
        }

        const productId = extractProductId(gameUrl);
        if (!productId) {
            log.warning(`Skipping URL because productId was not found: ${gameUrl}`);
            continue;
        }

        const proxyUrl = proxy ? await proxy.newUrl() : undefined;
        const productUrl = `${PRODUCT_API_BASE}?bigIds=${encodeURIComponent(productId)}&market=${encodeURIComponent(market)}&languages=${encodeURIComponent(language)}`;

        log.info(`Fetching reviews for ${productId} (${locale})`);

        let reviewsResponse;
        try {
            reviewsResponse = await fetchReviewsWithPagination({
                productId,
                locale,
                orderBy,
                starFilter,
                maxReviewsPerUrl,
                headers,
                proxyUrl,
            });
        } catch (error) {
            log.error(`Failed reviews API request for ${productId}: ${error.message}`);
            continue;
        }

        let productResponse = null;
        try {
            productResponse = await fetchJson({
                url: productUrl,
                headers: {
                    ...headers,
                    Origin: 'https://www.microsoft.com',
                    Referer: 'https://www.microsoft.com/',
                },
                proxyUrl,
            });
        } catch (error) {
            log.warning(`Product metadata request failed for ${productId}: ${error.message}`);
        }

        const product = productResponse?.Products?.[0] || null;
        const localizedProduct = product?.LocalizedProperties?.[0] || {};
        const ratingsSummary = reviewsResponse?.ratingsSummary || {};
        const reviews = Array.isArray(reviewsResponse?.reviews) ? reviewsResponse.reviews : [];

        if (reviews.length === 0) {
            log.info(`No reviews returned for ${productId}.`);
            processedUrls++;
            continue;
        }

        const items = reviews.slice(0, maxReviewsPerUrl).map((review) => ({
            url: gameUrl,
            productId,
            gameTitle: localizedProduct?.ProductTitle || product?.ProductTitle || null,
            developerName: localizedProduct?.DeveloperName || null,
            publisherName: localizedProduct?.PublisherName || null,
            shortDescription: localizedProduct?.ShortDescription || null,
            locale,
            orderBy,
            totalReviews: reviewsResponse?.totalReviews ?? null,
            averageRating: ratingsSummary?.averageRating ?? null,
            totalRatingsCount: ratingsSummary?.totalRatingsCount ?? null,
            star1Count: ratingsSummary?.star1Count ?? null,
            star2Count: ratingsSummary?.star2Count ?? null,
            star3Count: ratingsSummary?.star3Count ?? null,
            star4Count: ratingsSummary?.star4Count ?? null,
            star5Count: ratingsSummary?.star5Count ?? null,
            reviewId: review?.reviewId ?? null,
            reviewerName: review?.userName ?? null,
            rating: review?.rating ?? null,
            reviewTitle: review?.title ?? null,
            reviewText: review?.reviewText ?? null,
            reviewDate: review?.submittedDateTime ?? null,
            helpfulnessVotes: review?.helpfulnessVotes ?? null,
            helpfulPositive: review?.helpfulPositive ?? null,
            helpfulNegative: review?.helpfulNegative ?? null,
            deviceFamily: review?.deviceFamily ?? null,
            scrapedAt: new Date().toISOString(),
        }));

        await Dataset.pushData(items);
        totalSaved += items.length;
        processedUrls++;

        log.info(`Saved ${items.length} reviews for ${productId}. Running total: ${totalSaved}`);
    }

    log.info(`Extraction complete. Processed URLs: ${processedUrls}. Total reviews saved: ${totalSaved}`);
} catch (error) {
    log.exception(error, 'Actor failed');
    process.exitCode = 1;
} finally {
    await Actor.exit();
}
