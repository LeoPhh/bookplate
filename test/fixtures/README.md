# Import fixtures

Sample exports used to test **Settings → Import → From Goodreads or
StoryGraph**. They follow each service's documented export columns and
deliberately include awkward cases: series in titles, Goodreads' `="…"`
ISBNs, reviews with commas, quotes, `<br/>` and real line breaks, unrated
books, quarter-star ratings, did-not-finish, several read dates, a row with no
author, and Windows line endings.

The Goodreads file matches a real export from October 2026: no `Average
Rating` column, and ratings written as `3.0` (`0` when unrated). When a real
export turns up a difference, add the case here.
