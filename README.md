# printer-tools
## Printer sales tools

Mobile-friendly tools for printer and toner sales. Static HTML, no build step. Site files are in `public/`. Deploy that folder to Cloudflare (output directory `public`, or `npx wrangler deploy`).

- `public/index.html` – home page
- `public/quote.html` – Quote Builder (print or save as PDF)
- `public/finder.html` – Printer Finder (Brother, Lexmark, HP, Xerox, Canon, Epson)
- `public/speed.html` – Print Speed Compare
- `public/toner.html` – Toner Cost Compare
- `data/` – source spreadsheets (Canadian models, supplies, prices)

Prices are CAD from brand and retailer sites, collected November 2026.
