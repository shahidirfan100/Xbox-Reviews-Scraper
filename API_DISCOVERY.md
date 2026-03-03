## Selected API
- Endpoint: `https://emerald.xboxservices.com/xboxcomfd/ratingsandreviews/summaryandreviews/{productId}`
- Method: `GET`
- Auth: No auth token required, but requires request header `MS-CV` (plus standard `Accept`, `Origin`, `Referer`)
- Pagination: No true cursor/offset pagination observed; `itemCount` controls how many reviews are returned in one response
- Required query params: `locale`, `orderBy`, `itemCount`, `starFilter`
- Fields available: `ratingsSummary.averageRating`, `ratingsSummary.totalRatingsCount`, `ratingsSummary.star1Count`, `ratingsSummary.star2Count`, `ratingsSummary.star3Count`, `ratingsSummary.star4Count`, `ratingsSummary.star5Count`, `totalReviews`, and per-review fields such as `reviewId`, `productId`, `userName`, `rating`, `helpfulnessVotes`, `helpfulPositive`, `helpfulNegative`, `reviewText`, `title`, `submittedDateTime`, `deviceFamily`
- Complementary metadata endpoint: `https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds={productId}&market={market}&languages={language}`
- Field count: ~20+ review/summary fields (vs existing actor output of 9 fields)

## Existing Actor Fields (Audit)
- `gameTitle`
- `reviewerName`
- `rating`
- `reviewTitle`
- `reviewText`
- `reviewDate`
- `url`
- `productId`
- `scrapedAt`

## New Fields Added by API Approach
- `reviewId`
- `totalReviews`
- `averageRating`
- `totalRatingsCount`
- `star1Count` to `star5Count`
- `helpfulnessVotes`
- `helpfulPositive`
- `helpfulNegative`
- `deviceFamily`
- `locale`
- `orderBy`
- `developerName`
- `publisherName`
- `shortDescription`
