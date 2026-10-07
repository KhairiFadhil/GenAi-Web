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

- `src/three/shoe.js` builds a procedural sneaker from a model description: last shape, collar line, throat, panels, stitching, laces with a bow, sole layers and decals. Geometry is cached per model, so a colorway only swaps materials.
- `src/three/models.js` holds the nine silhouettes (`af1`, `aj1`, `samba`, `yeezy`, `nb550`, `nb990`, `chuck`, `vans`, `mexico`).
- `src/three/textures.js` generates the leather, suede, canvas, knit and mesh maps plus the zebra knit pattern.
- Each product's `model3D` in `src/data/products.json` decides how it is shown:
  - `{ "model": "af1", "colors": { ... } }` → procedural shoe; colour roles are `base`, `toe`, `mudguard`, `heel`, `eyestay`, `collar`, `stripe`, `tab`, `tongue`, `tag`, `lace`, `mid`, `out`, `thread`, `lining`, `accent`
  - a string `"/models/x.glb"` → any GLB, auto-scaled to the same footprint
  - `null` → photos only
- Hotspots use `"at": "toe" | "laces" | "tongue" | "collar" | "heel" | "stripe" | "stitching" | "sole"` for procedural shoes, or `"position": [x, y, z]` for GLBs.
- The viewer and the photo renderer share one studio: key/fill/rim lights, room environment, ambient occlusion (N8AO) and ACES tone mapping.

## Product photos

Photos in `public/img/products/` and `public/og.webp` are rendered from the same models. After changing a model or colorway, run `npm run dev`, open `/render.html` and click **Download all**. Add `?debug` to colour every part differently, `?only=ORI-NK-AF1-001` for one product, `?views=1,2,back,above` for other angles. The page is dev-only and not part of the build.

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
