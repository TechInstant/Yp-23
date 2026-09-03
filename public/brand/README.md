# Brand assets

**The official lockup is already in place** at `src/components/YP23.jpg` — the
Youth Province 23 mark, which already carries the RCCG seal, the Young Adults &
Youths crest and the words "YOUTH PROVINCE 23".

It is imported directly by `src/components/Logo.tsx` rather than served from
this folder, so Vite fingerprints it (`YP23-sdXhwslP.jpg`) and browsers can
cache it forever. Nothing needs to go in `public/brand/`.

## Replacing it

Drop a new file at `src/components/YP23.jpg` (same name) and everything — header,
footer, home page, admin sidebar, login screen — picks it up on the next build.
For a different filename or format, change the one `import` at the top of
`src/components/Logo.tsx`.

The artwork has a **white background**, so `Logo.tsx` places it on a white chip
when it sits on the navy surfaces (admin sidebar, login). If you swap in a
transparent PNG, drop the `onDark` chip styling in `BrandMark` for a cleaner look.

## Still worth adding

- `public/brand/og-image.png` (1200×630) for WhatsApp and Facebook link previews.
- A `favicon.png` cut from the seal, if you prefer it to the drawn
  `public/favicon.svg` currently referenced by `index.html`.
