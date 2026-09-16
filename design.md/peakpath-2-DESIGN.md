---
version: "neuform-staff-featured-2026-05-22"
name: "PeakPath"
description: "Peakpath Sleep Background Effect is designed for delivering a visual treatment or immersive background effect. Key features include atmospheric visuals, motion depth, and flexible presentation layering. It is suitable for visual-first pages, motion studies, and atmospheric hero treatments."
colors:
  primary: "#C9F46B"
  secondary: "#000000"
  accent: "#A7FFD0"
  background: "#03110E"
  surface: "#F6F0DD"
  text-primary: "#FFFFFF"
  text-secondary: "#A1A1AA"
  border: "#27272A"
typography:
  display-lg:
    fontFamily: "IBM Plex Mono"
    fontSize: "64px"
    fontWeight: 500
    lineHeight: "1.04"
    letterSpacing: "0"
  body-md:
    fontFamily: "Instrument Serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "1.6"
  label-md:
    fontFamily: "IBM Plex Mono"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "1.2"
spacing:
  base: "8px"
  gap: "16px"
  card-padding: "24px"
  section-padding: "80px"
rounded:
  card: "16px"
  control: "8px"
  pill: "9999px"
components:
  card:
    background: "Use the surface token with subtle borders and HTML-matched shadow depth"
    radius: "Match the declared card radius token"
  button:
    background: "Use primary or accent colors for the main action"
    radius: "Use the control or pill radius based on the source HTML"
---
# PeakPath
Source: Neuform staff featured templates. Author: Samnang Aing (@samnang). Views: 194; favorites: 9; remixes: 2.
Tags: background, animated, webgl, threejs, dither, effect.
## Overview
Peakpath Sleep Background Effect is designed for delivering a visual treatment or immersive background effect. Key features include atmospheric visuals, motion depth, and flexible presentation layering. It is suitable for visual-first pages, motion studies, and atmospheric hero treatments.

PeakPath Home About Blog Book a demo Sleep better. Stay focused. Think sharper. PeakPath helps Big-3 and Big-4 pros boost performance with coaching, wearables, and habit tools. Book a demo Better Sleep 10 minutes for in…
## Composition
Use the attached HTML reference as the source of truth. Preserve the visible hierarchy, first-screen composition, section rhythm, density, and interaction tone before adapting copy or content.
Key visible headings include: Sleep better. Stay focused. Think sharper..
## Colors
Anchor the palette in primary #C9F46B, secondary #000000, accent #A7FFD0, background #03110E, surface #F6F0DD, text-primary #FFFFFF. Keep background, surface, text, and border roles distinct so generated layouts retain the same contrast pattern as the source.
## Typography
Use IBM Plex Mono for display moments and Instrument Serif for body copy unless the HTML clearly demands a compatible fallback. Labels and technical metadata should use IBM Plex Mono or an equivalent mono face.
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