import React from "react";

interface Props {
  markdown: string;
}

function parseFormattedText(text: string) {
  // Parse inline **bold** syntax into <strong> elements
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold text-slate-900 dark:text-slate-50 tracking-tight">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/**
 * Remove SHA-256 checksum blocks/lines (used internally by GitHubUpdater)
 * so raw verification hashes never clutter the end-user NativeUpdateSheet UI.
 */
export function stripShaFromChangelog(markdown: string): string {
  if (!markdown) return "";

  // 1. Strip fenced code blocks containing a 64-char SHA-256 hex digest
  const withoutShaFences = markdown.replace(/```[\s\S]*?```/g, (block) =>
    /\b[a-f0-9]{64}\b/i.test(block) ? "" : block,
  );

  // 2. Filter individual lines carrying a 64-char hex digest or explicit checksum row
  const rawLines = withoutShaFences.split("\n");
  const filteredLines = rawLines.filter((line) => {
    const t = line.trim();
    if (!t) return true;
    if (/\b[a-f0-9]{64}\b/i.test(t)) return false;
    if (/^\|\s*(?:file|asset|artifact|package|name)\s*\|\s*(?:sha[- ]?256|checksum|hash)/i.test(t)) return false;
    if (/^\|\s*AttendX\.apk\s*\|/i.test(t) && /sha|checksum|hash|[a-f0-9]{16,}/i.test(t)) return false;
    if (/^(?:[-*•>]\s*)?(?:\*\*|__)?(?:apk\s+)?(?:sha[- ]?256(?:\s+checksum)?|checksum|verification\s+hash)(?:\*\*|__)?(?:\s*\([^)]+\))?\s*[:=]\s*`?$/i.test(t)) {
      return false;
    }
    return true;
  });

  // 3. Remove empty table separator rows left behind after filtering checksum tables
  const withoutOrphanTableSep = filteredLines.filter((line, i) => {
    const t = line.trim();
    if (/^\|[\s:-]+(?:\|[\s:-]+)+\|?$/.test(t)) {
      const prev = (filteredLines[i - 1] || "").trim();
      const next = (filteredLines[i + 1] || "").trim();
      if (!prev.startsWith("|") || !next.startsWith("|")) return false;
    }
    return true;
  });

  // 4. Strip Verification / Checksum sections completely from the in-app popup UI
  //    (NativeUpdateSheet already shows version badge + "Package Verified" footer,
  //     and GitHubUpdater parses SHA256 directly from the raw release body.)
  const isVerificationHeader = (s: string) => {
    const t = s.trim();
    return (
      (/^#{1,6}\s+/.test(t) && /\b(?:sha[- ]?256|checksums?|verification|integrity(?:\s+check)?)\b/i.test(t)) ||
      /^(?:\*\*|__)?(?:sha[- ]?256(?:\s+checksum)?|checksums?|apk\s+verification)(?:\*\*|__)?:?\s*$/i.test(t)
    );
  };

  const result: string[] = [];
  let skippingVerificationSection = false;
  for (let i = 0; i < withoutOrphanTableSep.length; i++) {
    const cur = withoutOrphanTableSep[i];
    const trimmedCur = cur.trim();
    if (isVerificationHeader(cur)) {
      skippingVerificationSection = true;
      continue;
    }
    if (skippingVerificationSection) {
      if (/^#{1,6}\s+/.test(trimmedCur)) {
        skippingVerificationSection = false;
      } else {
        continue;
      }
    }
    result.push(cur);
  }

  return result
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(?:\n---\s*)+$/g, "")
    .trim();
}

/**
 * Condenses verbose GitHub Release bullets into a single bold headline for the in-app update sheet
 * while keeping full detailed descriptions intact on GitHub Releases.
 */
export function condenseBulletHeadline(cleanText: string): string {
  const trimmed = cleanText.trim();
  if (!trimmed) return "";

  // Pattern 1: Optional leading emoji + **Bold Heading:** verbose description...
  const boldLeadMatch = trimmed.match(/^((?:[^\p{L}\p{N}*]+)?)\*\*([^*]+?)\*\*(?:\s*[:—–-]\s*.*|\s+.*)?$/u);
  if (boldLeadMatch) {
    const prefix = (boldLeadMatch[1] || "").trim();
    const heading = boldLeadMatch[2].replace(/[:—–-]\s*$/, "").trim();
    return prefix ? `${prefix} **${heading}**` : `**${heading}**`;
  }

  // Pattern 2: Plain "Emoji Heading: verbose description..."
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx > 0 && colonIdx <= 85) {
    const lead = trimmed.slice(0, colonIdx).trim();
    if (lead) return `**${lead}**`;
  }

  return `**${trimmed}**`;
}

export const UpdateChangelog: React.FC<Props> = ({ markdown }) => {
  if (!markdown) return null;

  // Unescape HTML entities if formatted by backend or GitHub Markdown parser
  const unescaped = markdown
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

  // Pre-process multiline or single-line <img> tags into clean markdown images, then hide SHA keys
  const normalized = stripShaFromChangelog(
    unescaped.replace(/<img\s+[\s\S]*?src=["']([^"']+)["'][\s\S]*?>/gi, (_, src) => {
      return `\n![Release Banner](${src})\n`;
    }),
  );

  if (!normalized) return null;

  const lines = normalized.split("\n");

  return (
    <div className="space-y-3 text-xs leading-relaxed text-muted-foreground dark:text-zinc-300">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // 1. Detect HTML <img> or Markdown ![](...) image tags
        const imgMatch =
          trimmed.match(/<img\s+[\s\S]*?src=["']([^"']+)["'][\s\S]*?\/?>/i) ||
          trimmed.match(/!\[.*?\]\((.*?)\)/);

        if (imgMatch) {
          const imgSrc = imgMatch[1];
          return (
            <div
              key={idx}
              className="rounded-2xl overflow-hidden border border-border/80 dark:border-white/10 shadow-lg my-2.5 max-h-56 bg-muted/20 dark:bg-white/[0.02]"
            >
              <img
                src={imgSrc}
                alt="Release Banner"
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
          );
        }

        // 2. Section Headers (#, ##, ###, or ####)
        if (trimmed.startsWith("#")) {
          const headerText = trimmed.replace(/^#+\s*/, "");
          return (
            <div
              key={idx}
              className="pt-2.5 pb-1 border-b border-slate-900/10 dark:border-white/10 flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              <h4 className="text-[11px] font-mono font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wider">
                {headerText}
              </h4>
            </div>
          );
        }

        // 3. Bullet list items (- or *) — condensed to bold 1-line headings inside the app
        if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
          const cleanText = trimmed.replace(/^[-*]\s*/, "");
          const condensed = condenseBulletHeadline(cleanText);
          if (!condensed) return null;
          return (
            <div
              key={idx}
              className="py-2.5 px-3.5 rounded-2xl bg-white/60 dark:bg-white/[0.05] backdrop-blur-md border border-slate-900/10 dark:border-white/10 flex items-center gap-2.5 shadow-xs min-w-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0 text-slate-900 dark:text-slate-50 leading-snug break-words">
                {parseFormattedText(condensed)}
              </div>
            </div>
          );
        }

        // 4. Regular Paragraphs
        return (
          <p key={idx} className="text-slate-800 dark:text-zinc-200 leading-relaxed px-1 font-normal break-words [overflow-wrap:anywhere]">
            {parseFormattedText(trimmed)}
          </p>
        );
      })}
    </div>
  );
};
