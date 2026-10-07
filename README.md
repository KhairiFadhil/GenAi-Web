# ORI — Originals, Up Close

Interactive 3D sneaker & streetwear showcase. Academic prototype for UTS Generative AI: every price, product ID, verification and order is simulated.

## Run

```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
npm run preview    # serve dist/ locally
```

## Demo codes

| Valid | Invalid |
|---|---|
| `ORI-NK-AF1-001`, `ORI-AD-SMB-001`, `ORI-NB-550-001` | `ORI-XXXX-999` |

## How the 3D works

- `src/three/shoe.js` builds a procedural low-top sneaker. Geometry is cached per silhouette, so a colorway only swaps materials.
- Each product's `model3D` in `src/data/products.json` decides how it is shown:
  - an object `{ stripe, sole, perf, colors }` → procedural shoe
  - a string `"/models/x.glb"` → any GLB, auto-scaled to the same footprint
  - `null` → photos only
- Hotspots use `"at": "toe" | "laces" | "tongue" | "collar" | "heel" | "stripe" | "stitching" | "sole"` for procedural shoes, or `"position": [x, y, z]` for GLBs.
- Stripe variants: `swoosh`, `three`, `jazz`, `tiger`, `n`, `line`, `none`.

## Product photos

Photos in `public/img/products/` are rendered from the same model. After changing a colorway, run `npm run dev`, open `/render.html` and click **Download all**. The page is dev-only and not part of the build.

## Structure

```text
src/
├── three/          procedural shoe + studio lighting (vanilla three.js)
├── components/     BrandShelf, ProductViewer, SceneKit, cards, navbar, dialogs
├── pages/          Home, Catalog, Product, Verify, Wishlist, Cart, Checkout, OrderSuccess
├── data/           products.json
└── store.js        cart, wishlist, order state in browser storage
```

`vercel.json` rewrites every route to `index.html` so `/verify/:code` links from QR codes work after a refresh.
