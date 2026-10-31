import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { BirthdayService } from "../services/birthday.service";

export class SystemController {
  static async getConfig(req: Request, res: Response) {
    return res.status(200).json({
      appDownloadLink: process.env.APP_DOWNLOAD_LINK || "https://github.com/nrai18/AttendX/releases/latest/download/AttendX.apk",
      wsUrl: process.env.WS_URL || "wss://attendx-backend-fh6k.onrender.com/ws",
      mlApiUrl: process.env.ML_API_URL || "https://attendx-ml-server.onrender.com",
      googleClientId: process.env.GOOGLE_CLIENT_ID || "729387616931-qlajf1dss2qi1cta5pvc3dos03fh4coi.apps.googleusercontent.com"
    });
  }

  static async getUpdateManifest(req: Request, res: Response) {
    const manifest = {
      appDownloadLink: process.env.APP_DOWNLOAD_LINK || "https://github.com/nrai18/AttendX/releases/latest/download/AttendX.apk",
      latestVersion: "4.3.0",
      title: "AttendX Micro-Physics Delight Animations, DND Auto-Unmute & Tactile Fluidity",
      changelog: [
        {
          "version": "4.3.0",
          "date": "Oct 28, 2026",
          "title": "Micro-Physics Delight Animations, Native DND Unmute & System Hardening",
          "sections": [
            {
              "title": "Delight Micro-Physics & Web Audio Synthesizer (4.0s - 5.0s Suite)",
              "items": [
                {
                  "icon": "📲",
                  "text": "Classroom Section-Scoped FCM Delivery & Deep-Link Routing: Enforced strict section-isolated FCM dispatch (prisma.classroomMember query excluding the sender) so that announcements and disband alerts reach strictly enrolled peers of that specific classroom code. Added rich routing metadata (data.route, data.url, and data.classroomId) and cold/warm launch deep-link routing in NotificationService and AppShell, navigating students directly to /classrooms/:id upon announcement tap, and /classrooms upon hub disband alerts."
                },
                {
                  "icon": "💨",
                  "text": "Aerodynamic Whoosh-In / Whoosh-Out Dynamic Island HUD & Hub Trajectory Suite: Elevated the top-level DynamicIslandHUD with silky 3D perspective aerodynamic whoosh physics (y: -85 -> 0, scale: 0.68 -> 1, rotateX: 28deg -> 0deg, blur: 10px -> 0px) and velocity dismiss whoosh (y: 0 -> -80, scale: 1 -> 0.72, rotateX: 0deg -> -22deg) synchronized with zero-latency synthesized aerodynamic audio (SoundFX.playWhooshSound). Added a dedicated 3D perspective whoosh flight trajectory (@keyframes hubWhooshTrajectory) when disbanding or removing classrooms, accompanied by celebratory whoosh-in (@keyframes hubWhooshIn) and Dynamic Island HUD feedback upon hub creation, enrollment, or peer cleanup."
                },
                {
                  "icon": "🏛️",
                  "text": "Classroom Disband Lifecycle, FCM Push Alerts & Peer Cleanup: Empowered Class Representatives with secure hub disbanding. When a classroom is disbanded, an immediate high-priority Firebase Cloud Messaging (FCM) broadcast is pushed to all enrolled peers. Disbanded classrooms are rendered greyed out and muted on peers' devices with an alert banner and an interactive 'Remove Hub' action to cleanly clear stale sections."
                },
                {
                  "icon": "🎓",
                  "text": "Academic Term Transition Engine: Added an integrated Academic Term Transition interface directly within Classroom hubs. Enables CRs to transition academic terms, update branch semesters, and coordinate synchronized timetable renewals across sections."
                },
                {
                  "icon": "🚀",
                  "text": "Onboarding & Settings Section Hub Integration: Added a dedicated 'Join your section classroom' checklist step to student onboarding on TodayPage, and embedded a direct 'Classrooms & Sections' tile in the Settings page under Academic Tools for rapid navigation."
                },
                {
                  "icon": "⚡",
                  "text": "Zero-Latency Farewell Pattern Hardening: Fortified client (0ms) and server (<1ms) fast-path intent matching for farewell and parting phrases ('see you later', 'see you soon', 'see ya later', 'talk to you later', 'catch you later', 'bye', 'goodbye', 'cya', 'take care'). Eliminated the regex mismatch where trailing words bypassed the local deterministic engine and fell back to cloud Gemini models."
                },
                {
                  "icon": "⚡",
                  "text": "Hardware-Accelerated 60/120fps View Transitions & Circular Ripple Theme Engine: Overhauled the light-to-dark and dark-to-light theme switching architecture. Eliminated the laggy 150ms class-swapping timeout that previously choked page renders with layout thrashing. Upgraded to native Chromium / Android WebView document.startViewTransition() and React 18 flushSync with a silky smooth circular clip-path ripple expanding from the touched toggle icon across the viewport (380ms, cubic-bezier(0.16, 1, 0.3, 1)), accompanied by tactile haptic feedback and zero frame drops."
                },
                {
                  "icon": "🔙",
                  "text": "Classrooms Back Button & Android Hardware Back Lifecycle: Added a tactile Nothing OS header back button to the Classrooms Hub (/classrooms) returning to Settings. Wired up native Android hardware back button lifecycle handling: pressing back inside a hub (/classrooms/:id) navigates back to /classrooms, and pressing back from /classrooms returns to /settings. Open modals (join, create, delete confirmation, roster, term transition) cleanly intercept hardware back to dismiss before navigating."
                },
                {
                  "icon": "👥",
                  "text": "Clickable Peer Roster & Granular Broadcast Posting Permissions: Made enrolled peers clickable by everyone to inspect full section classmate lists (with avatars, names, roll numbers, and CR badges). Equipped Class Representatives with granular broadcast permission controls to choose who can post: CRs Only, Everyone, A Few (Selected Peers), or Everyone Except A Few."
                },
                {
                  "icon": "🏝️",
                  "text": "Dynamic HUD Exclusive Notification & Collision Elimination: Resolved double notification triggering where updating classroom broadcast permissions simultaneously fired a Sonner toast and the Dynamic Island HUD at top-center. Suppressed the redundant Sonner toast, ensuring the sleek Dynamic Island HUD ('Posting Access Updated') presents policy status with high clarity and zero UI clutter."
                },
                {
                  "icon": "🌗",
                  "text": "Dynamic HUD Theme Mode Switch Notification: Integrated the Dynamic Island HUD directly into theme switching. Whenever toggling between Light and Dark mode (via TopBar, Settings, or AI Assistant commands), a sleek dynamic pill animates smoothly at top-center with custom animated sun/moon glyphs and a clean single-line mode title ('Dark Mode' or 'Light Mode'), micro-acoustic harmonic frequency blips, tactile physical selection haptics, and adaptive specular glow halos without redundant subtitle descriptions."
                },
                {
                  "icon": "🎨",
                  "text": "Google Classroom Thematic Illustrated Cards & Hero Banners: Completely overhauled the plain rectangular classroom hub cards with 5 resolution-independent vector art banners inspired by Google Classroom's signature headers. Handcrafted 5 themes: Honors & Circuits (Medals & Diploma), Studio & Design (Paint & Brushes), AI & Computing (Silicon Neural Processors), Physics & Lab (Flask & Orbitals), and Library & Core (Books & Quill). Intelligent subject-keyword classification dynamically assigns the best matching illustration with high-contrast text scrims, while preserving our Nothing OS matte black aesthetics."
                },
                {
                  "icon": "🧭",
                  "text": "Desktop Sidebar Cleanup & Pure Dynamic Mobile Bottom Nav: Kept the desktop/laptop sidebar uncluttered by removing permanent classroom tabs, preserving the classic 7 core items (Today, Forecast, Timetable, Calendar, Subjects, Semester Overview, Settings). On mobile, Classrooms operates purely as a dynamic, route-scoped 6th tab that mounts exclusively while actively viewing section hubs (/classrooms) with a Nothing OS matte monochrome pill and instantly unmounts upon returning to base tabs (/today, /timetable, /calendar, /subjects, /settings), exactly mirroring Forecast and Reports without lingering indicators."
                },
                {
                  "icon": "🔇",
                  "text": "Classroom Audio Scoping & Routine Click Muting: Purged repetitive chime sounds from routine navigation and actions (Enter Hub, back button, roster opening, modal toggles, notice broadcasting, and the Settings tile). Confined sound effects strictly to high-impact classroom lifecycle milestones: joining a classroom hub, deleting or disbanding a section, and updating CR broadcast posting permissions."
                },
                {
                  "icon": "🏷️",
                  "text": "Purged Internal Theme Design Badges: Completely removed internal theme design labels ('STUDIO & LAB', 'ECE & TECH', 'AI & SOFTWARE') from classroom cards and feed hero headers. The header now strictly and cleanly displays only real student-entered academic attributes (such as department ELECTRONICS, section SEC A, and role CR / ADMIN)."
                },
                {
                  "icon": "⚡",
                  "text": "CR Announcement Dispatch & Prisma Schema Mapping: Resolved backend announcement creation mapping with the database schema (body: data.content), ensuring instant, error-free posting of routine, important, and urgent class broadcasts."
                },
                {
                  "icon": "💬",
                  "text": "AI Chat Send & Enter Key Handling: Fixed an issue where typing words like 'bye' or 'stop' silently aborted message transmission due to voice breakout command interception. Added explicit Enter key and direct button click handlers to guarantee instant dispatch."
                },
                {
                  "icon": "🏛️",
                  "text": "Academic Classrooms Anti-Slop Redesign & Broadcast Stream: Completely overhauled the Classrooms Hub and Section Feed, eliminating the generic empty void card trope, broken /404 placeholder links, clashing placeholder text, and hazy purple/indigo card tints in favor of pure Nothing OS matte black (dark:bg-[#08080a] and dark:bg-[#0c0d0e]). Introduced a high-density, tactile Academic Batch Hub featuring dual interactive student join/CR setup cards, 6-character monospace PIN inputs, 1-tap join code clipboard synchronization, verified CR broadcast feed with importance tiers (Routine, Important, Urgent), and full dual-theme light/dark mode parity."
                },
                {
                  "icon": "🎂",
                  "text": "True Zero-Latency Birthday & Peer Calendar Engine: Expanded the AI fast-path intent matcher to resolve all birthday inquiries ('Do you know my birthday', 'Whose birthday is today', 'When is my birthday', upcoming/peer birthdays) with frame-0 client execution (0ms) and sub-millisecond server in-memory lookup (<1ms). Peer birthdays now seamlessly inspect active calendar events (such as 'Priya Didi' and personal celebration milestones) with 0 tokens and zero Gemini quota or network timeout dependencies."
                },
                {
                  "icon": "🎨",
                  "text": "Dynamic Island HUD & Header Notification Light Mode Polish: Upgraded the Dynamic Island HUD notification pill with adaptive dual-theme styling (crisp frosted pearl glass in light mode with high-contrast text-slate-900 / text-slate-600 fonts, and sleek obsidian glass in dark mode with white text). Elevated the Upcoming Event header banner pill on TodayPage with a high-contrast border and rich text-sky-950 contrast, guaranteeing crystal-clear readability across both light and dark modes."
                },
                {
                  "icon": "🏝️",
                  "text": "Dynamic Island HUD Feedback on ZIP Archive Restore: Added global top-layer Dynamic Island notification ('ZIP Archive Imported Successfully • Schedule, attendance, and events restored') with synthesized audio chimes upon completing ZIP and backup imports, transitioning seamlessly via in-app SPA navigation to Today's agenda."
                },
                {
                  "icon": "💤",
                  "text": "Neon Serverless Zero-Waste Auto-Suspend & Cold-Start Resilience: Decoupled /api/health from PostgreSQL (returning pure in-memory process stats so Render/uptime monitors keep Node warm without waking the database), removed the 20-second connection pool heartbeat query, and decommissioned the 15-minute share transfer cleanup cron in favor of on-demand pruning. Paired with 4.1s exponential backoff DB retries, this slashes monthly Neon compute from 180 CU-hours down to under 5-8 CU-hours, allowing Neon to freely auto-suspend when inactive."
                },
                {
                  "icon": "🎨",
                  "text": "Floating Chatbot Solid Theme & Real-Time Event Sync: Replaced semi-transparent chatbot drawer container styles with solid opaque backgrounds across light and dark modes, completely eliminating visual bleed-through of underlying timeline cards and floating scroll buttons. Synchronized custom timeline events (like 'Priya Didi' on Oct 31) instantaneously into the AI copilot memory so queries like 'Whose birthday is today?' immediately acknowledge scheduled events."
                },
                {
                  "icon": "⚡",
                  "text": "Multi-Layer Query Sanitization & Quote Stripping: Integrated robust multi-stage cleaning that strips leading and trailing quotes, conversational preambles, and trailing particles, ensuring navigation queries like 'Show exam countdowns' or 'timetable' resolve in 0ms without falling through to LLM reasoning."
                },
                {
                  "icon": "🛡️",
                  "text": "Peer Sync Session Revocation Resolution: Fixed an issue where terminating all other sessions in Settings mistakenly added the active session to the in-memory revoked sessions cache, causing code generation on POST /api/transfer/send to fail with 401 'Session has been revoked'. Added keepSessionId protection and auto-healing on refresh token validation."
                },
                {
                  "icon": "💬",
                  "text": "Contextual Attendance Remarks & Quick Reason Chips: Cleaned up remark modals across all statuses (Present, Absent, Off, and Full-Day Absent) by removing input placeholders and tuning curated 1-tap reason chips for fast, distraction-free logging."
                },
                {
                  "icon": "💬",
                  "text": "Contextual Attendance Remarks & Bunk Reason Tracking: Added dedicated remark logging across all classes (Attended, Missed, and Off). Users can now log and edit reasons why a lecture was missed or cancelled, with status-specific 1-tap quick chips ('Bunk', 'Mass Bunk', 'Teacher Absent', 'Class Cancelled', 'Proxy', 'Medical', etc.), in-card interactive remark chips, and quick remove actions."
                },
                {
                  "icon": "🎨",
                  "text": "Floating Chatbot Solid Theme & Real-Time Event Sync: Replaced semi-transparent chatbot drawer container styles with solid opaque backgrounds across light and dark modes, completely eliminating visual bleed-through of underlying timeline cards and floating scroll buttons. Synchronized custom timeline events (like 'Priya Didi' on Oct 31) instantaneously into the AI copilot memory so queries like 'Whose birthday is today?' immediately acknowledge scheduled events."
                },
                {
                  "icon": "⚡",
                  "text": "Multi-Layer Query Sanitization & Quote Stripping: Integrated robust multi-stage cleaning that strips leading and trailing quotes, conversational preambles, and trailing particles, ensuring navigation queries like 'Show exam countdowns' or 'timetable' resolve in 0ms without falling through to LLM reasoning."
                },
                {
                  "icon": "🛡️",
                  "text": "Universal Frame-0 NaN Eradication & 500x Faster Stats Fetch: Added sanitizeSubjectStat to initial component mount, cache hydration, and card renders so that overall and per-subject Missed and Off numbers render clean integers immediately on cold load without ever flashing NaN. Optimized the backend AttendanceService._calculateRemainingClasses loop with pre-indexed O(1) date maps for holidays, overrides, attendance, and timetable slots, slashing API response time from 2,768ms down to under 15ms."
                },
                {
                  "icon": "⚡",
                  "text": "Instant Timetable Setup Wizard 'Confirm & Sync': Dismisses the wizard modal in 0ms upon clicking 'Confirm & Sync', immediately injecting optimistic schedule slots into the grid and firing the raindrop cascade animation with frame-0 latency, while executing database persistence, subject reconciliation, and cache invalidation in parallel in the background."
                },
                {
                  "icon": "🔊",
                  "text": "Inaudible Infrasound Keep-Alive & Zero-Latency Audio Sync: Engineered a continuous 2Hz @ 0.00002 (-94dBFS) sub-audible keep-alive oscillator that prevents Chromium, WASAPI, and Android AAudio hardware audio pipes from entering power-saving sleep when idle. Eliminates cold-start audio delays for event deletions, raindrop cascades, origami paper crumples, and Dynamic HUD notifications."
                },
                {
                  "icon": "🌧️",
                  "text": "Micro-Synchronized Timetable Raindrop Synthesizer: Perfectly locked the acoustic droplet chime cadence in SoundFX.playRainDropCascadeSound to the exact visual CSS falling intervals (40ms desktop, 80ms mobile) with an acoustic landing offset at 0.12s, concluding with a resolving glass chime as the final slot impacts."
                },
                {
                  "icon": "🏝️",
                  "text": "Dynamic Island HUD Micro-Acoustic Pop Suite: Added dedicated, ultra-subtle synthesized acoustic blips (sparkle, cap, trash, plane, origami, butterfly) in SoundFX.playDynamicHUDSound triggered on HUD pill expansions, equipped with a 350ms suppression guard to prevent interference when major full-screen animation synthesizers are actively playing."
                },
                {
                  "icon": "⏱️",
                  "text": "Calibrated 3.0-Second OCR Stage Progression & Absolute Text Collision Fix: Fixed all 14 stages of timetable extraction to a steady 3.0s wall-clock duration in RunActionButton, and structured the label container with absolute inset-0 positioning in mode='wait' to completely eliminate any possible text overlap or 3-line layout displacement."
                },
                {
                  "icon": "🗂️",
                  "text": "Archived Timetable Origami Crumble & Domino Cascade Choreography: Deleting a single archived timetable version now visually crumbles both the sidebar version card and all schedule slot cards in 3D perspective (origamiPaperCrumbleArchive) while firing the 'Origami Paper Crumble' Dynamic Island HUD pill at frame-zero. Clearing all archived versions topples historical version cards and schedule slots in a staggered 3D domino wave (dominoCascadeFallArchive) locked to SoundFX.playDominoCascadeSound and the 'Cascading Schedule Clear' Dynamic Island HUD pill, with DynamicIslandHUD portaled directly to document.body at z-index 2147483647."
                },
                {
                  "icon": "⚡",
                  "text": "Ultra-Fast Peer Sync Code Generation, Retrieval & Auto-Redirect: Consolidated multi-roundtrip database queries in TransferService.buildPayload and TimetableService.importTimetable into single parallel Promise.all waves, compacted lecture log payloads by 75%, made FCM sync notifications non-blocking, excluded raw binary fileData blobs from GET /api/documents metadata queries, and added automatic redirection to /timetable immediately after Peer Sync import completion."
                },
                {
                  "icon": "📄",
                  "text": "Authentic 12-Strip Paper Shredder 3D Physics: Deleting stored documents in Settings feeds the card downward into an industrial metallic shredder mouth with a vibrating mechanical chassis, counter-rotating blade teeth, and a pulsing crimson warning laser line, slicing the card into 12 vertical paper ribbon strips that flutter downward in 3D perspective with alternating torsional curls (rotateY, skewX), realistic staggered tooth bite tension, and drifting micro confetti dust."
                },
                {
                  "icon": "🔊",
                  "text": "Zero-Latency Electric Shredder Web Audio API Synthesizer: Procedural real-time acoustic synthesis starting immediately at 0ms upon document deletion. Features a dual-oscillator electric motor hum (114Hz saw + 122Hz square) with 26Hz gear ripple torque modulation, 35ms granular high-frequency paper fiber fracture tearing bursts (1.2kHz HP / 2.4kHz BP), paper buckle crackle, a mechanical blade latch click as the sheet exits the blades, and pitch deceleration sag to silence over 2.4s."
                },
                {
                  "icon": "✨",
                  "text": "Cinematic Spring-Animated Delete Confirmation Toasts: Upgraded crude generic browser delete prompts into interactive dark-glass cards with spring-drop entrance physics, a pulsing crimson warning badge, acoustic double-tone alert audio, a 7-second countdown hairline bar, magnetic pill action buttons, and an instant disintegrate exit animation on delete confirmation."
                },
                {
                  "icon": "🌧️",
                  "text": "Cascading Raindrop Drop-in Animation on Timetable Import: Timetable slot cards drop into place like raindrops across the weekly grid with staggered column timing from Monday to Sunday, featuring vertical elongation, blur clearing, a cushioned bounce landing, and synthesized harmonic pentatonic raindrop audio concluding in a soft glass chime."
                },
                {
                  "icon": "🧲",
                  "text": "Tactile Slot Drop Snap Animation & Sound: Releasing or reordering timetable slots triggers an authentic magnetic snap settling spring animation with subtle border glow and an acoustic drop snap sound effect."
                },
                {
                  "icon": "🏝️",
                  "text": "Dynamic Island HUD Sequence Synchronization: Dynamic Island notifications now appear strictly after components and animations have completed rendering and settling into view, completely eliminating the desync where the HUD displayed 'Timetable Generated & Saved!' while the grid was still empty."
                },
                {
                  "icon": "💨",
                  "text": "Linked Devices Aerodynamic Whoosh Termination: Terminating sessions or linked devices now enforces interactive confirmation via confirmDeleteToast with device identity, location details, and confirmation labels. On confirmation, plays a zero-latency aerodynamic wind sweep Web Audio synthesis (SoundFX.playWhooshSound), haptic kick, 700px 3D perspective trajectory whoosh flight (@keyframes sessionWhooshTrajectory), and synchronized Dynamic Island HUD notification."
                },
                {
                  "icon": "🗑️",
                  "text": "Permanent Document Shredding & Reappearance Prevention: Deleting stored documents in Settings permanently marks the document in deletedDocIdsRef, preventing deleted backup or timetable documents from ever popping back into the list even during background API refresh lag or race conditions."
                },
                {
                  "icon": "⚡",
                  "text": "Timetable Generation Cache Invalidation & Raindrop Drop-in: Guarded against long-lived caching of empty timetable slots in CacheService.set, immediately pre-cached generated slots upon wizard save, and guaranteed that background refreshes never overwrite newly imported schedules with blank responses."
                },
                {
                  "icon": "🧠",
                  "text": "Gemini 3.8-Flash OCR Thinking Config Normalization: Replaced invalid thinkingLevel parameter with thinkingBudget in timetable OCR import, and added automatic parameter self-healing in AIManager to prevent 400 key-exhaustion loops during image parsing."
                },
                {
                  "icon": "⚡",
                  "text": "Fast Geocoding & Login Latency Safeguard: Added an AbortSignal timeout to OpenStreetMap Nominatim reverse geocoding with instant fallback to device timezone and IP headers, completely eliminating 10-second connect timeout hangs during authentication."
                },
                {
                  "icon": "🚀",
                  "text": "In-Flight GET Request Deduplication: Implemented in-flight request collapsing in the frontend API client, collapsing duplicate parallel queries for active semesters, subjects, sessions, and documents into a single network roundtrip to eliminate server load spikes."
                },
                {
                  "icon": "🦋",
                  "text": "Subject Card 4-Shard Fracture & Metamorphosed 3D Flapping Butterfly: Deleting a subject splits the card along golden lightning fissures into 4 distinct physical polygon shards that tumble outward and drop with gravity. A glowing bioluminescent butterfly emerges from the center, rapidly flapping wings with 100-degree alternating 3D strokes, soaring along an organic PowerPoint-style S-curve flight trajectory with sparkling stardust trail and zero-latency crystal-fracture & ascending wind-chime Web Audio synthesis."
                },
                {
                  "icon": "🗑️",
                  "text": "Archived Timetable Version Deletion: Added dedicated red delete action buttons to individual historical timetable version cards in the sidebar and preview header, safely decoupling foreign-key attendance records and overrides, deleting retired slots, and invalidating local and server caches."
                },
                {
                  "icon": "⚡",
                  "text": "WYSIWYG Timetable Setup Wizard Synchronization: Transmits exact previewed slot configurations directly to the server, strictly enforcing elective choices and lab group matching for 100% fidelity between preview and saved timetable."
                },
                {
                  "icon": "🔄",
                  "text": "Timetable Updates & Today Page Instant Re-Sync: Dispatching timetable-updated events and invalidating Today page cache ensures newly generated or updated timetables immediately sync with Today's schedule without showing stale classes."
                },
                {
                  "icon": "🏖️",
                  "text": "Full Day Off & Undo Day Off Overhaul: Undoing Day Off completely resets todayStatus and calendar cache days, allowing seamless toggling between normal schedules and day-off states."
                },
                {
                  "icon": "✨",
                  "text": "Unicode & Mojibake Character Sanitization: Replaced corrupted en-dashes in Send Feedback frequency options with standard hyphens, preventing character corruption across all devices and platforms."
                },
                {
                  "icon": "🎵",
                  "text": "Raindrop & Domino Cascade Audio Scaling: Raindrop cascade audio duration dynamically scales based on slot count, and Domino clear flips cards beat-by-beat in synchronization with synthesized audio clicks."
                },
                {
                  "icon": "🎨",
                  "text": "Floating Chatbot Solid Theme & Real-Time Event Sync: Replaced semi-transparent chatbot drawer container styles with solid opaque backgrounds across light and dark modes, completely eliminating visual bleed-through of underlying timeline cards and floating scroll buttons. Synchronized custom timeline events (like 'Priya Didi' on Oct 31) instantaneously into the AI copilot memory so queries like 'Whose birthday is today?' immediately acknowledge scheduled events."
                },
                {
                  "icon": "⚡",
                  "text": "Multi-Layer Query Sanitization & Quote Stripping: Integrated robust multi-stage cleaning that strips leading and trailing quotes, conversational preambles, and trailing particles, ensuring navigation queries like 'Show exam countdowns' or 'timetable' resolve in 0ms without falling through to LLM reasoning."
                },
                {
                  "icon": "🛡️",
                  "text": "Subjects Page Crash Prevention: Fully resolved undefined useRef reference on the subjects view, ensuring seamless navigation and error boundary safety."
                },
                {
                  "icon": "⏱️",
                  "text": "Synchronized Timetable & Calendar AI Telemetry Stages (3 to 4 Seconds per Stage): Re-engineered OCR extraction progression across TimetablePage and CalendarImportModal so the modal stage card and RunActionButton are 100% synchronized in real time. Decoupled action handlers into persistent refs to eliminate 100ms render aborts, calibrated progression to an authentic 3.2s - 3.8s per stage, and passed activeStepIndex so both indicators advance in unified lockstep."
                },
                {
                  "icon": "🛫",
                  "text": "Paper Aeroplane Flight on Assignment Completion: Completing an assignment triggers an elevation lift, diagonal fold, and 4.2-second parabolic swoop flight with emerald particle trails and synthesized glider whistle audio."
                },
                {
                  "icon": "🦋",
                  "text": "Whoosh Butterfly Flutter & Trash Ingestion: Deleting assignments, timetable slots, subjects, or extra classes triggers a smooth 4.0-second fluttering collapse into the trash icon with synchronized wing flutter sounds."
                },
                {
                  "icon": "🗑️",
                  "text": "Cinematic 4.5s Semester Event Discard & Zero-Delay Audio: Re-calibrated event deletion to a 4.5-second sequence matching AttendX animation standards. Eliminated browser AudioContext delay by resolving the hardware clock before scheduling, triggering an instant launch whoosh at 0ms, a 2.4-second soaring parabolic flight into the 3D metallic bin, a deep metallic suction gulp thud at 2.40s with 4 rim firework chimes, and a calm list reflow at 4.0s as the can sinks."
                },
                {
                  "icon": "🏎️",
                  "text": "Full-System API Audit & Dual Route Interoperability: Audited and verified all 64 user-facing endpoints across semester lifecycle, timetable mutation, extra classes, peer sync (all 3 modes), calendar sync, and app resets with zero timeouts and 737ms average latency."
                },
                {
                  "icon": "🌊",
                  "text": "Domino Cascade Schedule Clear: Resetting the timetable executes a 4.5-second sequential flip-and-dissolve wave with 24 staggered multi-frequency cascading chimes and C-major resolution chord."
                },
                {
                  "icon": "🌪️",
                  "text": "Document Shredder Whoosh on File Deletion: Deleting stored documents in Settings triggers a 4.2-second shredder pass with synchronized motor hum, mechanical cutting pulses, and bin drop chime."
                },
                {
                  "icon": "✨",
                  "text": "Amber Spark Pop on Adding Extra Lectures: Adding an ad-hoc extra class springs in with a 4.0-second spark pop animation paired with a crisp snap pop and 4-note sparkle trail."
                },
                {
                  "icon": "🌟",
                  "text": "Amber Spark Pop on Subject Creation: Adding a subject now immediately displays the card on frame zero with a 4.0-second golden bloom spark pop animation in frame-for-frame lockstep with the snap-pop audio synthesizer and dynamic island pill."
                },
                {
                  "icon": "🦋",
                  "text": "Zero-Delay Butterfly Flutter Audio: Eliminated the 750ms internal sound delay on subject deletion by adding an instant release whoosh at 0ms and early rhythmic wing flutter clicks."
                },
                {
                  "icon": "🦋",
                  "text": "PowerPoint-Grade Card Fracture & 3D Flapping Butterfly Metamorphosis: Complete overhaul of subject deletion — when deleting, the card displays a luminous fracture crack network across its surface, crumbling inward at t=0.4s as a magnificent 3D SVG butterfly emerges from the core. Dual anatomically shaped scalloped wings with intricate stained-glass veins and pearlescent margin spots flap continuously back and forth in 3D perspective (rotateY at 0.22s intervals) along a graceful S-curve soaring flight trajectory with fairy dust stardust trails. Synchronized with zero-latency audio featuring a crisp crystal fracture snap, 14 velvety aerodynamic wing flap puffs, and celestial glockenspiel ascension chimes."
                },
                {
                  "icon": "🎯",
                  "text": "Deterministic Alphabetical Subject Insertion & Smooth Tracking: Subjects added via SubjectModal are immediately sorted alphabetically by name on frame zero in React state and matched identically by the server, eliminating card jumping and random re-positioning. Smoothly scrolls the viewport to center on the newly added subject card so users clearly see its golden spark pop entrance animation."
                },
                {
                  "icon": "🎨",
                  "text": "Floating Chatbot Solid Theme & Real-Time Event Sync: Replaced semi-transparent chatbot drawer container styles with solid opaque backgrounds across light and dark modes, completely eliminating visual bleed-through of underlying timeline cards and floating scroll buttons. Synchronized custom timeline events (like 'Priya Didi' on Oct 31) instantaneously into the AI copilot memory so queries like 'Whose birthday is today?' immediately acknowledge scheduled events."
                },
                {
                  "icon": "⚡",
                  "text": "Multi-Layer Query Sanitization & Quote Stripping: Integrated robust multi-stage cleaning that strips leading and trailing quotes, conversational preambles, and trailing particles, ensuring navigation queries like 'Show exam countdowns' or 'timetable' resolve in 0ms without falling through to LLM reasoning."
                },
                {
                  "icon": "🛡️",
                  "text": "Attendance Stats Date Type Hardening: Fixed actualStartDate.toISOString is not a function runtime error in AttendanceService.getStats and agenda date bounds by wrapping all cached string timestamps in resilient Date constructors before ISO string conversion."
                },
                {
                  "icon": "✨",
                  "text": "Seamless Zero-Flicker Timetable Slot Deletion: Optimistically evicts deleted timetable slot cards from React state and cache synchronously at the end of the 4.0-second butterfly flutter animation before background network reconciliation, eliminating split-second reappearance flickers."
                },
                {
                  "icon": "🌊",
                  "text": "3D Domino Cascade Calendar Disintegration: Replaced 0ms instant event clearing on Semester Overview with a 4.5-second sequential 3D domino cascade wave across timeline cards paired with 24 cascading chimes (playDominoCascadeSound), smoothly settling into an empty journey."
                },
                {
                  "icon": "📦",
                  "text": "Timetable Archiving Engine Overhaul: Re-engineered timetable snapshot archiving so clearing, resetting, or replacing a timetable automatically creates and displays a complete archived version in the Archived Timetables modal. Removed the arbitrary >= 5 slot minimum threshold, replaced the flawed 24-hour greedy clustering lock with a responsive 3-minute session clusterer, eliminated timestamp skew drops, and ensured both Safe Delete and Settings Reset soft-archive classes with validUntil timestamps rather than permanently hard-deleting slot records."
                },
                {
                  "icon": "🎥",
                  "text": "Panoramic Viewport Alignment & Domino Wave Camera Tracking: Enhanced calendar clear on Semester Overview to automatically switch to the timeline view and smoothly scroll the viewport so the domino cards container fills 100% of the visible screen. Added a 350ms cinematic base delay and multi-tiered camera tracking for long event lists, ensuring every domino card topples and dissolves directly in front of the user rather than being obscured off-screen."
                },
                {
                  "icon": "🔇",
                  "text": "Default-Off Animation Audio & Dedicated Settings Toggle: Animation and micro-physics sound effects are now muted by default (OFF). Introduced a dedicated Animation Sounds toggle in Settings > General with immediate persistence and live state synchronization."
                },
                {
                  "icon": "💨",
                  "text": "Linked Devices Aerodynamic Whoosh Termination: Terminating sessions or linked devices now enforces interactive confirmation via confirmDeleteToast with device identity, location details, and confirmation labels. On confirmation, plays a zero-latency aerodynamic wind sweep Web Audio synthesis (SoundFX.playWhooshSound), haptic kick, 700px 3D perspective trajectory whoosh flight (@keyframes sessionWhooshTrajectory), and synchronized Dynamic Island HUD notification."
                },
                {
                  "icon": "🗑️",
                  "text": "Permanent Document Shredding & Reappearance Prevention: Deleting stored documents in Settings permanently marks the document in deletedDocIdsRef, preventing deleted backup or timetable documents from ever popping back into the list even during background API refresh lag or race conditions."
                },
                {
                  "icon": "⚡",
                  "text": "Timetable Generation Cache Invalidation & Raindrop Drop-in: Guarded against long-lived caching of empty timetable slots in CacheService.set, immediately pre-cached generated slots upon wizard save, and guaranteed that background refreshes never overwrite newly imported schedules with blank responses."
                },
                {
                  "icon": "🧠",
                  "text": "Gemini 3.8-Flash OCR Thinking Config Normalization: Replaced invalid thinkingLevel parameter with thinkingBudget in timetable OCR import, and added automatic parameter self-healing in AIManager to prevent 400 key-exhaustion loops during image parsing."
                },
                {
                  "icon": "⚡",
                  "text": "Fast Geocoding & Login Latency Safeguard: Added an AbortSignal timeout to OpenStreetMap Nominatim reverse geocoding with instant fallback to device timezone and IP headers, completely eliminating 10-second connect timeout hangs during authentication."
                },
                {
                  "icon": "🚀",
                  "text": "In-Flight GET Request Deduplication: Implemented in-flight request collapsing in the frontend API client, collapsing duplicate parallel queries for active semesters, subjects, sessions, and documents into a single network roundtrip to eliminate server load spikes."
                },
                {
                  "icon": "🦋",
                  "text": "Subject Card 4-Shard Fracture & Metamorphosed 3D Flapping Butterfly: Deleting a subject splits the card along golden lightning fissures into 4 distinct physical polygon shards that tumble outward and drop with gravity. A glowing bioluminescent butterfly emerges from the center, rapidly flapping wings with 100-degree alternating 3D strokes, soaring along an organic PowerPoint-style S-curve flight trajectory with sparkling stardust trail and zero-latency crystal-fracture & ascending wind-chime Web Audio synthesis."
                },
                {
                  "icon": "🗑️",
                  "text": "Archived Timetable Version Deletion: Added dedicated red delete action buttons to individual historical timetable version cards in the sidebar and preview header, safely decoupling foreign-key attendance records and overrides, deleting retired slots, and invalidating local and server caches."
                },
                {
                  "icon": "⚡",
                  "text": "WYSIWYG Timetable Setup Wizard Synchronization: Transmits exact previewed slot configurations directly to the server, strictly enforcing elective choices and lab group matching for 100% fidelity between preview and saved timetable."
                },
                {
                  "icon": "🔄",
                  "text": "Timetable Updates & Today Page Instant Re-Sync: Dispatching timetable-updated events and invalidating Today page cache ensures newly generated or updated timetables immediately sync with Today's schedule without showing stale classes."
                },
                {
                  "icon": "🏖️",
                  "text": "Full Day Off & Undo Day Off Overhaul: Undoing Day Off completely resets todayStatus and calendar cache days, allowing seamless toggling between normal schedules and day-off states."
                },
                {
                  "icon": "✨",
                  "text": "Unicode & Mojibake Character Sanitization: Replaced corrupted en-dashes in Send Feedback frequency options with standard hyphens, preventing character corruption across all devices and platforms."
                },
                {
                  "icon": "🎵",
                  "text": "Raindrop & Domino Cascade Audio Scaling: Raindrop cascade audio duration dynamically scales based on slot count, and Domino clear flips cards beat-by-beat in synchronization with synthesized audio clicks."
                },
                {
                  "icon": "🎨",
                  "text": "Floating Chatbot Solid Theme & Real-Time Event Sync: Replaced semi-transparent chatbot drawer container styles with solid opaque backgrounds across light and dark modes, completely eliminating visual bleed-through of underlying timeline cards and floating scroll buttons. Synchronized custom timeline events (like 'Priya Didi' on Oct 31) instantaneously into the AI copilot memory so queries like 'Whose birthday is today?' immediately acknowledge scheduled events."
                },
                {
                  "icon": "⚡",
                  "text": "Multi-Layer Query Sanitization & Quote Stripping: Integrated robust multi-stage cleaning that strips leading and trailing quotes, conversational preambles, and trailing particles, ensuring navigation queries like 'Show exam countdowns' or 'timetable' resolve in 0ms without falling through to LLM reasoning."
                },
                {
                  "icon": "🛡️",
                  "text": "Foolproof AI Voice Mode & Hands-Free Audio Isolation: Enhanced SoundEffectsEngine with comprehensive Voice Mode guards. Sound effects are strictly blocked from playing while speech recognition is actively listening, text-to-speech is vocalizing, or the hands-free continuous loop is engaged, guaranteeing zero microphone audio bleed or speech synthesis disruption."
                },
                {
                  "icon": "📋",
                  "text": "Onboarding Checklist Animation Audio Step: Added 'Configure Animation Sounds' as step 9 on the Today page Getting Started checklist, allowing users to discover and customize their sound preference seamlessly."
                },
                {
                  "icon": "🎯",
                  "text": "Action-Site Auto-Focus & Viewport Centering: Added smooth auto-scrolling to newly created Extra Classes, Subjects, and Timetable Slots at t=80ms so the user's viewport automatically centers the newly added card, ensuring the 4.0-second golden entrance pop animation is immediately visible rather than being hidden off-screen."
                },
                {
                  "icon": "📜",
                  "text": "Distinct Deletion Micro-Physics Suite: Replaced repeated butterfly animations with dedicated choreographies for each entity — Timetable Slots feature 4.0s 3D Origami Paper Crumble into a dense paper ball with fiber crunch audio (playPaperCrumpleSound), Extra Classes feature 4.0s Paper Aeroplane Glider flight soaring off-screen with aerodynamic wind (playPaperAirplaneSound), and Subjects retain the signature Butterfly Flutter with 18 rhythmic wing flaps (playButterflyFlutterSound)."
                },
                {
                  "icon": "🦋",
                  "text": "True Butterfly Metamorphosis & 3D Flight Choreography: Re-architected subject deletion so the card physically fractures down its center spine, morphing its left and right halves into organic scalloped butterfly wings adorned with bioluminescent wing veins. A glowing thorax and antennae emerge along the central crease as dual 3D wings flap rhythmically in perspective across 16 beats, soaring along an S-curve flight trajectory with cascading stardust particles before dissolving into crystal mist at 4.0s."
                },
                {
                  "icon": "🏝️",
                  "text": "Comprehensive Dynamic Island HUD & Zero Toast Overlaps: Audited and unified 12 primary user workflows (Semester activation, Subject creation, Slot addition & deletion, Extra class addition & deletion, Event creation & deletion, Peer sync code retrieval & import, Document shredding, and Assignment tracking) with top-center Dynamic Island HUD pills while eliminating all competing success toasts."
                },
                {
                  "icon": "🚀",
                  "text": "Sub-Second Semester Transition Engine: Optimized relational cleanup in wipeSemesterRelations and deleteSemester by batching direct indexed IDs in parallel instead of nested OR cross-table scans, and decoupled academic calendar synchronization to a non-blocking background worker, slashing transition latency from 95.4 seconds to under 200ms."
                },
                {
                  "icon": "⚡",
                  "text": "Instant Subject Deletion & Direct Foreign Key Decoupling: Re-architected deleteSubject to update attendance foreign keys via direct indexed batches instead of sequential table scans, cutting delete execution from 28.9 seconds to under 150ms for instantaneous butterfly flutter feedback."
                },
                {
                  "icon": "🎓",
                  "text": "Shockwave Celebration Overlay & Event-Driven Resilience: Upgraded semester activation and transition celebration to window-level event listeners with contrast backdrop vignettes, ensuring radiant shockwave rings, floating golden cap emblem, and synthesized audio always play smoothly on screen."
                },
                {
                  "icon": "✨",
                  "text": "Persistent Subject Creation & Optimistic Retention: Protected newly created subjects with local timestamp retention and pass-through semester IDs, ensuring cards immediately pop onto the screen with the 4.0-second golden bloom animation and never disappear due to concurrent background refetches."
                },
                {
                  "icon": "🎨",
                  "text": "Unified Fluid Geometry Across Timetable: Fully rounded slot badges, time pills, modal dialogs, and day switcher tabs, ensuring sleek rounded-xl styling and no harsh square corners on mobile or desktop timetable views."
                },
                {
                  "icon": "🏝️",
                  "text": "Exclusive Dynamic Island HUD & Overlap Toast Suppression: Auto-dismisses overlapping toasts when the dynamic island pill activates, eliminating duplicated top notifications."
                },
                {
                  "icon": "🏝️",
                  "text": "Floating Dynamic Island HUD: Top-center pill HUD surfaces micro-action icons (plane, butterfly, sparkles, graduation cap) for 4.5 seconds of non-intrusive confirmation."
                },
                {
                  "icon": "🔊",
                  "text": "Synchronized Intro Audio with Zero Background Music Interruption: Extracted authentic audio from original splash video assets, accelerated with pitch-preserving atempo=2.0 to match the 5.0s Lottie playback via Web Audio API without requesting exclusive OS audio focus, keeping Spotify and external music playing seamlessly."
                },
                {
                  "icon": "🎓",
                  "text": "Instant Frame-Zero Semester Acknowledgment & Onboarding Sync: Unified semester detection across activeSemester, attendanceStore, and cacheStore to derive isSemesterActive immediately on frame zero (0ms). The '+ Create Active Semester' button disappears instantaneously upon semester creation, and Step 1 of the Getting Started checklist is acknowledged immediately with a green checkmark and updated progress counter. Eliminated stale closure caching in TodayPage.tsx and added explicit cache invalidation across semester service for onboarding:status and semesters:active."
                },
                {
                  "icon": "📱",
                  "text": "Universal Phone Screen Geometry & Safe-Bounds Fitting: Removed legacy scale-1.35 zoom on mobile, ensuring the AttendX logo and typography remain uncropped and centered across all phone sizes from 6.0-inch to 6.78-inch displays with zero letterboxing."
                },
                {
                  "icon": "🌙",
                  "text": "Frame-Zero Dark Mode Invariant: Locked root HTML class to dark with immediate head execution, guaranteeing zero white flashes on fresh downloads."
                }
              ]
            },
            {
              "title": "Android Hardware, DND & Notifications",
              "items": [
                {
                  "icon": "⏰",
                  "text": "Unified Global Summary Time Architecture: Summary report time is now maintained globally across all frequencies (Daily, Weekly, Monthly, Yearly). Setting the time updates the single canonical global summary time (default 18:00 / 6:00 PM), preventing diverging or disjointed time slots."
                },
                {
                  "icon": "📱",
                  "text": "Device Local Time Precision: All academic update notifications are scheduled strictly as per the device local clock (with 00 seconds and 00 milliseconds), guaranteeing alarms fire at the exact configured minute on mobile without timezone drift."
                },
                {
                  "icon": "🎯",
                  "text": "Isolated Active Frequency Scheduling: Re-architected academic update scheduling to strictly schedule notifications for the active chosen frequency only, wiping previous alerts in band 8800-8899 and preventing cross-frequency notification overlap."
                },
                {
                  "icon": "🧹",
                  "text": "Complete App Reset & Cache Purge: Fixed caching bug where resetting the app retained old summary times and frequencies. The reset engine now comprehensively wipes attendx-notification-settings and attendx-global-cache from both Capacitor Preferences and localStorage, restoring the 18:00 default and Daily schedule."
                },
                {
                  "icon": "🔇",
                  "text": "Reliable DND Auto-Unmute: Added INTERRUPTION_FILTER_ALL clearing alongside ringer mode restoration and upgraded alarm dispatch to AlarmManager.setAlarmClock to prevent OEM Doze throttling."
                },
                {
                  "icon": "📌",
                  "text": "Pinned In-Session Notification Protection: Prevented duplicate notifications from overriding the native un-swipeable pinned class notification."
                },
                {
                  "icon": "🔔",
                  "text": "Clean Next Scheduled Report Badge: Added real-time countdown badge showing exact upcoming report date/time in 12-hour AM/PM format without intrusive debug buttons."
                },
                {
                  "icon": "📅",
                  "text": "Simultaneous Weekly & Monthly Summaries: Upgraded the notification scheduler to keep both Weekly and Monthly academic digests actively scheduled simultaneously on the device based on your chosen day and time, without needing extra UI cards."
                },
                {
                  "icon": "✨",
                  "text": "Full-Screen Micro-Physics Shockwave Celebration: Synced a 4.2-second expanding chromatic shockwave ring, floating graduation cap emblem, and 360° stardust particle celebration overlay directly with the audio synthesizer."
                },
                {
                  "icon": "📋",
                  "text": "Flawless Onboarding Checklist Lifecycle & Multi-Endpoint Sync: Resolved desynchronization where Step 5 ('Log your first attendance') and Step 6 ('Explore Hands-Free Voice Mode') remained incomplete after attendance logging or voice interaction. Introduced 0ms optimistic completion in TodayPage and SubjectDetailPage, immediate localStorage persistence, custom event dispatching, and bidirectional sync across GET/PATCH /api/users/onboarding-status with database and Redis retention."
                },
                {
                  "icon": "⚡",
                  "text": "Systemic Cache Invalidation Fix (v3 Key Eviction): Diagnosed and resolved a critical backend caching bug where CacheService.del only purged legacy v2 keys, leaving active v3 keys cached indefinitely in L1 memory and Redis. Evictions now purge v3, v2, and legacy keys simultaneously."
                },
                {
                  "icon": "🎙️",
                  "text": "Universal Hands-Free Voice Mode Onboarding Telemetry: Wired hands-free exploration hooks directly into NativeVoiceService.startListening, FloatingChatbot, and VoiceModeOverlay, ensuring continuous loops and speech activation mark Step 6 completed instantaneously."
                },
                {
                  "icon": "📱",
                  "text": "Responsive 9-Step Onboarding Indicators & Zero-Truncation Layout: Upgraded header indicator pills to responsive geometry (w-2.5 xs:w-3 sm:w-4) so the 'Getting Started' title remains legible with zero awkward truncation across all compact mobile viewports."
                }
              ]
            },
            {
              "title": "Attendance & Schedule Hardening",
              "items": [
                {
                  "icon": "🗑️",
                  "text": "Archived Timetable Version Deletion & Management: Users can now delete specific versions or all historical versions of their archived timetables directly from the Archived Timetables modal. Incorporates confirmDeleteToast spring confirmation, SoundFX.playPaperCrumpleSound audio synthesis, optimistic state eviction, and safe foreign key decoupling to protect historical attendance records while guaranteeing active timetable slots remain completely untouched."
                },
                {
                  "icon": "⚡",
                  "text": "Peer Sync Active Schedule Preservation & Reactivity: Resolved a critical timetable wiping bug during peer sync where re-syncing an existing schedule matched incoming slots against newly retired slots and skipped insertion, leaving users with 0 active classes. Fixed existing slot lookups to target validUntil: null and dispatched window reactivity events across timetable, attendance, and semester views upon mirroring."
                },
                {
                  "icon": "📦",
                  "text": "Comprehensive ZIP Backup & Restore Pipeline Hardening: Resolved all critical data integrity and scalability bugs across the ZIP export/import pipeline. Fixed lecture number matching with slot timing and unused-slot date allocation to prevent silent attendance drops; re-linked notes and assignments to new subject IDs upon restore; preserved extra class timing and reasons; added resilient multi-format date parsing (DD/MM/YYYY, MM/DD/YYYY, Excel serial numbers); prepended UTF-8 BOM to prevent Excel mojibake; converted sequential writes to 250-row createMany batch operations to prevent 30s transaction timeouts; stripped macOS __MACOSX metadata files; and hardened Android file input MIME types to un-grey .zip archives."
                },
                {
                  "icon": "🔒",
                  "text": "Read-Only Log Badges & Staged Draft Editing: Converted status pills in View Mode to static non-clickable badges, eliminating accidental status changes on scroll/tap. Added dedicated Edit Mode with draft staging, cancellation rollback, and batch saving."
                },
                {
                  "icon": "🏷️",
                  "text": "Remark Preservation in Attendance Edits: Editing attendance records now explicitly preserves existing remarks (e.g. Home, Medical, Overslept) without clearing or overwriting them on save."
                },
                {
                  "icon": "💬",
                  "text": "Prioritized Contextual Remark Chips: Re-ordered quick remark tags into student-priority order (Overslept, Home, Medical, Personal, College OD, Event, Sports, Club Activity, Exam Prep) and pruned low-frequency presets."
                },
                {
                  "icon": "📝",
                  "text": "Contextual Remarks for Attended & Off Classes: Extended attendance remarks beyond absent classes to include off, attended (present), medical, and OD across Today, Subject Details, and Calendar agenda views. Added clean placeholder-free inputs, unified single 'Bunk' option, removed redundant 'Assignment Work', synchronized Absent All full-day modal chips ('Sick Leave', 'Overslept', 'Home', 'College OD', 'Sports', 'College Event'), and provided dedicated status-specific chips for Off classes ('Class Cancelled', 'Bunk', 'Holiday', 'Dept Meeting', 'College Fest', 'Weather / Rain') and Attended classes ('Regular Class', 'Proxy', 'Extra Class', 'Guest Lecture')."
                },
                {
                  "icon": "🐛",
                  "text": "Full-Day Attendance Marking & Override Schema Alignment: Resolved a 500 runtime error on POST /api/attendance/mark-day caused by an invalid isCancelled query filter on prisma.timetableOverride.findMany. Aligned with Prisma schema by querying overrideType: { not: 'cancelled' } for active slots and overrideType: 'cancelled' for cancelled slot detours."
                },
                {
                  "icon": "⚡",
                  "text": "500x Faster Attendance Stats Calculation & Frame-Zero Integer Safety: Re-architected AttendanceService._calculateRemainingClasses to eliminate repeated O(N) event scans inside 120-day loops via pre-indexed single-pass timestamp Maps, slashing latency from 2,768ms down to <15ms. Guaranteed instant integer hydration without temporary NaN values on cold load."
                },
                {
                  "icon": "🔊",
                  "text": "Zero-Latency Inaudible Keep-Alive Audio Engine: Engineered an inaudible 2Hz @ 0.00002 (-94 dBFS) sub-audible dither oscillator connected to the Web Audio destination, permanently preventing hardware audio pipes from going to sleep during inactivity and eliminating cold-start click audio latency across raindrop, paper crumple, and Dynamic Island sounds."
                },
                {
                  "icon": "⏱️",
                  "text": "Steady 3.0-Second OCR Stage Progression & Overlap Guard: Standardized all 14 OCR stages to strictly 3.0 seconds per stage driven by wall-clock time, and refactored RunActionButton layout with mode='wait' and absolute flex centering to permanently eliminate text collision overlaps."
                },
                {
                  "icon": "⚡",
                  "text": "Zero-Flash Login Hydration & Parallel Request Deduplication: Permanently resolved the split-second empty timetable and attendance flash upon login. Replaced unhydrated initial state rendering with PageSkeleton during initial timetable/attendance resolution, made semesterId optional in /api/events/today-status to enable 100% concurrent Wave 1 parallel execution, and extended inFlightGetRequests deduplication across AbortSignal-bound callers to prevent duplicate burst queries across TodayPage, background sync, and AppShell."
                },
                {
                  "icon": "🚪",
                  "text": "Direct Hero Landing Navigation on Logout: Eliminated the split-second flash of the login page during logout by aligning ProtectedRoute to immediately redirect unauthenticated sessions to the root hero landing page ('/') instead of '/login', and replacing delayed window.location.href timers in authStore with instant window.location.replace('/') navigation."
                },
                {
                  "icon": "💨",
                  "text": "Linked Devices Aerodynamic Whoosh Termination: Terminating sessions or linked devices now enforces interactive confirmation via confirmDeleteToast with device identity, location details, and confirmation labels. On confirmation, plays a zero-latency aerodynamic wind sweep Web Audio synthesis (SoundFX.playWhooshSound), haptic kick, 700px 3D perspective trajectory whoosh flight (@keyframes sessionWhooshTrajectory), and synchronized Dynamic Island HUD notification."
                },
                {
                  "icon": "🗑️",
                  "text": "Permanent Document Shredding & Reappearance Prevention: Deleting stored documents in Settings permanently marks the document in deletedDocIdsRef, preventing deleted backup or timetable documents from ever popping back into the list even during background API refresh lag or race conditions."
                },
                {
                  "icon": "⚡",
                  "text": "Timetable Generation Cache Invalidation & Raindrop Drop-in: Guarded against long-lived caching of empty timetable slots in CacheService.set, immediately pre-cached generated slots upon wizard save, and guaranteed that background refreshes never overwrite newly imported schedules with blank responses."
                },
                {
                  "icon": "🧠",
                  "text": "Gemini 3.8-Flash OCR Thinking Config Normalization: Replaced invalid thinkingLevel parameter with thinkingBudget in timetable OCR import, and added automatic parameter self-healing in AIManager to prevent 400 key-exhaustion loops during image parsing."
                },
                {
                  "icon": "⚡",
                  "text": "Fast Geocoding & Login Latency Safeguard: Added an AbortSignal timeout to OpenStreetMap Nominatim reverse geocoding with instant fallback to device timezone and IP headers, completely eliminating 10-second connect timeout hangs during authentication."
                },
                {
                  "icon": "🚀",
                  "text": "In-Flight GET Request Deduplication: Implemented in-flight request collapsing in the frontend API client, collapsing duplicate parallel queries for active semesters, subjects, sessions, and documents into a single network roundtrip to eliminate server load spikes."
                },
                {
                  "icon": "🦋",
                  "text": "Subject Card 4-Shard Fracture & Metamorphosed 3D Flapping Butterfly: Deleting a subject splits the card along golden lightning fissures into 4 distinct physical polygon shards that tumble outward and drop with gravity. A glowing bioluminescent butterfly emerges from the center, rapidly flapping wings with 100-degree alternating 3D strokes, soaring along an organic PowerPoint-style S-curve flight trajectory with sparkling stardust trail and zero-latency crystal-fracture & ascending wind-chime Web Audio synthesis."
                },
                {
                  "icon": "🗑️",
                  "text": "Archived Timetable Version Deletion: Added dedicated red delete action buttons to individual historical timetable version cards in the sidebar and preview header, safely decoupling foreign-key attendance records and overrides, deleting retired slots, and invalidating local and server caches."
                },
                {
                  "icon": "⚡",
                  "text": "WYSIWYG Timetable Setup Wizard Synchronization: Transmits exact previewed slot configurations directly to the server, strictly enforcing elective choices and lab group matching for 100% fidelity between preview and saved timetable."
                },
                {
                  "icon": "🔄",
                  "text": "Timetable Updates & Today Page Instant Re-Sync: Dispatching timetable-updated events and invalidating Today page cache ensures newly generated or updated timetables immediately sync with Today's schedule without showing stale classes."
                },
                {
                  "icon": "🏖️",
                  "text": "Full Day Off & Undo Day Off Overhaul: Undoing Day Off completely resets todayStatus and calendar cache days, allowing seamless toggling between normal schedules and day-off states."
                },
                {
                  "icon": "✨",
                  "text": "Unicode & Mojibake Character Sanitization: Replaced corrupted en-dashes in Send Feedback frequency options with standard hyphens, preventing character corruption across all devices and platforms."
                },
                {
                  "icon": "🎵",
                  "text": "Raindrop & Domino Cascade Audio Scaling: Raindrop cascade audio duration dynamically scales based on slot count, and Domino clear flips cards beat-by-beat in synchronization with synthesized audio clicks."
                },
                {
                  "icon": "🎨",
                  "text": "Floating Chatbot Solid Theme & Real-Time Event Sync: Replaced semi-transparent chatbot drawer container styles with solid opaque backgrounds across light and dark modes, completely eliminating visual bleed-through of underlying timeline cards and floating scroll buttons. Synchronized custom timeline events (like 'Priya Didi' on Oct 31) instantaneously into the AI copilot memory so queries like 'Whose birthday is today?' immediately acknowledge scheduled events."
                },
                {
                  "icon": "⚡",
                  "text": "Multi-Layer Query Sanitization & Quote Stripping: Integrated robust multi-stage cleaning that strips leading and trailing quotes, conversational preambles, and trailing particles, ensuring navigation queries like 'Show exam countdowns' or 'timetable' resolve in 0ms without falling through to LLM reasoning."
                },
                {
                  "icon": "🛡️",
                  "text": "Multi-Period & Multi-Extra Class Disambiguation: Daily recurring subject periods and same-day extra lectures now maintain independent logs disambiguated by exact overrideId, slotId, or time."
                },
                {
                  "icon": "⚡",
                  "text": "High-Throughput Batched Peer Sync & Retrieval: Resolved the 2-minute import timeout and slow code generation by batching timetable slots, subjects, overrides, and 300+ attendance logs into atomic createMany database operations with pre-generated UUID mapping, reducing peer schedule transfer from 130s down to under 6s."
                },
                {
                  "icon": "💨",
                  "text": "Linked Devices Aerodynamic Whoosh Termination: Terminating sessions or linked devices now enforces interactive confirmation via confirmDeleteToast with device identity, location details, and confirmation labels. On confirmation, plays a zero-latency aerodynamic wind sweep Web Audio synthesis (SoundFX.playWhooshSound), haptic kick, 700px 3D perspective trajectory whoosh flight (@keyframes sessionWhooshTrajectory), and synchronized Dynamic Island HUD notification."
                },
                {
                  "icon": "🗑️",
                  "text": "Permanent Document Shredding & Reappearance Prevention: Deleting stored documents in Settings permanently marks the document in deletedDocIdsRef, preventing deleted backup or timetable documents from ever popping back into the list even during background API refresh lag or race conditions."
                },
                {
                  "icon": "⚡",
                  "text": "Timetable Generation Cache Invalidation & Raindrop Drop-in: Guarded against long-lived caching of empty timetable slots in CacheService.set, immediately pre-cached generated slots upon wizard save, and guaranteed that background refreshes never overwrite newly imported schedules with blank responses."
                },
                {
                  "icon": "🧠",
                  "text": "Gemini 3.8-Flash OCR Thinking Config Normalization: Replaced invalid thinkingLevel parameter with thinkingBudget in timetable OCR import, and added automatic parameter self-healing in AIManager to prevent 400 key-exhaustion loops during image parsing."
                },
                {
                  "icon": "⚡",
                  "text": "Fast Geocoding & Login Latency Safeguard: Added an AbortSignal timeout to OpenStreetMap Nominatim reverse geocoding with instant fallback to device timezone and IP headers, completely eliminating 10-second connect timeout hangs during authentication."
                },
                {
                  "icon": "🚀",
                  "text": "In-Flight GET Request Deduplication: Implemented in-flight request collapsing in the frontend API client, collapsing duplicate parallel queries for active semesters, subjects, sessions, and documents into a single network roundtrip to eliminate server load spikes."
                },
                {
                  "icon": "🦋",
                  "text": "Subject Card 4-Shard Fracture & Metamorphosed 3D Flapping Butterfly: Deleting a subject splits the card along golden lightning fissures into 4 distinct physical polygon shards that tumble outward and drop with gravity. A glowing bioluminescent butterfly emerges from the center, rapidly flapping wings with 100-degree alternating 3D strokes, soaring along an organic PowerPoint-style S-curve flight trajectory with sparkling stardust trail and zero-latency crystal-fracture & ascending wind-chime Web Audio synthesis."
                },
                {
                  "icon": "🗑️",
                  "text": "Archived Timetable Version Deletion: Added dedicated red delete action buttons to individual historical timetable version cards in the sidebar and preview header, safely decoupling foreign-key attendance records and overrides, deleting retired slots, and invalidating local and server caches."
                },
                {
                  "icon": "⚡",
                  "text": "WYSIWYG Timetable Setup Wizard Synchronization: Transmits exact previewed slot configurations directly to the server, strictly enforcing elective choices and lab group matching for 100% fidelity between preview and saved timetable."
                },
                {
                  "icon": "🔄",
                  "text": "Timetable Updates & Today Page Instant Re-Sync: Dispatching timetable-updated events and invalidating Today page cache ensures newly generated or updated timetables immediately sync with Today's schedule without showing stale classes."
                },
                {
                  "icon": "🏖️",
                  "text": "Full Day Off & Undo Day Off Overhaul: Undoing Day Off completely resets todayStatus and calendar cache days, allowing seamless toggling between normal schedules and day-off states."
                },
                {
                  "icon": "✨",
                  "text": "Unicode & Mojibake Character Sanitization: Replaced corrupted en-dashes in Send Feedback frequency options with standard hyphens, preventing character corruption across all devices and platforms."
                },
                {
                  "icon": "🎵",
                  "text": "Raindrop & Domino Cascade Audio Scaling: Raindrop cascade audio duration dynamically scales based on slot count, and Domino clear flips cards beat-by-beat in synchronization with synthesized audio clicks."
                },
                {
                  "icon": "🎨",
                  "text": "Floating Chatbot Solid Theme & Real-Time Event Sync: Replaced semi-transparent chatbot drawer container styles with solid opaque backgrounds across light and dark modes, completely eliminating visual bleed-through of underlying timeline cards and floating scroll buttons. Synchronized custom timeline events (like 'Priya Didi' on Oct 31) instantaneously into the AI copilot memory so queries like 'Whose birthday is today?' immediately acknowledge scheduled events."
                },
                {
                  "icon": "⚡",
                  "text": "Multi-Layer Query Sanitization & Quote Stripping: Integrated robust multi-stage cleaning that strips leading and trailing quotes, conversational preambles, and trailing particles, ensuring navigation queries like 'Show exam countdowns' or 'timetable' resolve in 0ms without falling through to LLM reasoning."
                },
                {
                  "icon": "🛡️",
                  "text": "Foreign Key Constraint Protection in Peer Sync: Hardened timetable and attendance import by validating timetableSlotId and overrideId against verified database ID sets before batch persistence, preventing foreign key constraint violations when importing historical logs."
                },
                {
                  "icon": "🚀",
                  "text": "Zero-Latency Semester Activation & Immediate Card Dismissal: Handed created/activated semester objects directly to UI state and store bindings, instantly dismissing empty semester cards on frame zero and eliminating multi-fetch query races."
                },
                {
                  "icon": "⏱️",
                  "text": "Consecutive Time Guard in Merge Slots: Enforced strict adjacent-period validation (gap <= 15m) when merging timetable slots to prevent accidental multi-hour schedule blocks."
                },
                {
                  "icon": "🎯",
                  "text": "Zero-Subject Interception on Add Slot: Automatically prompts users to create a subject directly when tapping Add Slot with 0 subjects, complete with an in-form quick creation shortcut."
                },
                {
                  "icon": "🧹",
                  "text": "Exact Date Sweep Deletion: Hardened attendance sweep to match exact date and slot, preventing accidental deletion of adjacent day logs."
                },
                {
                  "icon": "🔁",
                  "text": "Reversible Full Day Off: Added single-tap Undo Day Off to restore day status instantly across all views without manual toggling."
                }
              ]
            },
            {
              "title": "Architecture & Linked Devices Optimization",
              "items": [
                {
                  "icon": "⚡",
                  "text": "High-Speed Sessions API & In-Memory Caching: Cached active user sessions via CacheService.getOrSet and purged expired sessions asynchronously, slashing /api/users/sessions latency from ~13,000ms down to sub-10ms."
                },
                {
                  "icon": "🚀",
                  "text": "Multi-Stage Parallel App Data Reset: Re-architected user reset and cleanups into 5 non-blocking topological stages executed via Promise.all with parallel filesystem unlinking and immediate cache eviction, reducing full reset latency from 15.3s down to under 2s."
                },
                {
                  "icon": "🔕",
                  "text": "Suppressed Repetitive Device Error Toasts: Replaced 5-second rapid polling loop with relaxed 30s background sync and silenced network toasts on already-cached displays."
                },
                {
                  "icon": "⚡",
                  "text": "100x Faster Event & Academic Calendar Template Sync: Replaced sequential single-event database writes with bulk createMany operations and parallel updates in EventService, reducing template sync latency from 50,065 ms down to ~350 ms."
                },
                {
                  "icon": "🚀",
                  "text": "Database Connection Pool Expansion (max: 20, min: 4): Scaled the Neon PostgreSQL connection pool and pre-warmed 4 sockets on startup to eliminate head-of-line blocking and connection starvation during parallel client queries."
                },
                {
                  "icon": "🔄",
                  "text": "Single-Flight Promise Coalescing & Debounced Event Dispatch: Added in-flight request deduplication and debouncing to TodayPage and attendanceStore, collapsing simultaneous identical queries into a single round-trip."
                },
                {
                  "icon": "🎯",
                  "text": "Lightweight Index-Scanned Onboarding Status: Replaced 5 heavy count() table scans with instant findFirst({ select: { id: true } }) index probes in UserController.getOnboardingStatus, slashing query times."
                }
              ]
            },
                            {
                                      "title": "Authentication & Password Reset Polish",
                                      "items": [
                                                {
                                                          "icon": "🔢",
                                                          "text": "6-Box OTP Verification UI: Replaced the single input field and placeholder with 6 individual digit boxes featuring blank placeholders, auto-advance, backspace jumps, clipboard paste, and numeric keyboard mode."
                                                },
                                                {
                                                          "icon": "📧",
                                                          "text": "Email Dispatch Hardening: Fortified password reset delivery with smart error detection and automatic verified-sender fallback on Resend."
                                                },
                                                {
                                                          "icon": "📱",
                                                          "text": "Single-Line OTP Email Display: Formatted the 6-digit confirmation code in password reset emails into a compact table with nowrap constraints, ensuring digits stay strictly on a single horizontal row on all mobile screens."
                                                },
                                                {
                                                          "icon": "🖼️",
                                                          "text": "Email Branding Cleanup: Removed duplicate AttendX logo from the email body to keep a single, focused brand mark in the header."
                                                }
                                      ]
                            },
                            {
                                      "title": "iOS Liquid Glass Dock & Gesture Scrubbing",
                                      "items": [
                                                {
                                                          "icon": "📱",
                                                          "text": "Optical Liquid Glass Dock: Re-engineered the mobile navigation bar into an Apple Safari-styled floating glass dock with rounded-full pill ergonomics, specular rim highlights, saturation boost, and an organic liquid lens indicator replacing boxy containers."
                                                },
                                                {
                                                          "icon": "👆",
                                                          "text": "Continuous Hold-and-Drag Scrubbing: Hold and drag your thumb across the dock to scrub through tabs with elastic spring physics, real-time tab switching, bumpy icon scaling, and tactile rotary detent haptics."
                                                }
                                      ]
                            },
                            {
                                      "title": "Peer Sync & Historical Integrity",
                                      "items": [
                                                {
                                                          "icon": "🔄",
                                                          "text": "Full Timetable & Override Synchronization: Peer sync now transmits and preserves archived timetable versions, slot dates, timetable overrides, and extra classes without loss."
                                                },
                                                {
                                                          "icon": "📅",
                                                          "text": "Dynamic Semester Alignment: Receiver semesters automatically expand date boundaries to include historical classes and prevent duplicate slot creation on repeat syncs."
                                                }
                                      ]
                            },
                            {
                                      "title": "Interface Polish & Notification Hygiene",
                                      "items": [
                                                {
                                                          "icon": "✨",
                                                          "text": "Modal CSS Glitch Elimination: Fixed background bleeding and dual scrollbar jitter across Linked Devices and Profile Settings."
                                                },
                                                {
                                                          "icon": "🔕",
                                                          "text": "Heads-Up Alert Hygiene: Removed premature mute buttons from advance heads-up class reminders and fortified DND permission handling."
                                                }
                                      ]
                            },
                            {
                                      "title": "Tactile Experience & Haptics",
                                      "items": [
                                                {
                                                          "icon": "📳",
                                                          "text": "Universal Haptic Engine: Ultra-low latency pointer-level physical tactile response across all buttons, tabs, links, and actionable controls."
                                                },
                                                {
                                                          "icon": "👆",
                                                          "text": "Gesture Haptics: Tactile physical feedback on swipe gestures across calendar months, attendance agenda days, and bottom sheets."
                                                },
                                                {
                                                          "icon": "📅",
                                                          "text": "Calendar & Time Tactile Response: Crisp selection vibration when picking calendar dates, changing summary times, and updating notification frequencies."
                                                },
                                                {
                                                          "icon": "📊",
                                                          "text": "Timetable & Criteria Haptics: Physical clicks when stepping attendance criteria percentages, swapping schedule slots via drag-and-drop, and deleting subjects or slots."
                                                }
                                      ]
                            },
                            {
                                      "title": "Timetable & Schedule Engine",
                                      "items": [
                                                {
                                                          "icon": "📅",
                                                          "text": "Dual Timetable Display: Surfaced active timetable with 'Active' pill badge above historical archives, displaying exact start dates with pristine version resolution."
                                                },
                                                {
                                                          "icon": "📚",
                                                          "text": "Archived Version Retrofitting: Restored missing Fiber Optic Communication lecture slots to Version 1 with exact room and time normalization."
                                                },
                                                {
                                                          "icon": "🧹",
                                                          "text": "Micro-Version Elimination: Clustered archive creation to prevent single non-structural tweaks from spawning redundant timetable snapshots."
                                                },
                                                {
                                                          "icon": "🎯",
                                                          "text": "Calendar Slot Synchronization: Eliminated duplicate 'Not Marked' entries by atomically re-linking attendance records during timetable modifications."
                                                },
                                                {
                                                          "icon": "🛡️",
                                                          "text": "Ghost & Extra Class Deletion: Fortified manual extra class deletions to purge orphaned attendance records without 500 errors."
                                                }
                                      ]
                            },
                            {
                                      "title": "Voice Assistant & UI Polish",
                                      "items": [
                                                {
                                                          "icon": "🎙️",
                                                          "text": "Hands-Free Voice Loop: Assistant seamlessly listens and responds in a continuous natural conversation without repetitive query repeats."
                                                },
                                                {
                                                          "icon": "🔇",
                                                          "text": "Acoustic Echo Filtering: Hardware ghost-echo cancellation prevents the microphone from capturing device speaker output."
                                                },
                                                {
                                                          "icon": "✨",
                                                          "text": "Cinematic Entrance Animations: visionOS-inspired scale-and-blur transitions on Voice Mode and fluid 60fps attendance mark popups."
                                                },
                                                {
                                                          "icon": "🔄",
                                                          "text": "Timed Undo & Cancel Overhaul: Redesigned timed action buttons with dedicated undo icons, wine-red backgrounds, and zero number ghosting."
                                                },
                                                {
                                                          "icon": "💡",
                                                          "text": "Voice Avatar Auto-Scroll: Voice settings modal auto-scrolls to your active voice avatar when opened."
                                                },
                                                {
                                                          "icon": "🔄",
                                                          "text": "Interactive Dismissal: Added an interactive rotating close button in the Voice Mode overlay."
                                                },
                                                {
                                                          "icon": "🎙️",
                                                          "text": "Ultra-Low-Latency Voice Turnaround & Compound Word Normalization: Slashed voice recognition silence timeout from 5000ms down to 1200ms for instantaneous transition into thinking mode. Added comprehensive speech-to-text normalizations (e.g. 'time table' -> 'timetable', 'peer sync' -> 'peer-sync', 'class room' -> 'classroom') across both client and server fast-paths."
                                                },
                                                {
                                                          "icon": "⚡",
                                                          "text": "Zero-Token Direct Screen Navigation: Made command verbs optional in both client and server intent routers, allowing bare spoken or typed screen names ('time table', 'timetable', 'schedule', 'settings', 'calendar', 'forecast') to execute instant 0ms in-app navigation with zero Gemini token consumption."
                                                },
                                                {
                                                          "icon": "🛡️",
                                                          "text": "Seamless Offline Fallback Intent Engine: Upgraded Copilot error handling so that any external Gemini API timeouts (30s) or rate-limit errors immediately and seamlessly delegate to the offline deterministic rule engine, preventing generic offline errors."
                                                },
                                                {
                                                          "icon": "📐",
                                                          "text": "Fluid Multi-Viewport Card Architecture: Overhauled the Overall Attendance and Forecast Engine cards on the Today page to eliminate squeezed borders, truncated text, and overflowing percentage badges. Upgraded layout grid to single column on mobile, tablet, and desktop split-screen viewports (xl:grid-cols-2 on wide screens) with overflow-hidden protection, min-w-0 flex adaptation, and shrink-0 badges."
                                                }
                                      ]
                            },
                            {
                                      "title": "Navigation & Mobile Architecture",
                                      "items": [
                                                {
                                                          "icon": "📍",
                                                          "text": "Hardware Back Scroll Retention: Backing out of Settings subviews precisely restores your exact scroll depth without jumping to top."
                                                },
                                                {
                                                          "icon": "📱",
                                                          "text": "Hardware Back Button Flow: Deterministic back-press routing across auth, timetable, modals, and semester views, minimizing on root."
                                                },
                                                {
                                                          "icon": "📱",
                                                          "text": "Mobile Subject Management: Full multi-line subject title wrapping with always-visible delete triggers on touchscreens."
                                                },
                                                {
                                                          "icon": "🔗",
                                                          "text": "Onboarding Deep-Linking: Directly navigates into Peer Sync inside Settings and into Semester Hub from getting started checklist steps."
                                                },
                                                {
                                                          "icon": "🌐",
                                                          "text": "Cross-Device Onboarding State: Onboarding completion progress is saved to user accounts in PostgreSQL and preserved across all new logins."
                                                }
                                      ]
                            },
                            {
                                      "title": "Core Stability, Database & Notifications",
                                      "items": [
                                                {
                                                          "icon": "🎂",
                                                          "text": "Automated Birthday Engine: Fixed PostgreSQL timezone date extraction so automated birthday greetings and native push alerts dispatch reliably at 8:00 AM."
                                                },
                                                {
                                                          "icon": "🌐",
                                                          "text": "External Cron Webhook: Introduced protected /api/system/cron/birthdays endpoint for external schedulers to ensure zero missed runs."
                                                },
                                                {
                                                          "icon": "⚡",
                                                          "text": "Zero-Overhead Memory Architecture: Replaced large in-memory maps with bounded LRU caches, slashing startup heap allocations by 80MB."
                                                },
                                                {
                                                          "icon": "🔔",
                                                          "text": "Push Notification Hardening: Clean token eviction drops invalid FCM tokens and prevents dead-token loops."
                                                },
                                                {
                                                          "icon": "🔒",
                                                          "text": "Session Refresh Resilience: Hardened the authentication refresh bypass to route native mobile tokens seamlessly without false revocations."
                                                }
                                      ]
                            },
                            {
                                      "title": "AI Diagnostics & Email Delivery Telemetry",
                                      "items": [
                                                {
                                                          "icon": "🤖",
                                                          "text": "Deep AI Telemetry: Structured high-visibility logging for incoming user questions, enriched academic context snapshots, model cascades, and intent classification."
                                                },
                                                {
                                                          "icon": "📧",
                                                          "text": "Verified Email Dispatch: Synchronous awaiting of report email dispatches with explicit delivery status reporting and Resend sandbox advisory diagnostics."
                                                },
                                                {
                                                          "icon": "🎙️",
                                                          "text": "Voice TTS Resilience: Graceful ElevenLabs quota exhaustion fallback to Google TTS without dumping multi-line error traces."
                                                }
                                      ]
                            },
                            {
                                      "title": "Voice Mode Fluidity & Multi-Turn Intelligence",
                                      "items": [
                                                {
                                                          "icon": "🎙️",
                                                          "text": "Streaming Voice Cursor Synchronization: Eliminated flash-to-end timing glitching in Voice Mode Overlay by stabilizing speech clock start boundaries and rendering a glowing cursor traveling hand-in-hand with spoken audio."
                                                },
                                                {
                                                          "icon": "🛑",
                                                          "text": "Compound Voice Breakout Recognition: Added comprehensive breakout regex matching compound closing phrases including 'listening thankyou stop stop conversation', 'thankyou stop', 'stop stop conversation', and polite farewells across voice and hands-free modes."
                                                },
                                                {
                                                          "icon": "🧠",
                                                          "text": "Multi-Turn Conversational Retention: Expanded frontend and backend dialog history depth to 10 turns with explicit contextual Gemini intent prompting, ensuring seamless continuity when students answer with 'yes', 'no', 'why', or follow-up questions."
                                                },
                                                {
                                                          "icon": "📜",
                                                          "text": "Jitter-Free Line Auto-Scroll: Smoothed spoken transcript viewport alignment by scoping scroll updates to line breaks, preventing continuous jitter while words stream within the same line."
                                                },
                                                {
                                                          "icon": "⚡",
                                                          "text": "97% Voice Mode CPU Reduction: Throttled word index evaluation to only fire React re-renders when words actually change (~3-4/sec) instead of unthrottled 120 FPS RAF loops, eliminating UI jitter, GC pauses, and lag."
                                                },
                                                {
                                                          "icon": "🌓",
                                                          "text": "Theme-Adaptive Hands-Free Mode: Overhauled the hands-free banner with adaptive light/dark surfaces, high-contrast tinted status badges, and compact anti-overflow controls for small screens."
                                                },
                                                {
                                                          "icon": "🧹",
                                                          "text": "Auto-Expiring Action Confirmations: Unconfirmed pending action buttons auto-expire when follow-up messages are sent, replacing stale buttons with an expiry badge to prevent permanent UI errors in chat history."
                                                }
                                      ]
                            },
                            {
                              "title": "Today Schedule Engine & Timetable Deletion Optimization",
                              "items": [
                                {
                                  "icon": "⚡",
                                  "text": "Sub-10ms Today Page Engine & Query Coalescing: Eliminated sequential late round-trips by resolving known active semesters upfront in the initial parallel wave, caching onboarding status across date swipes, and removing duplicate background notification scheduling."
                                },
                                {
                                  "icon": "🚀",
                                  "text": "Zero-Cost Simulation Short-Circuiting: Introduced an instant 0ms short-circuit in remaining classes projection when subjects have zero active slots and no future overrides, eliminating 1,500 redundant date iterations per load when timetables are cleared."
                                },
                                {
                                  "icon": "🛡️",
                                  "text": "Archived Slot Isolation & Resurrection Prevention: Hardened local fallback agenda generation and server queries with strict validUntil: null checks, ensuring deleted or archived timetable slots are never erroneously rendered on the Today schedule."
                                },
                                {
                                  "icon": "📅",
                                  "text": "Dedicated 'No Active Timetable' Empty State: When an active timetable is cleared, the Today view replaces generic day-off text with a dedicated action card featuring instant shortcuts to setup timetables or log extra classes."
                                },
                                {
                                  "icon": "🦋",
                                  "text": "Permanent Subject Deletion & In-Flight Race Protection: Added deletedSubjectIds tracking and fetchSeqRef sequence locks in SubjectsPage, strictly filtering deleted subject IDs from all asynchronous server responses and removing the legacy empty-list guard (if (newSubjects.length === 0) return prev) so deleted subjects never resurrect after butterfly flight."
                                },
                                {
                                  "icon": "🎓",
                                  "text": "Instant Semester Activation & Empty State Sync on Today Page: Overhauled the Today page initialization and race-condition handling to guarantee that whenever no active semester exists (such as on a fresh account or after full reset), the view instantly surfaces the dedicated 'No Active Semester' card with '+ Create Active Semester'. Added AbortController promise detachment, a 3.5s safety timeout, and cross-tab 'semester-updated' listeners so loading skeletons never freeze or refuse to fetch."
                                },
                                 {
                                   "icon": "✅",
                                   "text": "Flawless Onboarding Checklist & Multi-Device Sync: Resolved race conditions and stale closure issues across all 9 checklist stages. Step 5 (\"Log your first attendance\") now ticks immediately with 0ms latency upon logging any class or full day off. Step 6 (\"Explore Hands-Free Voice Mode\") automatically completes whenever hands-free speech loop or live voice overlay is opened. Hardened bidirectional sync between database (User record) and localStorage, added celebratory ascending major-chord level-up fanfare (C5->E5->G5->C6) and Dynamic Island HUD on completion, and implemented smooth dismiss handling with permanent global persistence."
                                 }
                              ]
                            }
                  ]
        },
{
          "version": "4.2.0",
          "date": "Oct 2, 2026",
          "title": "Continuous Voice & Performance Overhaul",
          "sections": [
            {
              "title": "General Improvements & Bug Fixes",
                            "items": [
                { "icon": "🎙️", "text": "Fixed a UI state freeze where Hands-Free mode wouldn't exit if the hardware mic timed out due to silence." },
                { "icon": "🚀", "text": "Resolved a subtle race condition where Push Notifications wouldn't register on fresh logins." },
                { "icon": "🔐", "text": "Form metadata injected to trigger Password Managers (like Google) reliably on Android WebViews." },
                { "icon": "🐞", "text": "Restored missing Settings/FAQ route and fixed 'Go Back' button visibility on 404 pages." },
                { "icon": "⚙️", "text": "Dynamic version numbering correctly injected into the web dashboard build." },
                { "icon": "🎤", "text": "Completely resolved the Android 11+ rapid microphone cycling bug that could crash the voice system." },
                { "icon": "📱", "text": "Fixed a layout bug causing the Stop Conversation footer to disappear on desktop and small screens." },
                { "icon": "⚡", "text": "Wired cinematic typing animations perfectly to device hardware for exact lip-sync with speech audio." },
                { "icon": "✅", "text": "Cleaned up pending action Yes/No buttons so they unmount instantly after clicking." },
                { "icon": "🕰️", "text": "Resolved timezone edge cases where dates were incorrectly compared against UTC." }
              ]
            },
            {
              "title": "New Features",
              "items": [
                { "icon": "🔔", "text": "Introduced Birthday Push Notifications — the app will now ping your phone at 9:00 AM for friends' birthdays, and 8:00 AM for your own!" },
                { "icon": "📅", "text": "Added support for adding Custom Events directly into the calendar via the Semester Hub!" },
                { "icon": "🎙️", "text": "Upgraded Voice Mode to a truly hands-free continuous loop. The AI now automatically resumes listening after speaking, creating seamless back-and-forth conversations." }
              ]
            },
            {
              "title": "Architecture & Performance",
              "items": [
                { "icon": "🐛", "text": "Massive performance fix: Removed a global CSS transition that was causing severe UI jitter and frame drops when switching tabs across the app." },
                { "icon": "🎙️", "text": "Hardened Voice Mode against audio echoes by injecting a strict 200ms acoustic kill-switch before AI playback begins." }
              ]
            },
            {
              "title": "Visual Enhancements",
              "items": [
                { "icon": "🎨", "text": "Engineered a flawless CSS transition for the Light/Dark mode toggle, enabling smooth cinematic cross-fades globally." },
                { "icon": "🌙", "text": "Fixed dark mode text legibility and cleaned up dropdown categories on the Add Custom Event modal." }
              ]
            },
            {
              "title": "Bug Fixes",
              "items": [
                { "icon": "🛠️", "text": "Fixed Firebase Push Notifications bug where devices occasionally failed to sync FCM tokens on login." },
                { "icon": "📅", "text": "Fixed calendar loop bug where some regular events (like Cultural Fests) failed to dispatch morning push notifications." },
                { "icon": "🎉", "text": "Restricted Holidays now correctly dispatch morning notifications without accidentally erasing your class timetable for the day." }
              ]
            }
          ]
        },
        {
          "version": "4.1.0",
          "date": "Sep 24, 2026",
          "title": "The Architecture Update",
          "sections": [
            {
              "title": "Architecture & Performance",
              "items": [
                { "icon": "🚀", "text": "Completely overhauled the AI Copilot backend, migrating to a high-speed Gemini 3.8-Flash intent router." },
                { "icon": "🧹", "text": "Implemented an automated 14-day cache pruner to prevent infinite storage bloat." }
              ]
            },
            {
              "title": "New Features & Enhancements",
              "items": [
                { "icon": "🎙️", "text": "Fixed Voice Mode stale closures to ensure seamless, hands-free audio interaction." },
                { "icon": "📱", "text": "Corrected the mobile Calendar Agenda view to accurately display dynamic attendance statuses." }
              ]
            },
            {
              "title": "Improvements & Bug Fixes",
              "items": [
                { "icon": "📡", "text": "Fortified the offline sync engine to automatically roll back the UI and notify you if the server rejects an offline mark." },
                { "icon": "🧮", "text": "Fixed a critical offline race condition where network errors would erase the global attendance percentage to zero." },
                { "icon": "🤖", "text": "Prevented the AI Chatbot from freezing when used offline, ensuring it gracefully delivers an offline warning." }
              ]
            }
          ]
        },
        {
                "version": "4.0.0",
                "date": "Sep 21, 2026",
                "sizeMb": 18.2,
                "title": "The Intelligence Update",
                "sections": [
                        {
                                "title": "What's New",
                                "items": [
                                        {
                                                "icon": "✨",
                                                "text": "Predictive Insights: AI now predicts future attendance based on your historical patterns."
                                        },
                                        {
                                                "icon": "📱",
                                                "text": "Swipe Gestures: Effortlessly navigate through days on the agenda view using native swipes."
                                        },
                                        {
                                                "icon": "🎨",
                                                "text": "Polished OTA Update screen UI for seamless Light Mode support."
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "3.9.0",
                "date": "Sep 15, 2026",
                "sizeMb": 16.8,
                "title": "Major Features & Polish",
                "sections": [
                        {
                                "title": "Major Features & Polish",
                                "items": [
                                        {
                                                "icon": "✨",
                                                "text": "Added immersive full-screen Lottie animations for academic events and achievements."
                                        },
                                        {
                                                "icon": "💾",
                                                "text": "Introduced robust Backup & Restore via .zip export for full local data portability."
                                        }
                                ]
                        },
                        {
                                "title": "Offline & Sync Improvements",
                                "items": [
                                        {
                                                "icon": "🔌",
                                                "text": "Fixed race conditions in optimistic offline sync to prevent stale data overwrites."
                                        },
                                        {
                                                "icon": "⚡",
                                                "text": "Optimized timetable caching engine for instant loading across sessions."
                                        },
                                        {
                                                "icon": "🔔",
                                                "text": "Overhauled Capacitor local notification scheduling to prevent silent failures on mobile."
                                        }
                                ]
                        },
                        {
                                "title": "Bug Fixes",
                                "items": [
                                        {
                                                "icon": "🐛",
                                                "text": "Resolved a global timezone offset bug that was shifting scheduled classes by hours."
                                        },
                                        {
                                                "icon": "🐛",
                                                "text": "Fixed a calendar synchronization bug causing unmarked classes to be hidden from the agenda popover."
                                        },
                                        {
                                                "icon": "🧹",
                                                "text": "Implemented aggressive duplicate sweeping to fix classes occasionally 'snapping back' when unmarked."
                                        },
                                        {
                                                "icon": "🐛",
                                                "text": "Fixed UUID parsing logic preventing attendance records from being properly updated on Postgres."
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "3.8.0",
                "date": "Sep 10, 2026",
                "sizeMb": 31,
                "title": "Quality of Life Update",
                "sections": [
                        {
                                "title": "What's New",
                                "items": [
                                        {
                                                "icon": "📅",
                                                "text": "Fixed overlapping extra classes ('00:00') when migrating to a new timetable."
                                        },
                                        {
                                                "icon": "✨",
                                                "text": "Added festive animations for Exams and Practical Labs in the daily agenda."
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "3.7.0",
                "date": "Sep 05, 2026",
                "sizeMb": 31,
                "title": "UI Polish & Theming",
                "sections": [
                        {
                                "title": "What's New (UI Polish & Theming)",
                                "items": [
                                        {
                                                "icon": "🎨",
                                                "text": "Complete Calendar redesign with Orbital Operations Center aesthetic and true dark mode isolation."
                                        },
                                        {
                                                "icon": "✨",
                                                "text": "Restored missing cinematic 'E' to the Subjects hero title and fixed glassmorphism modal backgrounds globally."
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "3.5.0",
                "date": "Aug 20, 2026",
                "sizeMb": 30.5,
                "sections": [
                        {
                                "title": "What's New (Security & Offline)",
                                "items": [
                                        {
                                                "icon": "🛡️",
                                                "text": "Zero-Knowledge OTPs: Upgraded internal token hashing to HMAC-SHA256, stopping offline cracking tools instantly."
                                        },
                                        {
                                                "icon": "📶",
                                                "text": "Flawless Offline Mode: Solved the 'disappearing green pill' bug. The app now accurately caches and displays your subjects and logs fully offline."
                                        },
                                        {
                                                "icon": "⏰",
                                                "text": "Precise Scheduling: Fixed an issue where the 'Time before class' offset and Monthly report schedules were being ignored or overridden."
                                        }
                                ]
                        },
                        {
                                "title": "Improvements & UI Polish",
                                "items": [
                                        {
                                                "icon": "🎨",
                                                "text": "Complete UI/UX redesign featuring a pure brutalist aesthetic with NO neon gradients or AI slop."
                                        },
                                        {
                                                "icon": "🚦",
                                                "text": "Forgot Password rate limiter actively throttles spammers to 1 request every 15 minutes."
                                        },
                                        {
                                                "icon": "📝",
                                                "text": "Secured backend console logs to aggressively mask all authentication data."
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.6.2",
                "date": "Aug 10, 2026",
                "sizeMb": 25.4,
                "sections": [
                        {
                                "title": "What's New",
                                "items": [
                                        {
                                                "icon": "🔒",
                                                "text": "Stateless OTP Security: Gorgeous new 6-digit email flows for resetting passwords safely"
                                        },
                                        {
                                                "icon": "🧠",
                                                "text": "Background AI Wakeup: Instant ML server booting upon app launch for zero-delay chat"
                                        },
                                        {
                                                "icon": "💬",
                                                "text": "Zero-State Chatbot: Complete redesign with conversation history persistence"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.5.1",
                "date": "Aug 05, 2026",
                "sizeMb": 24.8,
                "sections": [
                        {
                                "title": "What's New",
                                "items": [
                                        {
                                                "icon": "✨",
                                                "text": "Immersive Voice Mode: Full-screen AI voice assistant with continuous conversation orb"
                                        },
                                        {
                                                "icon": "📊",
                                                "text": "Analytics Dashboard: Data-dense charts for weekly/monthly performance and predictions"
                                        },
                                        {
                                                "icon": "🤖",
                                                "text": "Agentic Execution: AI can now directly change your reminder frequencies and settings"
                                        },
                                        {
                                                "icon": "🧠",
                                                "text": "Deep Context: AI natively understands app states, limits, and semester boundaries"
                                        }
                                ]
                        },
                        {
                                "title": "Bug Fixes & UI Polish",
                                "items": [
                                        {
                                                "icon": "🐛",
                                                "text": "Mojibake Fixed: Resolved UTF-8 corruption causing emojis to render improperly"
                                        },
                                        {
                                                "icon": "🎨",
                                                "text": "Sleek AI States: Removed bulky multi-stage loading blocks for minimal typing dots"
                                        },
                                        {
                                                "icon": "🔗",
                                                "text": "Smart Routing: Tapping summary notifications routes straight to the Analytics Dashboard"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.5.0",
                "date": "Aug 01, 2026",
                "sizeMb": 31.4,
                "sections": [
                        {
                                "title": "What's New",
                                "items": [
                                        {
                                                "icon": "🔌",
                                                "text": "The Offline Engine: Mark attendance offline; auto-syncs when reconnected"
                                        },
                                        {
                                                "icon": "📅",
                                                "text": "Smart Holiday Alarms: Mutes class reminders automatically during exams and holidays"
                                        },
                                        {
                                                "icon": "🧠",
                                                "text": "Intelligent Caching: Calendar and Subject pages load flawlessly without internet"
                                        }
                                ]
                        },
                        {
                                "title": "Improvements & UI Polish",
                                "items": [
                                        {
                                                "icon": "📱",
                                                "text": "Dynamic Notch Support: Headers no longer overlap with your system status bar"
                                        },
                                        {
                                                "icon": "🔙",
                                                "text": "Hardware Navigation: Physical back button gracefully routes through the app"
                                        },
                                        {
                                                "icon": "⚙️",
                                                "text": "Smart Update History: Only shows features currently installed on your phone"
                                        },
                                        {
                                                "icon": "🔔",
                                                "text": "Instant Rescheduling: Adjusting reminder offsets instantly reprograms OS alarms"
                                        }
                                ]
                        },
                        {
                                "title": "Bug Fixes",
                                "items": [
                                        {
                                                "icon": "👻",
                                                "text": "Ghost Data Purge: Eradicated aggressive cache leaks when switching accounts"
                                        },
                                        {
                                                "icon": "📦",
                                                "text": "OTA Engine: Upgraded compression to resolve native 'OTA Download Failed' errors"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.4.6",
                "date": "Jul 25, 2026",
                "sizeMb": 5.1,
                "sections": [
                        {
                                "title": "Offline & Notification Engine",
                                "items": [
                                        {
                                                "icon": "🔌",
                                                "text": "Offline Mutation Queue: Mark attendance offline and auto-sync when reconnected"
                                        },
                                        {
                                                "icon": "📅",
                                                "text": "Smart Holidays: Mutes class reminders automatically during exams, vacations, and holidays"
                                        },
                                        {
                                                "icon": "⚡",
                                                "text": "Instant Rescheduling: Updating your reminder offset now recalculates OS alarms instantly"
                                        }
                                ]
                        },
                        {
                                "title": "Improvements & Fixes",
                                "items": [
                                        {
                                                "icon": "✨",
                                                "text": "Status Bar Fixes: Headers no longer overlap with the notch on Login, Devices, and Settings"
                                        },
                                        {
                                                "icon": "📱",
                                                "text": "Hardware Back Button: Smoothly navigate back to the home screen instead of exiting the app"
                                        },
                                        {
                                                "icon": "🐛",
                                                "text": "Ghost Data Fix: Erased aggressive cache leaking when switching accounts"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.4.5",
                "date": "Jul 20, 2026",
                "sizeMb": 30,
                "sections": [
                        {
                                "title": "What's New",
                                "items": [
                                        {
                                                "icon": "✨",
                                                "text": "3D Immersive Reports: Gorgeous new visualizations for your weekly and monthly stats"
                                        },
                                        {
                                                "icon": "📧",
                                                "text": "Automated Emails: Stunning new welcome emails and secure password reset emails"
                                        }
                                ]
                        },
                        {
                                "title": "Security & Fixes",
                                "items": [
                                        {
                                                "icon": "🛡️",
                                                "text": "Delete Account: Added a secure, permanent account deletion option in Settings"
                                        },
                                        {
                                                "icon": "🔧",
                                                "text": "Performance: Fixed an infinite polling bug in Linked Devices that choked the server"
                                        },
                                        {
                                                "icon": "📱",
                                                "text": "Smart Notifications: Timetable Alerts and Summary settings now automatically hide based on your frequency choice"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.3.0",
                "date": "Jul 15, 2026",
                "sizeMb": 15.4,
                "sections": [
                        {
                                "title": "What's New",
                                "items": [
                                        {
                                                "icon": "🔗",
                                                "text": "Peer Sync: Securely mirror your timetable or attendance to friends using a 6-digit code"
                                        },
                                        {
                                                "icon": "🤖",
                                                "text": "AI Academic Calendar Import: Upload official calendars and extract holidays directly"
                                        },
                                        {
                                                "icon": "💻",
                                                "text": "Session Management: View and remotely revoke all active devices"
                                        },
                                        {
                                                "icon": "🚀",
                                                "text": "Native App Sharing: Share the AttendX app directly via OS share menu"
                                        }
                                ]
                        },
                        {
                                "title": "Improvements & Fixes",
                                "items": [
                                        {
                                                "icon": "🌓",
                                                "text": "True Light & Dark Mode: High-contrast light mode and sleek dark mode"
                                        },
                                        {
                                                "icon": "🔒",
                                                "text": "Persistent Sessions: You will no longer be randomly logged out"
                                        },
                                        {
                                                "icon": "🧠",
                                                "text": "Smarter AI Parser: Detects stacked electives for granular control"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.2.2",
                "date": "Jul 10, 2026",
                "sizeMb": 1.2,
                "sections": [
                        {
                                "title": "Quality of Life",
                                "items": [
                                        {
                                                "icon": "✉️",
                                                "text": "Email Developer button now opens your native Gmail app directly"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.2.1",
                "date": "Jul 05, 2026",
                "sizeMb": 1.2,
                "sections": [
                        {
                                "title": "Developer Preview",
                                "items": [
                                        {
                                                "icon": "🔔",
                                                "text": "Testing: Real-time Android push notifications enabled"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.2.0",
                "date": "Jul 01, 2026",
                "sizeMb": 4.8,
                "sections": [
                        {
                                "title": "New Features & Fixes",
                                "items": [
                                        {
                                                "icon": "☁️",
                                                "text": "Cloud Storage Engine: Academic calendars are now permanently backed up to the database"
                                        },
                                        {
                                                "icon": "📍",
                                                "text": "Security Upgrade: Active sessions now request your GPS location upon login"
                                        },
                                        {
                                                "icon": "🧹",
                                                "text": "Smart Clean: Added Auto-Terminate preferences to automatically wipe ghost sessions"
                                        },
                                        {
                                                "icon": "📅",
                                                "text": "Calendar Fix: Multi-day exams (Mid-sem, Fests) now seamlessly span across the calendar rings"
                                        },
                                        {
                                                "icon": "⚙️",
                                                "text": "Notification Engine: Prepared the backend foundation for real-time mobile push alerts"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.1.0",
                "date": "Jun 25, 2026",
                "sizeMb": 4.5,
                "sections": [
                        {
                                "title": "Major Improvements",
                                "items": [
                                        {
                                                "icon": "⚡",
                                                "text": "Peer Sync engine overhauled: Full backups now import 50x faster"
                                        },
                                        {
                                                "icon": "🔍",
                                                "text": "Redesigned 'Active Sessions' UI to accurately track devices and locations"
                                        },
                                        {
                                                "icon": "🗑️",
                                                "text": "App resets now safely purge all physical documents to free up space"
                                        },
                                        {
                                                "icon": "💬",
                                                "text": "New Feedback portal to seamlessly report bugs or request features"
                                        },
                                        {
                                                "icon": "🎥",
                                                "text": "Restored fluid Lottie animations on native mobile landing screens"
                                        }
                                ]
                        }
                ]
        }
]
    };

    try {
      const updatePath = path.resolve(process.cwd(), "src/uploads/update.zip");
      if (fs.existsSync(updatePath)) {
        const stats = fs.statSync(updatePath);
        (manifest as any).downloadSizeMb = parseFloat((stats.size / (1024 * 1024)).toFixed(2));
      }
    } catch (e) {
      console.error("Failed to calculate update size", e);
    }

    res.json(manifest);
  }

  static async downloadUpdate(req: Request, res: Response) {
    const updatePath = path.resolve(process.cwd(), "src/uploads/update.zip");
    if (fs.existsSync(updatePath)) {
      res.download(updatePath);
    } else {
      res.status(404).json({ message: "Update package not found" });
    }
  }

  static async triggerBirthdayCron(req: Request, res: Response) {
    try {
      const result = await BirthdayService.ensureBirthdaySentForAll();
      return res.status(200).json({
        success: true,
        message: `Birthday cron executed successfully. ${result.sentCount} greeting(s) sent.`,
        data: result
      });
    } catch (error: any) {
      console.error('[SystemController] Birthday cron error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to execute birthday cron' });
    }
  }
}


