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

export const UpdateChangelog: React.FC<Props> = ({ markdown }) => {
  if (!markdown) return null;

  // Unescape HTML entities if formatted by backend or GitHub Markdown parser
  const unescaped = markdown
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

  // Pre-process multiline or single-line <img> tags into clean markdown images
  const normalized = unescaped.replace(/<img\s+[\s\S]*?src=["']([^"']+)["'][\s\S]*?>/gi, (_, src) => {
    return `\n![Release Banner](${src})\n`;
  });

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

        // 3. Bullet list items (- or *)
        if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
          const cleanText = trimmed.replace(/^[-*]\s*/, "");
          return (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-white/60 dark:bg-white/[0.05] backdrop-blur-md border border-slate-900/10 dark:border-white/10 flex items-start gap-3 shadow-xs min-w-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0 text-slate-800 dark:text-zinc-200 leading-relaxed font-normal break-words [overflow-wrap:anywhere]">
                {parseFormattedText(cleanText)}
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
