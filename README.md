# Xbox Reviews Scraper

Extract detailed ratings and player feedback from Xbox game store pages at scale. Collect review text, reviewer profiles, rating distributions, and product metadata in one run. Built for teams doing gaming research, sentiment tracking, and market analysis.

## Features

- **Rich Review Coverage** — Collect review IDs, titles, full text, timestamps, and rating values
- **Rating Distribution Data** — Capture average rating, total ratings, and 1–5 star breakdowns
- **Helpfulness Signals** — Get helpfulness score, positive votes, and negative votes per review
- **Product Context Included** — Add game title, developer, publisher, and short description
- **Multi-URL Collection** — Process multiple Xbox product pages in a single run

## Use Cases

### Sentiment Monitoring
Track how players feel about game quality, updates, and content over time. Build dashboards that highlight sentiment shifts around launches and patches.

### Competitive Intelligence
Compare review performance across similar games and categories. Use rating mix and feedback themes to identify positioning opportunities.

### Product Research
Analyze review depth, helpfulness, and star trends before publishing game reports. Spot recurring complaints and praised features quickly.

### Content and Community Strategy
Turn authentic player feedback into article angles, social summaries, and community insights. Prioritize topics players care about most.

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startUrls` | Array | Yes | — | Xbox game store URLs to collect reviews from |
| `maxReviewsPerUrl` | Integer | No | `20` | Maximum number of reviews to return per URL |
| `proxyConfiguration` | Object | No | `{ "useApifyProxy": false }` | Optional proxy settings for stable collection |

## Output Data

Each dataset item contains:

| Field | Type | Description |
|-------|------|-------------|
| `url` | String | Source Xbox game page URL |
| `productId` | String | Product identifier extracted from URL |
| `gameTitle` | String | Game title |
| `developerName` | String | Developer name |
| `publisherName` | String | Publisher name |
| `shortDescription` | String | Short game description |
| `locale` | String | Locale used for this item |
| `orderBy` | String | Applied sort mode |
| `totalReviews` | Number | Total review count for the product |
| `averageRating` | Number | Average rating value |
| `totalRatingsCount` | Number | Total number of ratings |
| `star1Count` | Number | Number of 1-star ratings |
| `star2Count` | Number | Number of 2-star ratings |
| `star3Count` | Number | Number of 3-star ratings |
| `star4Count` | Number | Number of 4-star ratings |
| `star5Count` | Number | Number of 5-star ratings |
| `reviewId` | String | Unique review identifier |
| `reviewerName` | String | Reviewer display name |
| `rating` | Number | Review rating value |
| `reviewTitle` | String | Review headline |
| `reviewText` | String | Full review text |
| `reviewDate` | String | Review submission datetime |
| `helpfulnessVotes` | Number | Helpfulness score |
| `helpfulPositive` | Number | Positive helpful votes |
| `helpfulNegative` | Number | Negative helpful votes |
| `deviceFamily` | String | Device family associated with the review |
| `scrapedAt` | String | Extraction timestamp in ISO format |

## Usage Examples

### Basic Collection

```json
{
    "startUrls": [
        {
            "url": "https://www.xbox.com/en-US/games/store/arc-raiders/9NDF1F263RZ4/0010"
        }
    ],
    "maxReviewsPerUrl": 20
}
```

### Larger Pull Per URL

```json
{
    "startUrls": [
        {
            "url": "https://www.xbox.com/en-US/games/store/arc-raiders/9NDF1F263RZ4/0010"
        }
    ],
    "maxReviewsPerUrl": 50
}
```

### Use Optional Proxy

```json
{
    "startUrls": [
        {
            "url": "https://www.xbox.com/en-US/games/store/arc-raiders/9NDF1F263RZ4/0010"
        }
    ],
    "proxyConfiguration": {
        "useApifyProxy": true,
        "apifyProxyGroups": ["RESIDENTIAL"]
    },
    "maxReviewsPerUrl": 40
}
```

## Sample Output

```json
{
    "url": "https://www.xbox.com/en-US/games/store/arc-raiders/9NDF1F263RZ4/0010",
    "productId": "9NDF1F263RZ4",
    "gameTitle": "ARC Raiders",
    "developerName": "Embark Studios",
    "publisherName": "Embark Studios",
    "shortDescription": "Multiplayer extraction adventure set in a future Earth.",
    "locale": "en-US",
    "orderBy": "MostHelpful",
    "totalReviews": 5172,
    "averageRating": 3.5,
    "totalRatingsCount": 8450,
    "star1Count": 1320,
    "star2Count": 710,
    "star3Count": 1480,
    "star4Count": 2250,
    "star5Count": 2690,
    "reviewId": "502601a4-f8cb-eba9-d41e-bc92ea625632",
    "reviewerName": "PlayerOne",
    "rating": 4,
    "reviewTitle": "Great co-op experience",
    "reviewText": "Solid progression and satisfying gameplay loop with friends.",
    "reviewDate": "2026-02-25T08:14:53.0000000",
    "helpfulnessVotes": 0.645,
    "helpfulPositive": 14,
    "helpfulNegative": 2,
    "deviceFamily": "Windows.Xbox",
    "scrapedAt": "2026-03-03T12:22:10.000Z"
}
```

## Tips for Best Results

### Start With a Small Limit
- Use `maxReviewsPerUrl: 20` for quick validation runs
- Increase limits after confirming your URLs and filters

### Query Defaults
- Locale is fixed to `en-US`
- Reviews are sorted by `MostHelpful`
- Star filter is fixed to `NoFilter`

### Use Proxies for Stability
- Residential proxies help maintain reliable collection
- Keep proxy settings consistent across scheduled runs

## Integrations

Connect your dataset to:

- **Google Sheets** — Build shareable tracking dashboards
- **Airtable** — Create searchable game feedback repositories
- **Make** — Automate data enrichment and notifications
- **Zapier** — Trigger workflows from new review data
- **Webhooks** — Push results to your own systems

### Export Formats

- **JSON** — For analytics pipelines and apps
- **CSV** — For spreadsheet analysis
- **Excel** — For business reporting
- **XML** — For legacy integrations

## Frequently Asked Questions

### Can I run multiple game URLs in one input?
Yes. Add all store URLs into `startUrls` and the actor will process them sequentially.

### Why do some products return fewer reviews than requested?
The source may have fewer reviews than requested, or the endpoint may return less data for that product.

### What should I do if I get temporary request failures?
Use `proxyConfiguration` with residential proxies and retry the run.

### Can I change locale or sort mode from input?
Not in this simplified version. The actor uses `en-US`, `MostHelpful`, and `NoFilter`.

## Legal Notice

Use this actor responsibly and ensure your usage complies with applicable laws and website terms.
