import React from "react";

interface FormattedChatMessageProps {
  content: string;
  isUser?: boolean;
}

export const FormattedChatMessage: React.FC<FormattedChatMessageProps> = ({ content, isUser }) => {
  if (isUser) {
    return <div className="whitespace-pre-wrap leading-relaxed text-[13px]">{content}</div>;
  }

  // Clean, standard inline markdown renderer (no ugly intrusive badges mid-sentence!)
  const renderInlineFormatted = (text: string) => {
    // Split bold (**...**)
    const boldParts = text.split(/(\*\*.*?\*\*)/g);

    return boldParts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Split code (`...`)
      const codeParts = part.split(/(`.*?`)/g);
      return codeParts.map((subPart, j) => {
        if (subPart.startsWith("`") && subPart.endsWith("`")) {
          return (
            <code
              key={`${i}-${j}`}
              className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground font-medium border border-border/50"
            >
              {subPart.slice(1, -1)}
            </code>
          );
        }

        // Split italics (*...*)
        const italicParts = subPart.split(/(\*.*?\*)/g);
        return italicParts.map((itPart, k) => {
          if (itPart.startsWith("*") && itPart.endsWith("*") && itPart.length > 2) {
            return (
              <em key={`${i}-${j}-${k}`} className="italic text-foreground/80">
                {itPart.slice(1, -1)}
              </em>
            );
          }
          return itPart;
        });
      });
    });
  };

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let isNumberedList = false;

  const flushList = () => {
    if (currentList.length > 0) {
      if (isNumberedList) {
        elements.push(
          <ol key={`list-${elements.length}`} className="list-decimal pl-5 space-y-1.5 my-2 text-[13px] text-foreground/90">
            {currentList}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc pl-5 space-y-1.5 my-2 text-[13px] text-foreground/90">
            {currentList}
          </ul>
        );
      }
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      elements.push(<div key={`space-${index}`} className="h-2" />);
      return;
    }

    // Dividers (---)
    if (trimmed === "---") {
      flushList();
      elements.push(<hr key={`hr-${index}`} className="my-3 border-border/60" />);
      return;
    }

    // Headings (### or ## or #)
    if (trimmed.startsWith("###") || trimmed.startsWith("##") || trimmed.startsWith("#")) {
      flushList();
      const cleanTitle = trimmed.replace(/^#+\s*/, "");
      elements.push(
        <h4 key={`h-${index}`} className="font-bold text-[13px] text-foreground pt-2 pb-1 border-b border-border/40 mb-1.5">
          {renderInlineFormatted(cleanTitle)}
        </h4>
      );
      return;
    }

    // Callout / Blockquote (> ...)
    if (trimmed.startsWith("> ")) {
      flushList();
      elements.push(
        <div key={`quote-${index}`} className="pl-3 py-1 my-2 border-l-2 border-primary/70 text-[12px] text-muted-foreground bg-muted/30 rounded-r-md">
          {renderInlineFormatted(trimmed.slice(2))}
        </div>
      );
      return;
    }

    // Bullet List (* or -)
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      if (isNumberedList && currentList.length > 0) flushList();
      isNumberedList = false;
      currentList.push(
        <li key={`li-${index}`} className="leading-relaxed">
          {renderInlineFormatted(trimmed.slice(2))}
        </li>
      );
      return;
    }

    // Numbered List (1. or 2.)
    const numberMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberMatch) {
      if (!isNumberedList && currentList.length > 0) flushList();
      isNumberedList = true;
      currentList.push(
        <li key={`nli-${index}`} className="leading-relaxed">
          {renderInlineFormatted(numberMatch[2])}
        </li>
      );
      return;
    }

    // Paragraph
    flushList();
    elements.push(
      <p key={`p-${index}`} className="leading-relaxed text-[13px] text-foreground/90">
        {renderInlineFormatted(trimmed)}
      </p>
    );
  });

  flushList();

  return <div className="space-y-1.5 text-[13px] leading-relaxed">{elements}</div>;
};
