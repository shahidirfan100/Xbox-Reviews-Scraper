# Xbox Reviews Scraper

Extract user reviews and ratings from Xbox game store pages. Collect detailed feedback including reviewer names, ratings, review text, dates, and helpful votes. Perfect for sentiment analysis, market research, and understanding player opinions.

## Features

- **Comprehensive Review Data** — Extract reviewer names, ratings, review text, dates, and helpful votes
- **Multiple Game Support** — Scrape reviews from multiple Xbox game pages simultaneously
- **Production-Ready** — Uses prioritized data extraction (JSON API → HTML parsing) for reliability
- **Fast & Concurrent** — Processes multiple URLs concurrently for optimal performance
- **API Detection** — Automatically detects and uses review API endpoints when available
- **Structured Output** — Clean, organized review data ready for analysis and integration

## Use Cases

### Sentiment Analysis
Analyze player sentiment and feedback patterns across Xbox games. Understand what players love and what needs improvement.

### Market Research
Track review trends, rating distributions, and player opinions for gaming market analysis and business decisions.

### Content Creation
Gather authentic player reviews for gaming blogs, review aggregators, and content platforms.

### Game Development
Collect player feedback to inform game updates, patches, and future development decisions.

### Competitive Analysis
Compare review quality and player satisfaction across different games and platforms.

---

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startUrls` | Array | Yes | — | Array of Xbox game store page URLs to scrape reviews from |
| `maxReviewsPerUrl` | Integer | No | `100` | Maximum number of reviews to collect per game URL |
| `proxyConfiguration` | Object | No | — | Proxy settings for reliable scraping |

---

## Data Extraction Methods

The scraper uses a prioritized approach for maximum reliability and speed:

1. **JSON API** — Extracts reviews from embedded JSON data (`__NEXT_DATA__`) or detected API endpoints
2. **HTML Parsing** — Falls back to semantic HTML parsing with multiple selector strategies
3. **Fallback Detection** — Uses text pattern matching for edge cases

This ensures comprehensive review collection even when page structures change. |

---
## Output Data

Each item in the dataset contains:

| Field | Type | Description |
|-------|------|-------------|
| `game_title` | String | Title of the game being reviewed |
| `reviewer_name` | String | Name of the reviewer |
| `rating` | Number | Numeric rating given by the reviewer |
| `review_text` | String | Full text of the review |
| `review_date` | String | Date when the review was posted |
| `helpful_votes` | Number | Number of helpful votes the review received |
| `url` | String | URL of the game page

---
## Usage Examples

### Single Game Reviews

Extract reviews from one game:

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

### Multiple Games

Collect reviews from several games:

```json
{
    "startUrls": [
        {
            "url": "https://www.xbox.com/en-US/games/store/halo-infinite/9PPQ2KT15LCP"
        },
        {
            "url": "https://www.xbox.com/en-US/games/store/forza-horizon-5/9N5VK3Z2H6M1"
        }
    ],
    "maxReviewsPerUrl": 100
}
```

### Large Scale Collection

Gather comprehensive review data:

```json
{
    "startUrls": [
        {
            "url": "https://www.xbox.com/en-US/games/store/game-url-1"
        },
        {
            "url": "https://www.xbox.com/en-US/games/store/game-url-2"
        }
    ],
    "maxReviewsPerUrl": 200,
    "proxyConfiguration": {
        "useApifyProxy": true,
        "apifyProxyGroups": ["RESIDENTIAL"]
    }
}
```

---

## Sample Output

```json
{
    "game_title": "Arc Raiders",
    "reviewer_name": "GamerPro2023",
    "rating": 4,
    "review_text": "Great game with excellent graphics and gameplay. The story is engaging and the multiplayer is fun.",
    "review_date": "2024-01-15",
    "helpful_votes": 12,
    "url": "https://www.xbox.com/en-US/games/store/arc-raiders/9NDF1F263RZ4/0010"
}
```

---

## Tips for Best Results

### Choose Popular Games
- Select games with active review sections for better data collection
- Verify game URLs are accessible before large runs
- Test with one game first before scaling up

### Optimize Review Limits
- Start with smaller limits (50-100 reviews) for testing
- Increase for comprehensive analysis
- Balance data volume with processing time

### Use Residential Proxies
- Enable residential proxies for best reliability
- Avoid rate limiting on Xbox.com
- Ensure consistent review extraction

---

## Integrations

Connect your Xbox game data with:

- **Google Sheets** — Export for team analysis and reporting
- **Airtable** — Build searchable game databases
- **Slack** — Get notifications on new game releases
- **Webhooks** — Send data to custom applications
- **Make** — Create automated gaming workflows
- **Zapier** — Trigger actions based on game data

### Export Formats

Download data in multiple formats:

- **JSON** — For developers and API integrations
- **CSV** — For spreadsheet analysis and reporting
- **Excel** — For business intelligence dashboards
- **XML** — For system integrations and feeds

---

## Frequently Asked Questions

### How many reviews can I collect per game?
You can collect all available reviews from a game page. The practical limit depends on your Apify plan and the number of reviews available.

### Can I scrape reviews from multiple games at once?
Yes, provide multiple URLs in the `startUrls` array. The scraper will process each game page sequentially.

### What if a game has no reviews?
If a game has no reviews, the scraper will return an empty dataset for that URL. This is normal behavior.

### How often should I run the scraper?
Run frequency depends on your needs. For trending analysis, run weekly. For real-time monitoring, consider more frequent runs.

### Can I collect reviews from different Xbox regions?
The scraper works with Xbox.com regional sites. Use the appropriate regional URL in `startUrls` for localized reviews.

### Is the data real-time?
Data reflects Xbox.com at the time of scraping. For the most current reviews, run the scraper regularly.

### What proxy settings should I use?
Residential proxies provide the best reliability for Xbox.com scraping. Configure them in the `proxyConfiguration` parameter.

---

## Support

For issues or feature requests, contact support through the Apify Console.

### Resources

- [Apify Documentation](https://docs.apify.com/)
- [API Reference](https://docs.apify.com/api/v2)
- [Scheduling Runs](https://docs.apify.com/schedules)

---

## Legal Notice

This actor is designed for legitimate data collection purposes. Users are responsible for ensuring compliance with Xbox.com terms of service and applicable laws. Use data responsibly and respect rate limits.