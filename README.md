# printer-tools
## Printer sales tools

Mobile-friendly tools for printer and toner sales. Static HTML, no build step. Site files are in `public/`. Deploy that folder to Cloudflare (output directory `public`, or `npx wrangler deploy`).

- `public/index.html` – home page
- `public/quote.html` – Quote Builder (print or save as PDF)
- `public/quote-margin.html` – Margin Quote Builder (cost plus margin or markup)
- `public/finder.html` – Printer Finder (Brother, Lexmark, HP, Xerox, Canon, Epson)
- `public/compare.html` – Machine Compare (spec comparison)
- `public/partfinder.html` – Part Number Lookup
- `public/toner.html` – Toner Cost Compare
- `data/` – source spreadsheets (Canadian models, supplies, prices)

Prices are CAD from brand and retailer sites, collected November 2026.

## Saved prices

The quote pages save each signed-in user's own price for each part, and one logo per user (shown on the printed quote). A Cloudflare Worker (`src/index.js`) stores them in Workers KV, keyed by the user's Cloudflare Access email. Access must stay switched on for the site, since it provides the login the Worker checks.

## Clients

Both quote tools have a Client card (shown once signed in). "Save to client" stores the current quote under the Customer name, per login, in KV (`cl:<email>`). Picking a saved client reloads their quote. The two quote tools share the client list but keep a separate saved quote each. API: `GET/PUT/DELETE /api/clients`.

## Client Supplies

`supplies.html` lists the printers on a saved client's quotes and the toner and drum each one takes, with a copy/print part list. It reads `/api/clients`. Printer lookups use the same DATA order as the quote tools, so add new printers to the end of the list in all of them.
