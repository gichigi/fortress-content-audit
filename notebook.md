
user should be able to group/sort by url
--
**Testing notes**
## Homepage
[Your Audit Results] = [URL Audit Results]
Remove toolbar [search issues, all issues dropdown, Customise columns], remove 3 dots options to resolve/ignore
Make "view all x issues" more of a primary CTA
Add Health score and card components 
After ignoring issue on homepage, table unresponsive
side slider when clicking issue name unnecessary
Transition back to / gracefully with fade in like the fade out to interstitial

## auth
users should be able to sign in with password too – explore the best UX for this
footer shouldn't have to exist, useres should be automatically reidrected to their dash if they're authed

## Dashboard page
No dashboard block with card components and chart anywhere to be found
Guides tab not needed
6/1 domains listed but cannot delete since they can't be found: 
> Import trace for requested module:
> ./components/health-score-chart.tsx
> ./app/dashboard/page.tsx
> DELETE /api/domains/https%3A%2F%2Fvisualizevalue.com%2F 404 in 722ms
error not using alert or toast, Nextjs error
remove back button
Links to /start which is a legacy page

Sandbox stripe payment works well but when redirected to dash got nextjs error:
Error: Failed to load guidelines
    at loadGuidelines (webpack-internal:///(app-pages-browser)/./app/dashboard/page.tsx:204:37)
    at async Promise.all (index 0)
    at async checkAuthAndLoad (webpack-internal:///(app-pages-browser)/./app/dashboard/page.tsx:179:13)

## settings
Nowhere to be found

## pricing
will be rewritten

