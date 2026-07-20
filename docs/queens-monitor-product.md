# Queens World Monitor product and content guide

## Product promise

Queens World Monitor makes a borough-scale claim concrete: a person can start with a neighborhood or street, open a sourced local story, follow that story to New York City, the United States, or the world, and then discover a current Queens Calendar event.

The primary journey is `search → story/place → people and world ties → current event`.

## Record model

- A **story** is the primary editorial record. It must have a street address, Queens coordinates, narrative, explanation of wider significance, at least one outward connection, matching terms for live events, and an institutional or official source.
- A **person** must connect to at least one story and include a source. Public prominence alone is not enough; the Queens relationship must be specific.
- A **world connection** names a destination, coordinates, and the reason it connects to the Queens story. It is evidence-bearing context, not a decorative line.
- An **event** is synchronized from the separate Queens Calendar project. The monitor does not become a second calendar authority.

## Data flow

```text
queens-calendar generated events or production API
                    ↓
       scripts/sync-queens-calendar.mjs
                    ↓
 src/queens/data/calendar-events.json
                    ↓
 search, map markers, related-event matching, event ribbon
```

The sync command prefers the local sibling repository and falls back to the public calendar API. Commit the generated snapshot so the static site remains useful if the API is unavailable.

## Adding a story

1. Add the story to `src/queens/data/stories.ts` with a stable slug-like ID.
2. Use coordinates for the exact site, not the neighborhood centroid.
3. Add at least one official or institutional source that supports the Queens relationship.
4. Add people only when their connection to the site can be supported.
5. Add narrow event terms: venue, neighborhood, person, or distinctive topic. Avoid broad terms such as `museum` unless paired with a specific place.
6. Run `npm run test:queens`, `npm run typecheck`, and `npm run build:queens`.

## Release and hosting

`npm run build:queens` creates a static deployment in `dist-queens/`. It includes both `index.html` for root hosting and `queens.html` for compatibility with local development. No secrets or server runtime are required. Deploy the contents of that directory to any static host.

The source is an AGPL-3.0-only derivative of World Monitor. Preserve `LICENSE`, `NOTICE-QUEENS.md`, upstream attribution, and source availability when distributing a hosted version.

## Coverage standard

The seed release intentionally favors well-supported records over speculative coverage. Borough-wide expansion should track neighborhood coverage explicitly and add only stories that meet the sourcing, address, and connection standards above.
