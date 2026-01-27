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
        const SELECTORS = {
            reviewCard: 'div[class*="ReviewCards-module__reviewCardContainer"]',
            loadMoreButton: 'button[class*="ReviewCards-module__loadMoreButton"]',
            userName: 'div[class*="ReviewCards-module__reviewUserName"]',
            rating: 'div[class*="ReviewCards-module__ratings"]',
            reviewTitle: 'p[class*="ReviewCards-module__reviewTitle"], div[class*="ReviewCards-module__reviewTitle"]',
            reviewText: 'p[class*="ReviewCards-module__reviewText"], div[class*="ReviewCards-module__reviewText"]',
            reviewDate: 'p[class*="ReviewCards-module__reviewDate"], div[class*="ReviewCards-module__reviewDate"]',
            showMoreButton: 'button[class*="ReviewCards-module__showMoreButton"]',
            noReviewsTitle: 'div[class*="ReviewCards-module__noReviewsTitle"]',
        };

        const extractProductId = (url) => {
            const match = url.match(/\/([A-Z0-9]{12})(?:\/|\?|$)/i);
            return match ? match[1].toUpperCase() : null;
        };

        const scrollToReviews = async (page) => {
            const headingCandidates = [
                'h2:has-text("Reviews")',
                'h2:has-text("REVIEWS")',
                'h2:has-text("Ratings and reviews")',
                '[class*="RatingsAndReviews-module__"]',
            ];

            for (const selector of headingCandidates) {
                const locator = page.locator(selector).first();
                if (await locator.count()) {
                    await locator.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(800);
                    return;
                }
            }

            // Fallback: gradual scroll to trigger lazy-loaded sections
            await page.evaluate(async () => {
                const distance = 800;
                const delay = 250;
                for (let i = 0; i < 10; i++) {
                    window.scrollBy(0, distance);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            });
        };
        const openReviewsTab = async (page) => {
            const tabSelectors = [
                { role: 'tab', name: /reviews/i },
                { role: 'tab', name: /ratings and reviews/i },
            ];
            for (const tab of tabSelectors) {
                const locator = page.getByRole(tab.role, { name: tab.name }).first();
                if (await locator.count()) {
                    await locator.click().catch(() => {});
                    await page.waitForTimeout(800);
                    return true;
                }
            }

            const buttonSelectors = [
                'button:has-text("Reviews")',
                'button:has-text("Ratings and reviews")',
                'a:has-text("Reviews")',
                'a:has-text("Ratings and reviews")',
            ];
            for (const selector of buttonSelectors) {
                const locator = page.locator(selector).first();
                if (await locator.count()) {
                    await locator.click().catch(() => {});
                    await page.waitForTimeout(800);
                    return true;
                }
            }
            return false;
        };

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
                    page.__reviewResponses = [];
                    page.__reviewResponseUrls = new Set();

                    page.on('response', async (response) => {
                        try {
                            const url = response.url();
                            if (!/review|rating|rnr|ratingsedge/i.test(url)) return;
                            const contentType = response.headers()['content-type'] || '';
                            if (!contentType.includes('application/json')) return;
                            if (page.__reviewResponseUrls.has(url)) return;
                            page.__reviewResponseUrls.add(url);

                            const bodyText = await response.text();
                            if (!bodyText || bodyText.length > 2_000_000) return;
                            const json = JSON.parse(bodyText);
                            page.__reviewResponses.push({ url, json });
                        } catch {
                            // Ignore parsing and network errors
                        }
                    });

                    page.on('requestfailed', (request) => {
                        const url = request.url();
                        if (/review|rating|rnr|ratingsedge/i.test(url)) {
                            log.warning(`Review API request failed: ${url}`);
                        }
                    });

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
                const productId = extractProductId(gameUrl);

                // Wait for page to load and stabilize
                await page.waitForLoadState('domcontentloaded');
                await page.waitForTimeout(2000); // Wait for dynamic content

                // Extract game title
                const gameTitle = await page.locator('h1').first().textContent().catch(() => 'Unknown Game') || 'Unknown Game';
                log.info(`Game title: ${gameTitle}`);

                // Fetch rating summary (helps debug when reviews fail to load)
                if (productId) {
                    const ratingSummary = await page.evaluate((pid) => {
                        const summary = window.__PRELOADED_STATE__?.core2?.products?.productSummaries?.[pid];
                        if (!summary) return null;
                        return { averageRating: summary.averageRating, ratingCount: summary.ratingCount };
                    }, productId);
                    if (ratingSummary) {
                        log.info(`Rating summary: ${ratingSummary.averageRating} (${ratingSummary.ratingCount} ratings)`);
                    }
                }

                // Navigate to Reviews section if needed (sometimes it's a tab or scroll)
                // For direct store pages, reviews are usually further down.
                // We'll rely on selectors finding them.

                // --- LOAD ALL REVIEWS STRATEGY ---
                log.info('Starting to load reviews...');

                // Selectors identified via inspection
                const LOAD_MORE_SELECTOR = SELECTORS.loadMoreButton;
                const REVIEW_CONTAINER_SELECTOR = SELECTORS.reviewCard;
                const NO_REVIEWS_SELECTOR = SELECTORS.noReviewsTitle;

                // Attempt to open reviews tab if present
                await openReviewsTab(page);

                // Ensure the reviews section is in view (lazy-loaded on scroll)
                await scrollToReviews(page);

                // Wait until reviews load or no-reviews state is visible
                const reviewsLoaded = await Promise.race([
                    page.waitForSelector(REVIEW_CONTAINER_SELECTOR, { timeout: 25000 }).then(() => true).catch(() => false),
                    page.waitForSelector(NO_REVIEWS_SELECTOR, { timeout: 25000 }).then(() => false).catch(() => false),
                ]);

                if (!reviewsLoaded) {
                    log.warning('Reviews section did not load within timeout. Continuing with extraction anyway.');
                }

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

                        if (!(await loadMoreBtn.isVisible().catch(() => false))) {
                            await loadMoreBtn.scrollIntoViewIfNeeded().catch(() => {});
                        }

                        if (await loadMoreBtn.isVisible().catch(() => false)) {
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

                // Expand "show more" to capture full text where available
                await page.evaluate((selector) => {
                    document.querySelectorAll(selector).forEach((btn) => {
                        try {
                            btn.click();
                        } catch {
                            // Ignore failures for hidden/disabled buttons
                        }
                    });
                }, SELECTORS.showMoreButton);
                await page.waitForTimeout(500);

                const reviews = await page.evaluate(({ maxReviews, selectors }) => {
                    const reviewElements = Array.from(document.querySelectorAll(selectors.reviewCard));

                    return reviewElements.slice(0, maxReviews).map(el => {
                        const userNameEl = el.querySelector(selectors.userName);
                        const titleEl = el.querySelector(selectors.reviewTitle);
                        const ratingEl = el.querySelector(selectors.rating) || el.querySelector('[aria-label*="star" i], [aria-label*="rating" i]');
                        const textEl = el.querySelector(selectors.reviewText);
                        const dateEl = el.querySelector(selectors.reviewDate);

                        // Extract numeric rating from "Rating of 5 stars" or "Rated 4 out of 5"
                        let rating = null;
                        if (ratingEl) {
                            const ariaLabel = ratingEl.getAttribute('aria-label') || ratingEl.textContent || '';
                            const match = ariaLabel.match(/([0-5](?:\\.\\d)?)/);
                            if (match) {
                                rating = parseFloat(match[0]);
                            }
                        }

                        // Helpful votes currently hard to find in new UI, defaulting to 0 or null
                        return {
                            reviewerName: userNameEl ? userNameEl.textContent.trim() : null,
                            rating: rating,
                            reviewTitle: titleEl ? titleEl.textContent.trim() : null,
                            reviewText: textEl ? textEl.textContent.trim() : null,
                            reviewDate: dateEl ? dateEl.textContent.trim() : null,
                            scrapedAt: new Date().toISOString()
                        };
                    });
                }, { maxReviews: MAX_REVIEWS, selectors: SELECTORS });

                // Add game metadata to each review
                const enrichedReviews = reviews.map(r => ({
                    gameTitle,
                    url: gameUrl,
                    productId,
                    ...r
                })).filter(r => r.reviewerName || r.reviewText); // Filter empty junk

                const extractFromJson = (payload) => {
                    const results = [];
                    const stack = [payload];
                    while (stack.length) {
                        const current = stack.pop();
                        if (!current) continue;
                        if (Array.isArray(current)) {
                            for (const item of current) stack.push(item);
                            continue;
                        }
                        if (typeof current === 'object') {
                            const keys = Object.keys(current);
                            const hasRating = keys.some((k) => /rating|star|score/i.test(k));
                            const hasText = keys.some((k) => /review|comment|text|body/i.test(k));
                            if (hasRating && hasText) {
                                results.push(current);
                            }
                            for (const value of Object.values(current)) stack.push(value);
                        }
                    }
                    return results;
                };

                const normalizeReview = (raw) => {
                    const ratingValue = raw.rating ?? raw.starRating ?? raw.ratingValue ?? raw.score ?? null;
                    const maybeDate = raw.reviewDate ?? raw.submittedDateTime ?? raw.createdAt ?? raw.date ?? null;
                    const reviewDate = typeof maybeDate === 'number'
                        ? new Date(maybeDate).toISOString()
                        : (maybeDate ? String(maybeDate) : null);
                    return {
                        reviewerName: raw.reviewerName ?? raw.userName ?? raw.gamertag ?? raw.author ?? raw.user?.name ?? null,
                        rating: Number.isFinite(+ratingValue) ? +ratingValue : null,
                        reviewTitle: raw.reviewTitle ?? raw.title ?? raw.headline ?? null,
                        reviewText: raw.reviewText ?? raw.text ?? raw.comment ?? raw.body ?? null,
                        reviewDate,
                        scrapedAt: new Date().toISOString(),
                    };
                };

                let finalReviews = enrichedReviews;
                if (finalReviews.length === 0 && page.__reviewResponses?.length) {
                    const apiReviews = [];
                    for (const entry of page.__reviewResponses) {
                        const found = extractFromJson(entry.json);
                        apiReviews.push(...found);
                    }
                    const mapped = apiReviews.map(normalizeReview);
                    finalReviews = mapped
                        .map(r => ({ gameTitle, url: gameUrl, productId, ...r }))
                        .filter(r => r.reviewerName || r.reviewText);
                    if (finalReviews.length) {
                        log.info(`Extracted ${finalReviews.length} reviews from API responses.`);
                    }
                }

                log.info(`Extracted ${finalReviews.length} reviews.`);

                // Save to dataset
                await Dataset.pushData(finalReviews);
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
    log.exception(err, 'Actor failed');
    process.exit(1);
});
