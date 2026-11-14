import React from "react";

interface Props {
  markdown: string;
}

export const UpdateChangelog: React.FC<Props> = ({ markdown }) => {
  const lines = markdown.split("\n");

  return (
    <div className="space-y-2.5 text-zinc-300 leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("###") || trimmed.startsWith("##")) {
          return (
            <h4
              key={idx}
              className="text-xs font-bold text-white uppercase tracking-wider pt-2 border-b border-white/5 pb-1"
            >
              {trimmed.replace(/^#+\s*/, "")}
            </h4>
          );
        }

        if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
          return (
            <div
              key={idx}
              className="flex items-start gap-2 bg-white/[0.02] border border-white/[0.04] p-2.5 rounded-xl text-xs"
            >
              <span className="text-blue-400 font-bold">•</span>
              <span>{trimmed.replace(/^[-*]\s*/, "")}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-xs text-zinc-400">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
};
