---
version: "neuform"
name: "Aura • System 01"
description: "Aura System Dashboard Section is designed for demonstrating application workflows and interface hierarchy. Key features include clear information density, modular panels, and interface rhythm. It is suitable for product showcases, admin panels, and analytics experiences."
colors:
  primary: "#FF4500"
  secondary: "#A1A1AA"
  accent: "#FF4500"
  background: "#050507"
  surface: "#18181B"
  text-primary: "#E5E5E5"
  text-secondary: "#A1A1AA"
  border: "#27272A"
typography:
  display-lg:
    fontFamily: "** Inter"
    fontSize: "64px"
    fontWeight: 500
    lineHeight: "1.04"
    letterSpacing: "0"
  body-md:
    fontFamily: "Inter"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "1.6"
  label-md:
    fontFamily: "JetBrains Mono"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "1.2"
spacing:
  base: "8px"
  gap: "16px"
  card-padding: "24px"
  section-padding: "80px"
rounded:
  card: "8px"
  pill: "9999px"
---

# Aura • System 01

Source: Neuform Trending templates. Views: 389; favorites: 15; remixes: 10.

## Overview
Aura System 01 is an industrial-minimalist design language characterized by high-contrast monochromatic palettes and rigorous geometric alignment. The mood is analytical, echoing technical telemetric systems. Composition relies on strict vertical and horizontal framing, using hairline rules to create a deconstructed grid that separates high-density interface zones from raw structural content.

## Colors
* **Primary Backgrounds:** A deep, near-black neutral [#050507] provides the base, with slightly higher-toned accents [#070709] and [#0a0a0c] for nested surface differentiation.
* **Structural Accents:** A stark white/neutral palette, with text and lines maintained at varying opacities (from /04 to /90) to denote hierarchy without color noise.
* **Action & System Indicators:** A high-visibility orange [#FF4500] is reserved strictly for status pulses and focal points, ensuring immediate semantic identification in an otherwise grayscale environment.

## Typography
* **Typeface:** Inter, utilizing weight variants (300, 400, 500) to balance technical clarity with editorial spacing.
* **Hierarchy:**
    * **Display:** XL sans-serif, low-leading (0.95), tight tracking for impact.
    * **Label:** All-caps, small font size (text-xs), wide tracking (0.15em) to enforce a terminal-readout aesthetic.
    * **Body:** Light weight, high readability (1.4-1.6 line height) on a constrained width-max.

## Layout
* **Grid Logic:** The system uses a full-viewport container centered within a light-grey matte, featuring permanent vertical boundary lines at 8-12% offsets to frame content.
* **Section Rhythm:** Content sections utilize a 48px to 80px base padding cadence. Modules are delineated by border-only separators, creating a "breathable" but locked-in technical interface.
* **Constraint:** Main text areas are constrained to max-w-md to ensure character-per-line counts remain optimal for technical documentation styles.

## Elevation & Depth
* **Surface Recipe:** Depth is achieved through a combination of subtle backdrop blur (backdrop-blur-md) and inner-shadow layering.
* **Shadow Character:** Standard shadows use heavy black RGBA multipliers [0,0,0,0.4] for large cards, while inset borders (1px) with high-transparency white light [255,255,255,0.1] simulate the physical edge of a machined component.
* **Blur:** Reserved for floating UI elements to maintain high contrast behind text layers.

## Shapes
* **Corner Hierarchy:** Sharp, technical aesthetics prioritize 8px (rounded-lg) to 12px (rounded-3xl) radii, ensuring a balance between hardware-inspired sharpness and soft-touch accessibility.
* **Silhouette:** The design employs corner-anchor markers (tiny 1.5px squares) at the intersections of major image containers to mimic CAD viewport UI.
* **Geometry:** Iconography is minimalist (line-style) to stay consistent with the low-stroke-weight aesthetic of the typography.

## Components
* **Status Chips:** Small, pill-shaped badges with border-only styling and subtle background tints, paired with status pips (dot-indicator).
* **Control Modules:** Cards utilize an inner-shadow top-highlight [inset 0 1px 0 rgba(255,255,255,0.1)] to feel "recessed" into the dark UI.
* **Nav Chips:** High-density, uppercase labels with a hover-transition that alters opacity rather than structural shape.
* **Reveal Containers:** Layout blocks designed for scroll-triggered entrance, emphasizing technical "unpacking" of data.

## Do's and Don'ts
* **Do** keep hairline borders at 1px thickness; do not use heavy stroke weights for structural separation.
* **Do** preserve the 0.15em letter-spacing for all secondary labels and technical readouts.
* **Do** favor opacity-based text differentiation (white/40, white/60) over color-based signaling.
* **Don't** use decorative gradients; gradients should only function as subtle light-source simulations on primary container surfaces.
* **Don't** introduce rounded corners larger than 12px; this disrupts the system's industrial, rigid feel.

## Motion
* **Reveal Logic:** Use GSAP-powered staggered word reveals and mask-based element entry for text; motion should feel rapid and precise, utilizing `power4.out` or `power3.out` easing.
* **Interaction:** Hover effects should be subtle, focusing on scale-down (1.05 to 1.0) or opacity shifts. Avoid bouncy or elastic easing functions.
* **Scroll Behavior:** Entrance animations must be anchored to the scroll trigger with a `play none none none` toggle strategy to ensure performance consistency.

## ThreeJS
* **Renderer & Scene:** The scene uses `THREE.WebGLRenderer` with alpha enabled, rendering a custom `PlaneGeometry` (40x24 segments) into a specific canvas container (`#gl`).
* **Visual Motif:** A wireframe-only, low-reflectivity (`MeshStandardMaterial`) mesh performs procedural displacement via a `requestAnimationFrame` loop, simulating wave patterns (`Math.sin`/`Math.cos`) on the z-axis.
* **Interaction:** The camera is fixed with a 30-degree FOV; scene rotation reacts to global `mousemove` coordinates, using lerped drift logic to smooth the movement.
* **Technical Constraints:** The implementation handles DPI scaling via `Math.min(window.devicePixelRatio, 2)` and manages responsive aspect-ratio updates via the resize event listener to prevent mesh distortion.
