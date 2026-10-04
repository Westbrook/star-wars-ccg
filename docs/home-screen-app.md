# Holotable on the Home Screen

On iPhone or iPad, open the private site in Safari, sign in, then use **Share → Add to Home Screen**. Leave **Open as Web App** enabled when offered and tap **Add**. Open the new Holotable icon to launch without the browser address bar or tabs. The app's **Install app** button includes these steps; browsers that expose an install prompt also receive an install action.

The operating system retains control over status indicators, the Home indicator, multitasking and installation. Standalone mode does not require the Fullscreen API. Internet access and site authorization are still required; installation may require signing in again. This iteration does not add offline gameplay or cache private API responses.

## Identity and layout

- `/manifest.json`: stable root ID, root start URL and scope, standalone display, both orientations, dark launch/theme colors, PNG and maskable icons, and archive/deck/Rules Lab shortcuts on browsers that support them. Root launch excludes incidental game IDs and developer-report query parameters.
- The manifest link uses `crossorigin="use-credentials"` because the hosted origin is private. Root metadata supplies Apple capability/title/status-bar tags and 180, 167 and 152 px touch icons on all routes.
- `public/icons/holotable.svg` is the app artwork. The essential card/reticle identity sits inside the maskable safe circle; the background is opaque and corners are left for the OS to mask. The simpler favicon preserves legibility at small sizes. Regenerate raster assets with `node scripts/generate-app-icons.mjs` using the pinned Playwright browser.
- `app/installed-app.css` protects content, fixed navigation and dialogs with all four safe-area insets and dynamic viewport sizing. Pinch zoom remains enabled.

## Verification

Run a preview, then `BASE_URL=http://localhost:5173 node tests/installed-app-browser.mjs`. This uses the locked Playwright version and its Chromium/WebKit builds, isolated contexts and a rules-service status fixture. It checks served metadata across routes, manifest parsing and image dimensions, install guidance/dismissal/focus, installed-mode suppression and phone/tablet/landscape bounds.

Physical-device review remains necessary: install from the owner-private production site on an iPhone and iPad, inspect the Home Screen icon and splash, launch without Safari chrome, rotate, navigate between archive/Rules Lab/matches, inspect dialogs and bottom navigation around cutouts, and reopen after backgrounding. Verify sign-in and saved-game recovery with the deployed service. Desktop WebKit emulation cannot certify Apple's installer, OS splash rendering or authentication handoff.

Sources: [Apple installation instructions](https://support.apple.com/guide/iphone/iphea86e5236/ios), [WebKit Home Screen manifest behavior](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Safari 26 web apps](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), [WebKit safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).
