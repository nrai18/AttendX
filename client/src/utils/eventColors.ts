
export const getEventColorClasses = (title: string, type: string) => {
  const t = title.toLowerCase();
  
  if (t.includes("mid sem") || t.includes("exam") || type === "exam") {
    return "text-indigo-500 bg-indigo-500/10 border-indigo-500/20";
  }
  if (t.includes("janmashtami") || t.includes("krishna")) {
    return "text-teal-500 bg-teal-500/10 border-teal-500/20";
  }
  if (t.includes("diwali") || t.includes("deepavali")) {
    return "text-amber-500 bg-amber-500/10 border-amber-500/20";
  }
  if (t.includes("holi")) {
    return "text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20";
  }
  if (t.includes("republic") || t.includes("independence")) {
    return "text-orange-500 bg-orange-500/10 border-orange-500/20";
  }
  if (type === "holiday") {
    return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
  }
  if (type === "restricted_holiday") {
    return "text-cyan-500 bg-cyan-500/10 border-cyan-500/20";
  }
  if (type === "fest" || t.includes("fest")) {
    return "text-purple-500 bg-purple-500/10 border-purple-500/20";
  }

  // Default fallback (e.g. Blue)
  return "text-blue-500 bg-blue-500/10 border-blue-500/20";
};

export const getEventDotClass = (title: string, type: string) => {
  const t = title.toLowerCase();
  if (t.includes("mid sem") || t.includes("exam") || type === "exam") return "bg-indigo-500";
  if (t.includes("janmashtami") || t.includes("krishna")) return "bg-teal-500";
  if (t.includes("diwali") || t.includes("deepavali")) return "bg-amber-500";
  if (t.includes("holi")) return "bg-fuchsia-500";
  if (t.includes("republic") || t.includes("independence")) return "bg-orange-500";
  if (type === "holiday") return "bg-emerald-500";
  if (type === "restricted_holiday") return "bg-cyan-500";
  if (type === "fest" || t.includes("fest")) return "bg-purple-500";
  
  return "bg-blue-500";
};

