# printer-tools
## Printer sales tools

Mobile-friendly tools for printer and toner sales. Static HTML, no build step. Site files are in `public/`. Deploy that folder to Cloudflare (output directory `public`, or `npx wrangler deploy`).

- `public/index.html` – home page
- `public/quote.html` – Quote Builder (print or save as PDF)
- `public/quote-margin.html` – Margin Quote Builder (cost plus margin or markup)
- `public/finder.html` – Printer Finder (Brother, Lexmark, HP, Xerox, Canon, Epson)
- `public/speed.html` – Print Speed Compare
- `public/toner.html` – Toner Cost Compare
- `data/` – source spreadsheets (Canadian models, supplies, prices)

Prices are CAD from brand and retailer sites, collected November 2026.

## Saved prices

The quote pages save each signed-in user's own price for each part. A Cloudflare Worker (`src/index.js`) stores them in Workers KV, keyed by the user's Cloudflare Access email. Access must stay switched on for the site, since it provides the login the Worker checks.
