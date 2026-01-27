// Xbox Reviews Scraper - Extract user reviews from Xbox game pages with Playwright
import { PlaywrightCrawler, Dataset } from 'crawlee';
import { Actor, log } from 'apify';

await Actor.init();

async function main() {
    try {
        const input = (await Actor.getInput()) || {};
        const {
            startUrls = [],
            maxReviewsPerUrl: MAX_REVIEWS_RAW = 20, // Default to 20 if not set
            proxyConfiguration: proxyConfig,
        } = input;

        const MAX_REVIEWS = Number.isFinite(+MAX_REVIEWS_RAW) ? Math.max(1, +MAX_REVIEWS_RAW) : 20;

        // Create proxy configuration (residential recommended for Xbox.com)
        const proxyConfiguration = await Actor.createProxyConfiguration(proxyConfig || {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL'],
        });

        // Create Playwright crawler with Chrome configuration for dynamic content
        const crawler = new PlaywrightCrawler({
            proxyConfiguration,
            maxRequestRetries: 3,
            maxConcurrency: 1, // Sequential processing for better reliability to avoid bans
            requestHandlerTimeoutSecs: 300, // Increased timeout for loading many reviews
            navigationTimeoutSecs: 60,

            // Playwright Chrome configuration for anti-detection
            browserPoolOptions: {
                useFingerprints: true,
                fingerprintOptions: {
                    fingerprintGeneratorOptions: {
                        browsers: ['chrome'],
                        operatingSystems: ['windows', 'macos'],
                        devices: ['desktop'],
                    },
                },
            },

            // Pre-navigation hooks for stealth and resource blocking
            preNavigationHooks: [
                async ({ page }) => {
                    // Block heavy resources for better performance
                    await page.route('**/*', (route) => {
                        const type = route.request().resourceType();
                        const url = route.request().url();

                        // Block images, fonts, media, and trackers
                        if (['image', 'font', 'media'].includes(type) ||
                            url.includes('google-analytics') ||
                            url.includes('googletagmanager') ||
                            url.includes('facebook') ||
                            url.includes('doubleclick') ||
                            url.includes('adsense')) {
                            return route.abort();
                        }
                        return route.continue();
                    });

                    // Stealth: Hide webdriver property
                    await page.addInitScript(() => {
                        Object.defineProperty(navigator, 'webdriver', { get: () => false });
                        window.chrome = { runtime: {} };
                        // Additional stealth
                        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                    });
                },
            ],

            async requestHandler({ page, request }) {
                const gameUrl = request.url;
                log.info(`Processing reviews for: ${gameUrl}`);

                // Wait for page to load and stabilize
                await page.waitForLoadState('domcontentloaded');
                await page.waitForTimeout(2000); // Wait for dynamic content

                // Extract game title
                const gameTitle = await page.locator('h1').first().textContent().catch(() => 'Unknown Game') || 'Unknown Game';
                log.info(`Game title: ${gameTitle}`);

                // Navigate to Reviews section if needed (sometimes it's a tab or scroll)
                // For direct store pages, reviews are usually further down.
                // We'll rely on selectors finding them.

                // --- LOAD ALL REVIEWS STRATEGY ---
                log.info('Starting to load reviews...');

                // Selectors identified via inspection
                const LOAD_MORE_SELECTOR = 'button[class*="ReviewCards-module__loadMoreButton"]';
                const REVIEW_CONTAINER_SELECTOR = 'div[class*="ReviewCards-module__reviewCardContainer"]';

                let loadMoreAttempts = 0;
                let consecutiveErrors = 0;
                const MAX_LOAD_ATTEMPTS = 50; // Safety cap to prevent infinite loops (approx 50 * 10 = 500 reviews)
                // Adjust this based on avg reviews per page if needed, but 50 clicks is a lot.

                while (loadMoreAttempts < MAX_LOAD_ATTEMPTS) {
                    try {
                        // Check if we already have enough reviews to satisfy the request (improves speed)
                        const currentReviewCount = await page.locator(REVIEW_CONTAINER_SELECTOR).count();
                        if (currentReviewCount >= MAX_REVIEWS) {
                            log.info(`Reached target review count (${currentReviewCount} >= ${MAX_REVIEWS}). Stopping load.`);
                            break;
                        }

                        const loadMoreBtn = page.locator(LOAD_MORE_SELECTOR).first();

                        if (await loadMoreBtn.isVisible()) {
                            // Add random delay before click slightly to mimic human
                            await page.waitForTimeout(Math.floor(Math.random() * 1000) + 500);

                            await loadMoreBtn.click();
                            log.info(`Clicked "Load More" (Attempt ${loadMoreAttempts + 1}/${MAX_LOAD_ATTEMPTS})`);

                            // Wait for new content to load
                            await page.waitForTimeout(2000);
                            consecutiveErrors = 0; // Reset error count on success
                        } else {
                            log.info('"Load More" button not visible. All reviews loaded or none available.');
                            break;
                        }
                    } catch (e) {
                        consecutiveErrors++;
                        log.warning(`Error interacting with "Load More" button: ${e.message}`);
                        if (consecutiveErrors > 3) {
                            log.warning('Too many consecutive errors clicking load more. Stopping.');
                            break;
                        }
                        await page.waitForTimeout(1000);
                    }
                    loadMoreAttempts++;
                }

                // --- EXTRACT REVIEWS ---
                log.info('Extracting review data...');

                const reviews = await page.evaluate((maxReviews) => {
                    const reviewElements = Array.from(document.querySelectorAll('div[class*="ReviewCards-module__reviewCardContainer"]'));

                    return reviewElements.slice(0, maxReviews).map(el => {
                        const userNameEl = el.querySelector('div[class*="ReviewCards-module__reviewUserName"]');
                        // Rating is hidden in aria-label sometimes
                        const ratingEl = el.querySelector('div[aria-label^="Rated"], div[aria-label^="Rating of"]');
                        const textEl = el.querySelector('p[class*="ReviewCards-module__reviewText"]');
                        const dateEl = el.querySelector('p[class*="ReviewCards-module__reviewDate"]');

                        // Extract numeric rating from "Rating of 5 stars" or "Rated 4 out of 5"
                        let rating = null;
                        if (ratingEl) {
                            const ariaLabel = ratingEl.getAttribute('aria-label') || '';
                            const match = ariaLabel.match(/(\d)(\.\d)?/);
                            if (match) {
                                rating = parseFloat(match[0]);
                            }
                        }

                        // Helpful votes currently hard to find in new UI, defaulting to 0 or null
                        return {
                            reviewerName: userNameEl ? userNameEl.textContent.trim() : null,
                            rating: rating,
                            reviewText: textEl ? textEl.textContent.trim() : null,
                            reviewDate: dateEl ? dateEl.textContent.trim() : null,
                            scrapedAt: new Date().toISOString()
                        };
                    });
                }, MAX_REVIEWS);

                // Add game metadata to each review
                const enrichedReviews = reviews.map(r => ({
                    gameTitle,
                    url: gameUrl,
                    ...r
                })).filter(r => r.reviewerName || r.reviewText); // Filter empty junk

                log.info(`Extracted ${enrichedReviews.length} reviews.`);

                // Save to dataset
                await Dataset.pushData(enrichedReviews);
            },
        });

        // Run crawler for all URLs
        const requests = startUrls.map(urlObj => ({ url: urlObj.url }));
        await crawler.run(requests);

        log.info(`✅ Scraping completed!`);

    } finally {
        await Actor.exit();
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
