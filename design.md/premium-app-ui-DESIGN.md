---
version: "neuform-staff-featured-2026-05-22"
name: "Premium App UI"
description: "Premium App Background Effect is designed for delivering a visual treatment or immersive background effect. Key features include atmospheric visuals, motion depth, and flexible presentation layering. It is suitable for visual-first pages, motion studies, and atmospheric hero treatments."
colors:
  primary: "#E7BF70"
  secondary: "#FFFFFF"
  accent: "#256BFF"
  background: "#FFFFFF"
  surface: "#14234B"
  text-primary: "#111827"
  text-secondary: "#4B5563"
  border: "#E5E7EB"
typography:
  display-lg:
    fontFamily: "-apple-system"
    fontSize: "64px"
    fontWeight: 500
    lineHeight: "1.04"
    letterSpacing: "0"
  body-md:
    fontFamily: "ui-serif"
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
  card: "30px"
  control: "22px"
  pill: "9999px"
components:
  card:
    background: "Use the surface token with subtle borders and HTML-matched shadow depth"
    radius: "Match the declared card radius token"
  button:
    background: "Use primary or accent colors for the main action"
    radius: "Use the control or pill radius based on the source HTML"
---
# Premium App UI
Source: Neuform staff featured templates. Author: Sourasith Phomhome (@madebysourasith). Views: 55; favorites: 2; remixes: 0.
Tags: background, animated, threejs, effect.
## Overview
Premium App Background Effect is designed for delivering a visual treatment or immersive background effect. Key features include atmospheric visuals, motion depth, and flexible presentation layering. It is suitable for visual-first pages, motion studies, and atmospheric hero treatments.

9:41 Hello, Alex! Find your next scenic drive All Coastal Mountain Urban Pacific Coast Hwy California, USA 3 days 650 mi Trending Routes High Elevation Stelvio Pass Italy Fast Chargers Route 66 USA Home Routes Saved Pro…
## Composition
Use the attached HTML reference as the source of truth. Preserve the visible hierarchy, first-screen composition, section rhythm, density, and interaction tone before adapting copy or content.
Key visible headings include: Hello, Alex!; Pacific Coast Hwy; Trending Routes; Stelvio Pass; Route 66; About this route.
## Colors
Anchor the palette in primary #E7BF70, secondary #FFFFFF, accent #256BFF, background #FFFFFF, surface #14234B, text-primary #111827. Keep background, surface, text, and border roles distinct so generated layouts retain the same contrast pattern as the source.
## Typography
Use -apple-system for display moments and ui-serif for body copy unless the HTML clearly demands a compatible fallback. Labels and technical metadata should use JetBrains Mono or an equivalent mono face.
## Layout
Keep spacing deliberate and stable. Favor the same grid direction, max-width behavior, card density, and responsive stacking seen in the HTML. Do not replace distinctive source structures with generic SaaS sections.
## Components
Cards, buttons, badges, navigation, and repeated blocks should preserve the source geometry, border treatment, and hover feel.
## Motion
Preserve existing motion cues such as masked reveals, staggered entrance, hover lift, scroll-triggered transitions, and ambient movement. Keep easing smooth and restrained.
## WebGL & Effects

If the source includes canvas, WebGL, Three.js, gradients, particles, or atmospheric effects, rebuild them as supporting layers behind the content. Keep effects performant, responsive, and secondary to the interface.

## Guardrails
- Do not flatten the source into a generic card grid.
- Do not swap the color mode unless the source clearly supports it.
- Preserve the first viewport signal, focal object, and visual density.
- Keep buttons, cards, and badges aligned to the same radius and border language.