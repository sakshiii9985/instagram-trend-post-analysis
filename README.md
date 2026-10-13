<<<<<<< HEAD
# PostPulse — Instagram trend & post analysis

A simple, responsive static prototype inspired by the supplied Figma design. It uses illustrative sample data only and does not connect to Instagram or any external service.

## Figma prototype

[Open the interactive prototype](https://www.figma.com/make/DwLm9wFBk9FSgmtmWjrgYw/Instagram-Trend-Analysis-Prototype?fullscreen=1&t=eFn01Hyy2bzJ9ZKb-1&code-node-id=0-6)

## Run locally

Open `index.html` in a browser. No build step or dependencies are required.

## Included

- Profile entry screen with sample, empty, and error test states
- Overview with profile metrics, engagement chart, and recent posts
- Top post filters, caption search, sorting, and result limits
- Hashtag frequency, descriptive analysis, recommendations, and a small Q&A view

The dashboard loads the saved example dataset for any non-empty username so the prototype can be explored without an API.
=======
# Instagram Trend and Post Analysis --- TrendVision AI

TrendVision AI is a web application that stores publicly available
Instagram profile and post data in MongoDB and displays analytics based
on the saved records.

The application uses Bright Data to collect profile and post data only
when an explicit fetch or refresh action is requested. Dashboard
navigation and analytics use MongoDB and do not trigger scraping.

## Features

-   Fetch public Instagram profile information using a username or
    profile URL.
-   Fetch up to a requested number of public posts through Bright Data.
-   Save profile and post records in MongoDB.
-   Reuse saved data when it is available.
-   Explicitly refresh profile or post data when required.
-   View an overview of available profile and engagement metrics.
-   Rank saved posts by engagement, likes, comments, views, or date.
-   Explore hashtag frequency and observed engagement patterns.
-   Classify saved posts as Low, Medium, or High engagement using fuzzy
    membership scores relative to the saved profile dataset.
-   View data-based recommendations.
-   Ask supported questions about saved posts, fuzzy categories,
    hashtags, and recommendations through the chatbot.

## Technology stack

-   **Frontend:** React, TypeScript, Vite
-   **Backend:** Node.js, Express
-   **Database:** MongoDB
-   **Instagram data collection:** Bright Data Instagram Scraper API
-   **API communication:** HTTP requests through Axios/Fetch
-   **Configuration:** environment variables in `backend/.env`

## Requirements

Install the following before running the project:

-   Node.js and npm
-   MongoDB running locally or at a MongoDB URI you can access
-   Bright Data API token
-   Bright Data dataset IDs for Instagram Profiles and Instagram Posts

Check your installation:

``` sh
node --version
npm --version
```

## Configuration

1.  From the project root, locate `backend/.env.example`.

2.  If `backend/.env` does not exist, copy the example file:

    **Windows PowerShell**

    ``` powershell
    Copy-Item backend/.env.example backend/.env
    ```

    **macOS/Linux**

    ``` sh
    cp backend/.env.example backend/.env
    ```

3.  Open `backend/.env` and set the required values. Keep any existing
    environment variable names used by your project.

Example configuration:

``` env
BRIGHTDATA_API_TOKEN=YOUR_BRIGHTDATA_API_TOKEN
BRIGHTDATA_PROFILE_DATASET_ID=YOUR_PROFILE_DATASET_ID
BRIGHTDATA_POSTS_DATASET_ID=YOUR_POSTS_DATASET_ID

MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=trendvision_ai
PORT=4000
```

Replace the placeholder values with the credentials and dataset IDs from
your Bright Data account. Dataset IDs normally begin with `gd_`. Use the
exact variable names expected by your existing backend and
`.env.example`.

**Security notes** - Never put the Bright Data token in a frontend
environment file. - Never commit `backend/.env` or publish the token in
GitHub. - Keep `backend/.env` ignored by Git. - Do not paste the token
into screenshots, public issues, or chat messages. - If a token is
exposed, revoke it and create a replacement.

## Run the application locally

Run these commands from the **project root** (the directory containing
the root `package.json`):

``` sh
npm install
npm run dev
```

The development setup should make the following available:

-   Frontend: <http://localhost:5173>
-   Backend API: <http://localhost:4000>

If `npm run dev` does not start both the frontend and backend, check the
root `package.json` scripts and follow the scripts defined in your
repository. Do not assume a script exists if it is not listed there.

Make sure MongoDB is running before testing the API. After editing
`.env`, restart the backend so it reloads the environment variables.

## Data collection and caching behavior

### Analyze Profile

-   The user submits a username or profile URL.
-   The backend checks for saved profile data.
-   If a saved profile exists, the application reuses it.
-   If no saved profile exists, the backend can fetch profile data
    through Bright Data and save the result to MongoDB.

### Refresh Data

Refresh is the explicit action for requesting updated profile or post
data. It may use Bright Data and therefore may consume credits.

### Dashboard navigation

Opening or refreshing the frontend and navigating between dashboard
pages should issue MongoDB-backed GET requests only. GET endpoints do
not call Bright Data.

### Current collection limits and availability

-   The posts API accepts a requested limit. For a review/demo, the
    intended analysis size is up to **25 posts** when the Bright Data
    scraper returns that many records and the request/configuration
    permits it.
-   Returned counts may be lower when the source has fewer available
    records or the scraper returns fewer records.
-   Reels are MongoDB-read-only; a Bright Data Reels fetcher is not
    enabled in the current workflow.
-   Bright Data comment fetching is paused while credits are exhausted.
-   Only data returned by Bright Data is displayed. Missing values,
    empty results, scraper errors, or database save errors should not be
    replaced with fabricated data.

## Dashboard pages

The current dashboard navigation contains:

1.  **Overview** --- saved profile details and available aggregate
    metrics.
2.  **Top Posts** --- ranks saved posts using engagement or another
    selected sort metric.
3.  **Hashtags** --- hashtag frequency and observed patterns in the
    saved dataset.
4.  **Analysis** --- engagement and fuzzy analysis based on stored
    posts.
5.  **Recommendations** --- observations derived from the saved dataset.
6.  **Chatbot** --- answers supported questions using saved post data.

Content Analysis, Sentiment Analysis, ML Prediction, Settings, and
Architecture are not exposed as dashboard pages in the current UI.

## Analytics notes

### Engagement score

The default post engagement score is:

``` text
Engagement Score = Likes + (2 × Comments)
```

This is a project-defined comparison score, not an official Instagram
metric.

### Fuzzy engagement classification

Saved posts are assigned Low, Medium, or High engagement labels using
fuzzy membership scores normalized relative to the current saved-profile
dataset.

This is descriptive classification of existing posts. It is **not** a
trained model and does not predict future engagement. Scores and labels
can change when the saved dataset changes.

### Recommendations

Recommendations describe patterns observed in the saved data. They do
not prove that a hashtag, posting time, or content type caused higher
engagement, and they do not guarantee future performance.

### Machine learning and image classification

-   Random Forest and AdaBoost are not trained or configured in the
    current version.
-   Image category classification is not configured. The application may
    report image URL availability, but it does not invent image
    categories.
-   The current project does not use Python for these unimplemented
    models.

### Sentiment data

Comment fetching is paused while Bright Data credits are exhausted. Any
existing sentiment labels are read from MongoDB only. Existing labels
may have been produced by a basic English word/emoji lexicon and are
approximate; they are not the output of a trained sentiment model.
Comment collection and the sentiment page are not part of the current
dashboard navigation.

## API endpoints

The following endpoints are documented by the current project setup. GET
endpoints read saved data from MongoDB and do not call Bright Data.

  ------------------------------------------------------------------------------------------------------------------------
  Method                  Endpoint                                                                 Purpose
 
  GET                     `/api/instagram/profile/:username`                                       Read a saved profile

  GET                     `/api/instagram/posts/:username?limit=10`                                Read saved posts

  GET                     `/api/instagram/reels/:username`                                         Read saved reels, if
                                                                                                   present in MongoDB

  GET                     `/api/instagram/comments/:postId`                                        Read saved comments

  GET                     `/api/analytics/overview/:username`                                      Read overview analytics

  GET                     `/api/analytics/top-posts/:username?limit=5&sort=Engagement&media=All`   Read and sort saved top
                                                                                                   posts

  GET                     `/api/analytics/fuzzy/:username`                                         Read fuzzy engagement
                                                                                                   results

  GET                     `/api/recommendations/:username`                                         Read data-based
                                                                                                   recommendations

  POST                    `/api/instagram/profile`                                                 Explicitly fetch/update
                                                                                                   a profile

  POST                    `/api/instagram/posts`                                                   Explicitly fetch/update
                                                                                                   posts

  POST                    `/api/chatbot`                                                           Ask a question about
                                                                                                   saved data
  ------------------------------------------------------------------------------------------------------------------------

Additional notes: - Top-post sorting supports the options implemented by
the backend, including engagement, metric/date sorting, media filters
(`All`, `Posts`, `Reels`) and limits of 5, 10, or 20. - If Bright Data
comment fetching is disabled due to exhausted credits, the disabled
operation should return HTTP `503` without contacting Bright Data. - The
comments GET endpoint reads existing MongoDB records only.

## Test the profile endpoint

Run this from a terminal while the backend is running:

``` sh
curl -X POST http://localhost:4000/api/instagram/profile \
  -H "Content-Type: application/json" \
  -d '{"username":"aliaabhatt"}'
```

You can also send a profile URL:

``` sh
curl -X POST http://localhost:4000/api/instagram/profile \
  -H "Content-Type: application/json" \
  -d '{"profileUrl":"https://www.instagram.com/aliaabhatt/"}'
```

A successful response should indicate success and include the profile
read back from MongoDB after the update. The profile is stored in the
MongoDB `profiles` collection.

## Test the posts endpoint

Request up to 25 posts:

``` sh
curl -X POST http://localhost:4000/api/instagram/posts \
  -H "Content-Type: application/json" \
  -d '{"username":"aliaabhatt","limit":25}'
```

Or provide a profile URL:

``` sh
curl -X POST http://localhost:4000/api/instagram/posts \
  -H "Content-Type: application/json" \
  -d '{"profileUrl":"https://www.instagram.com/aliaabhatt/","limit":25}'
```

The response should contain `success`, the actual returned `count`, and
the saved `posts` array. The count may be lower than 25 depending on
available results. Post records are stored in MongoDB's `instagramposts`
collection using a stable post ID/URL-derived key.

## Common troubleshooting

### Missing Bright Data environment variables

-   Confirm `backend/.env` exists and uses the variable names expected
    by the backend.
-   Check for spelling mistakes and remove extra spaces around `=`.
-   Restart the backend after changing `.env`.

### MongoDB connection error

-   Confirm MongoDB is running.
-   Verify `MONGODB_URI` and `MONGODB_DB_NAME`.
-   Confirm the backend can connect to the configured database.

### Bright Data request fails

-   Verify the API token and the Profile/Posts dataset IDs.
-   Confirm the selected scraper expects the input format being sent.
-   Check Bright Data's dashboard for run status, credits, and error
    details.
-   Avoid repeatedly clicking Analyze or Refresh while debugging because
    explicit fetch operations may consume credits.

### No posts returned

-   Confirm the profile is public and the scraper returned records.
-   Check the backend logs and Bright Data run result.
-   The application should show an empty/error state rather than
    fabricate posts.

### Frontend or backend does not start

-   Run commands from the project root.
-   Check the `scripts` section in `package.json`.
-   Ensure dependencies installed successfully and ports `5173` and
    `4000` are available.

## Project limitations

-   Only public data returned by Bright Data is available; private
    account data is not implied.
-   The number of posts returned is not guaranteed to be exactly 25.
-   Reels are not fetched from Bright Data in the current workflow.
-   Comment scraping is paused while credits are exhausted.
-   Fuzzy classification is relative and descriptive.
-   Random Forest, AdaBoost, and image-category classification are not
    currently implemented.
-   Recommendations are observations, not causal conclusions or
    guarantees.



In powershell run:
cd "C:\Users\Sakshi\Desktop\instagram"
npm run dev

Make sure MongoDB is running first. The frontend opens at http://localhost:5173; the backend runs at http://localhost:4000.
>>>>>>> ed6fd64 (Initial commit)
