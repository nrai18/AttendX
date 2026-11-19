import { TOXIC_PATTERN } from "./profanityMask";

export interface ClientSimulationPayload {
  subjectId: string;
  subjectName: string;
  skipCount: number;
  currentAttended: number;
  currentTotal: number;
  projectedPercentage: number;
  targetPercentage: number;
}

export interface ClientSemesterProjectionPayload {
  skipCountPerSubject: number;
  endDate: string;
  subjects: {
    subjectId: string;
    subjectName: string;
    remainingClasses: number;
    projectedPercentage: number;
    targetPercentage: number;
  }[];
}

export type ClientFastPathEffect =
  | { type: "NAVIGATE"; path: string; title: string }
  | { type: "SET_THEME"; theme: "dark" | "light"; requestedMode: "dark" | "light" | "system" }
  | { type: "UPDATE_BIRTHDAY"; isoPayload: string; formatted: string }
  | { type: "UPDATE_TIMETABLE_ALERTS"; updates: Record<string, any> };

export interface ClientFastPathInput {
  query: string;
  user?: { name?: string | null; birthday?: string | null } | null;
  subjects?: any[];
  overallPercentage?: number;
  targetPercentage?: number;
  totalAttended?: number;
  totalClasses?: number;
  events?: any[];
  timetableSlots?: any[];
  assignments?: any[];
  history?: Array<{ role: string; content: string }>;
  lastWorkingDay?: string | null;
  semesterName?: string | null;
  semesterEndDate?: string | null;
  now?: Date;
  prefersDarkSystem?: boolean;
}

export interface ClientFastPathResult {
  intent: string;
  reply: string;
  simulation?: ClientSimulationPayload;
  semesterProjection?: ClientSemesterProjectionPayload;
  effects?: ClientFastPathEffect[];
}

const EDGE_NOISE_RE = /^[\s"'“”‘’`.,;:!?~_/\\()[\]{}\-]+|[\s"'“”‘’`.,;:!?~_/\\()[\]{}\-]+$/g;

export function stripEdgePunctuation(str: string): string {
  let prev = str;
  for (let i = 0; i < 4; i++) {
    const next = prev.replace(EDGE_NOISE_RE, "").trim();
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

export function boundedEditDistance(a: string, b: string, maxDist = 2): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > maxDist) return maxDist + 1;
  if (a === b) return 0;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
    }
  }
  return dp[m][n];
}

const EXPLICIT_DOMAIN_TYPOS: Record<string, string> = {
  tody: "today",
  tdy: "today",
  todays: "today's",
  tmr: "tomorrow",
  tmrw: "tomorrow",
  tomorow: "tomorrow",
  tommorow: "tomorrow",
  tomarrow: "tomorrow",
  tmorow: "tomorrow",
  tomorrows: "tomorrow's",
  tomorows: "tomorrow's",
  yday: "yesterday",
  yestrday: "yesterday",
  yestarday: "yesterday",
  yesterdy: "yesterday",
  monady: "monday",
  mnday: "monday",
  tuesdy: "tuesday",
  teusday: "tuesday",
  wednsday: "wednesday",
  wednesdy: "wednesday",
  wensday: "wednesday",
  thrusday: "thursday",
  thursdy: "thursday",
  thrsday: "thursday",
  friady: "friday",
  fiday: "friday",
  saturdy: "saturday",
  satrday: "saturday",
  sundya: "sunday",
  sundy: "sunday",
  weeek: "week",
  wekk: "week",
  mnth: "month",
  monts: "months",
  atendance: "attendance",
  attandance: "attendance",
  attendence: "attendance",
  attendnce: "attendance",
  atendence: "attendance",
  attendane: "attendance",
  timetabel: "timetable",
  timtable: "timetable",
  timetble: "timetable",
  timetabl: "timetable",
  tabel: "table",
  calender: "calendar",
  calandar: "calendar",
  calndr: "calendar",
  shedule: "schedule",
  schdule: "schedule",
  scedule: "schedule",
  schedual: "schedule",
  scheduel: "schedule",
  routin: "routine",
  routiene: "routine",
  assignemnt: "assignment",
  assignmnt: "assignment",
  asignment: "assignment",
  assingment: "assignment",
  assignemnts: "assignments",
  assignmnts: "assignments",
  asignments: "assignments",
  assingments: "assignments",
  homewrk: "homework",
  homwork: "homework",
  pendng: "pending",
  pnding: "pending",
  birhtday: "birthday",
  birtday: "birthday",
  birthdy: "birthday",
  brithday: "birthday",
  birthay: "birthday",
  birhtdays: "birthdays",
  birtdays: "birthdays",
  birthdys: "birthdays",
  brithdays: "birthdays",
  bday: "birthday",
  bdays: "birthdays",
  holidy: "holiday",
  holidya: "holiday",
  holydays: "holidays",
  holidys: "holidays",
  holdays: "holidays",
  holydy: "holiday",
  festivel: "festival",
  festvals: "festivals",
  festivels: "festivals",
  seting: "settings",
  setings: "settings",
  settnigs: "settings",
  setttings: "settings",
  notifcation: "notification",
  notificaton: "notification",
  notifcations: "notifications",
  notificatons: "notifications",
  remider: "reminder",
  remidner: "reminder",
  remidners: "reminders",
  remiders: "reminders",
  sumary: "summary",
  summery: "summary",
  sumarry: "summary",
  summry: "summary",
  histroy: "history",
  histry: "history",
  ordnance: "ordinance",
  ordinence: "ordinance",
  ordinace: "ordinance",
  condonaton: "condonation",
  condanation: "condonation",
  reprot: "report",
  repots: "reports",
  reprots: "reports",
  rport: "report",
  subjet: "subject",
  subjets: "subjects",
  subjct: "subject",
  subjcts: "subjects",
  suject: "subject",
  sujects: "subjects",
  clasroom: "classroom",
  clasrooms: "classrooms",
  classrom: "classroom",
  classroms: "classrooms",
  clases: "classes",
  classs: "classes",
  lectur: "lecture",
  lecturs: "lectures",
  practcal: "practical",
  practcals: "practicals",
  semster: "semester",
  semestr: "semester",
  semstr: "semester",
  smester: "semester",
  coundown: "countdown",
  coutdown: "countdown",
  countdwn: "countdown",
  coundowns: "countdowns",
  coutdowns: "countdowns",
  exm: "exam",
  exms: "exams",
  exma: "exam",
  exmas: "exams",
  midseam: "midsem",
  midesm: "midsem",
  endseam: "endsem",
  endesm: "endsem",
  predicitive: "predictive",
  predective: "predictive",
  forcst: "forecast",
  forcast: "forecast",
  simualte: "simulate",
  simulat: "simulate",
  simualt: "simulate",
  simualtion: "simulation",
  simlation: "simulation",
  hapens: "happens",
  bnk: "bunk",
  skp: "skip",
  wekly: "weekly",
  wekley: "weekly",
  wkly: "weekly",
  mntly: "monthly",
  monhtly: "monthly",
  mnthly: "monthly",
  repot: "report",
  percentge: "percentage",
  percntage: "percentage",
  precentage: "percentage",
  frequncy: "frequency",
  freuqency: "frequency",
  profil: "profile",
  proifle: "profile",
  devics: "devices",
  devies: "devices",
  deivces: "devices",
  feedbck: "feedback",
  feddback: "feedback",
  feeback: "feedback",
  isue: "issue",
  issu: "issue",
  glith: "glitch",
  gltch: "glitch",
  complnt: "complaint",
  complant: "complaint",
  absnt: "absent",
  abscent: "absent",
  abset: "absent",
  presnt: "present",
  prsent: "present",
  preesnt: "present",
  medicall: "medical",
  medicl: "medical",
  attnded: "attended",
  atended: "attended",
  missd: "missed",
  mised: "missed",
  bunkng: "bunking",
  bnking: "bunking",
  skpping: "skipping",
  skiping: "skipping",
  becuase: "because",
  becasue: "because",
  becuse: "because",
  reasn: "reason",
  rmark: "remark",
  rmk: "remark",
  upcomng: "upcoming",
  upcomming: "upcoming",
  upcmoing: "upcoming",
  evnt: "event",
  evnts: "events",
  evetns: "events",
  oepn: "open",
  opne: "open",
  openn: "open",
  opn: "open",
  shwo: "show",
  chcek: "check",
  chekc: "check",
  swtich: "switch",
  swithc: "switch",
  toggel: "toggle",
  toggl: "toggle",
  mdoe: "mode",
  thme: "theme",
  canceld: "canceled",
  cancled: "canceled",
  cancelld: "cancelled",
  delte: "delete",
  delet: "delete",
  dlete: "delete",
  complte: "complete",
  compelte: "complete",
  cmplete: "complete",
  updt: "update",
  updat: "update",
  chang: "change",
  chng: "change",
  enble: "enable",
  enabl: "enable",
  disble: "disable",
  disabl: "disable",
  anlytics: "analytics",
  analyics: "analytics",
  changlog: "changelog",
  changelg: "changelog",
  prefrences: "preferences",
  prefernces: "preferences",
};

const DOMAIN_CANONICAL_VOCAB = [
  "attendance",
  "timetable",
  "calendar",
  "schedule",
  "routine",
  "assignment",
  "assignments",
  "homework",
  "birthday",
  "birthdays",
  "holiday",
  "holidays",
  "festival",
  "festivals",
  "vacation",
  "settings",
  "preferences",
  "notification",
  "notifications",
  "reminder",
  "reminders",
  "frequency",
  "summary",
  "history",
  "ordinance",
  "condonation",
  "report",
  "reports",
  "analytics",
  "subject",
  "subjects",
  "classroom",
  "classrooms",
  "classes",
  "lecture",
  "lectures",
  "practical",
  "practicals",
  "semester",
  "countdown",
  "countdowns",
  "midsem",
  "endsem",
  "predictive",
  "forecast",
  "simulate",
  "simulation",
  "percentage",
  "profile",
  "devices",
  "sessions",
  "feedback",
  "complaint",
  "changelog",
  "absent",
  "present",
  "medical",
  "attended",
  "missed",
  "bunking",
  "skipping",
  "cancelled",
  "canceled",
  "tomorrow",
  "yesterday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "upcoming",
  "pending",
  "weekly",
  "monthly",
  "events",
  "switch",
  "toggle",
  "delete",
  "complete",
  "completed",
  "update",
  "enable",
  "disable",
  "because",
  "reason",
  "remark",
];

const DOMAIN_CANONICAL_SET = new Set(DOMAIN_CANONICAL_VOCAB);

const PROTECTED_ENGLISH_WORDS = new Set([
  "prevent",
  "parents",
  "parent",
  "preset",
  "percent",
  "patience",
  "patient",
  "teacher",
  "weather",
  "already",
  "earlier",
  "friends",
  "friend",
  "student",
  "students",
  "project",
  "projects",
  "object",
  "suspect",
  "subtext",
  "protect",
  "reject",
  "glasses",
  "clauses",
  "crashes",
  "victory",
  "mystery",
  "sittings",
  "getting",
  "medieval",
  "magical",
  "median",
  "attendants",
  "stimulation",
  "similar",
  "remainder",
  "vocation",
  "compliant",
  "advices",
  "devises",
  "banking",
  "dunking",
  "bunker",
  "support",
  "export",
  "import",
  "depart",
  "resort",
  "problem",
  "problems",
  "morning",
  "evening",
  "tonight",
  "weekend",
  "working",
  "nothing",
  "another",
  "through",
  "without",
  "missing",
  "looking",
  "feeling",
  "sitting",
  "running",
  "brother",
  "planned",
  "calling",
  "happens",
  "current",
  "default",
  "deleted",
  "started",
  "stopped",
  "writing",
  "written",
  "someone",
  "anybody",
  "anyone",
  "everybody",
  "everyone",
  "between",
  "against",
  "account",
  "college",
  "welcome",
  "offline",
  "android",
  "desktop",
  "windows",
  "version",
  "location",
  "operating",
  "systems",
  "database",
  "management",
  "computer",
  "networks",
  "mathematics",
  "algorithms",
  "machine",
  "learning",
  "artificial",
  "intelligence",
  "software",
  "engineering",
  "communication",
  "physics",
  "chemistry",
  "theory",
  "computation",
  "architecture",
  "organization",
  "science",
]);

function normalizeDomainToken(word: string): string {
  const low = word.toLowerCase();
  const explicit = EXPLICIT_DOMAIN_TYPOS[low];
  if (explicit) {
    return /^[A-Z]/.test(word) ? explicit.charAt(0).toUpperCase() + explicit.slice(1) : explicit;
  }
  if (low.length < 6 || DOMAIN_CANONICAL_SET.has(low) || PROTECTED_ENGLISH_WORDS.has(low)) {
    return word;
  }

  const maxDist = low.length >= 8 ? 2 : 1;
  let bestWord: string | null = null;
  let bestDist = maxDist + 1;
  let tied = false;

  for (const cand of DOMAIN_CANONICAL_VOCAB) {
    if (Math.abs(cand.length - low.length) > maxDist) continue;
    const dist = boundedEditDistance(low, cand, maxDist);
    if (dist > maxDist) continue;
    if ((dist === 2 || low.length === 6) && low[0] !== cand[0]) continue;
    if (dist < bestDist) {
      bestDist = dist;
      bestWord = cand;
      tied = false;
    } else if (dist === bestDist && bestWord !== cand) {
      tied = true;
    }
  }

  if (!bestWord || tied) return word;
  return /^[A-Z]/.test(word) ? bestWord.charAt(0).toUpperCase() + bestWord.slice(1) : bestWord;
}

/**
 * Normalize speech-to-text spacing splits, bounded domain typos, and voice variations
 * while protecting user-entered quotes, emails, URLs, and remarks/feedback payloads.
 */
export function normalizeCopilotQuery(raw: string): string {
  if (!raw) return "";

  const spans: string[] = [];
  const mask = (s: string) => {
    const idx = spans.length;
    spans.push(s);
    return `__ATTXSPAN${idx}__`;
  };

  let masked = raw
    .replace(/"[^"\n]*"/g, (m) => mask(m))
    .replace(/(?:^|(?<=\s))'[^'\n]{2,}'(?=$|[\s.,!?;:])/g, (m) => mask(m))
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, (m) => mask(m))
    .replace(/https?:\/\/\S+|(?:^|(?<=\s))\/[A-Za-z0-9._/-]+/g, (m) => mask(m))
    .replace(/(\b(?:feedback|complaint|issue|bug|problem|report)\s*[:=]\s*)(.+)$/i, (_m, p1, p2) => `${p1}${mask(p2)}`);

  if (
    /^\s*(?:please\s+)?(?:mark|record|log|set)\b/i.test(masked) &&
    !/\b(?:assignment|assignemnt|assignmnt|task|homework|homewrk)\b/i.test(masked)
  ) {
    masked = masked.replace(
      /(\b(?:with\s+(?:a\s+)?)?(?:remarks?|rmarks?|rmks?|reasons?|reasns?|notes?|comments?|bec(?:au|ua|a|u)?se(?:\s+of)?|due\s+to)\s*[:=\s]\s*)(.+)$/i,
      (_m, p1, p2) => (/^__ATTXSPAN\d+__$/.test(p2.trim()) ? `${p1}${p2}` : `${p1}${mask(p2)}`),
    );
  }

  const tokenNormalized = masked.replace(/\b[A-Za-z]{3,}\b/g, (word) => {
    if (word.startsWith("__ATTXSPAN")) return word;
    return normalizeDomainToken(word);
  });

  const sttJoined = tokenNormalized
    .replace(/\btime\s+table\b/gi, "timetable")
    .replace(/\bpeer\s*[- ]?sync\b/gi, "peer-sync")
    .replace(/\bclass\s+room(s)?\b/gi, "classroom$1")
    .replace(/\bmid\s+sem(?:ester)?\b/gi, "midsem")
    .replace(/\bend\s+sem(?:ester)?\b/gi, "endsem")
    .replace(/\battend\s+x\b/gi, "attendx")
    .replace(/\bdark\s+theme\b/gi, "dark mode")
    .replace(/\blight\s+theme\b/gi, "light mode")
    .replace(/\bsystem\s+theme\b/gi, "system mode")
    .replace(/\bheads?\s+up\b/gi, "heads-up");

  let restored = sttJoined;
  for (let pass = 0; pass < 3 && /__ATTXSPAN\d+__/.test(restored); pass++) {
    restored = restored.replace(/__ATTXSPAN(\d+)__/g, (_m, idx) => spans[Number(idx)] ?? "");
  }
  return restored;
}

export function toIsoDateOnly(val: any): string {
  if (!val) return "";
  if (val instanceof Date) return isNaN(val.getTime()) ? "" : val.toISOString().split("T")[0];
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? "" : parsed.toISOString().split("T")[0];
}

function formatUtcDate(iso: string, opts: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    ...opts,
    timeZone: "UTC",
  });
}

function diffDaysIso(futureIso: string, baseIso: string): number {
  const [fy, fm, fd] = futureIso.split("-").map(Number);
  const [by, bm, bd] = baseIso.split("-").map(Number);
  const fMs = Date.UTC(fy, fm - 1, fd);
  const bMs = Date.UTC(by, bm - 1, bd);
  return Math.round((fMs - bMs) / (1000 * 60 * 60 * 24));
}

export function isPublicHolidayEvent(e: any): boolean {
  if (!e) return false;
  if (e.isHoliday || e.isHolidayList) return true;
  const t = String(e.eventType || e.event_type || e.type || "").toLowerCase();
  if (
    ["holiday", "restricted_holiday", "vacation", "exam", "midsem", "endsem", "ct", "lab_exam", "fest", "institute", "academic"].includes(t)
  ) {
    return true;
  }
  const title = String(e.title || "").toLowerCase();
  if (
    /\b(guru\s*nanak|guru\s*gobind|guru\s*tegh|mahatma\s*gandhi|gandhi\s*jayanti|dr\.?\s*b\.?r\.?\s*ambedkar|ambedkar\s*jayanti|subhas\s*chandra|hazarat\s*ali|ambedkar|mahavir|buddha|valmiki|ravidas|krishna\s*janmashtami|ram\s*navami|diwali|holi|eid|christmas|dussera|dussehra|independence|republic|teaching\s+day|working\s+day)\b/i.test(
      title,
    )
  ) {
    return true;
  }
  if (/\b(jayanti|utsav|divas|diwas)\b/i.test(title) && !/\b(peer|friend|classmate|my)\b/i.test(title)) {
    return true;
  }
  return false;
}

const ACADEMIC_OTHER_MILESTONE_RE =
  /\b(fee\s+payment|registration|fee\s+verification|answer[\s-]*sheets?|shortage|result\s+preparation|declaration|commencement|classes|teaching|convocation|orientation|induction|workshop|seminar|meeting|submission|feedback|enrollment|enrolment|holiday|vacation|break|exam|test|quiz|midsem|endsem|fest|assessment|absentee|makeup|compensation|calendar)\b/i;

export function isPeerBirthdayEvent(e: any): boolean {
  if (!e || isPublicHolidayEvent(e)) return false;
  const title = String(e.title || e.name || "");
  const desc = String(e.description || "");
  const combined = `${title} ${desc}`;
  if (/\b(birthdays?|b'?days?|b-?days?|dob)\b|🎂/i.test(combined)) return true;
  const t = String(e.eventType || e.event_type || e.type || "").toLowerCase();
  if (t === "birthday" || t === "peer_birthday") return true;
  // AddEventModal maps Category "Birthday" -> eventType: "other"
  if (t === "other" && !e.isHolidayList && !ACADEMIC_OTHER_MILESTONE_RE.test(combined)) {
    return Boolean(title.trim());
  }
  return false;
}

const SUBJECT_ALIAS_MAP: Record<string, string> = {
  dbms: "Database Management Systems",
  os: "Operating Systems",
  cn: "Computer Networks",
  dc: "Data Communication",
  math: "Mathematics",
  mathematics: "Mathematics",
  algo: "Algorithms",
  algorithms: "Algorithms",
  daa: "Design and Analysis of Algorithms",
  toc: "Theory of Computation",
  coa: "Computer Organization and Architecture",
  se: "Software Engineering",
  ai: "Artificial Intelligence",
  ml: "Machine Learning",
  physics: "Physics",
};

const ENTITY_FUZZY_STOP_WORDS = new Set([
  "mark",
  "record",
  "log",
  "set",
  "my",
  "me",
  "attendance",
  "present",
  "absent",
  "medical",
  "duty",
  "off",
  "leave",
  "today",
  "tomorrow",
  "yesterday",
  "class",
  "classes",
  "lecture",
  "lectures",
  "session",
  "sessions",
  "slot",
  "slots",
  "lab",
  "labs",
  "practical",
  "practicals",
  "demo",
  "what",
  "happens",
  "miss",
  "skip",
  "bunk",
  "attend",
  "attending",
  "check",
  "show",
  "tell",
  "current",
  "overall",
  "total",
  "status",
  "percentage",
  "summary",
  "safe",
  "need",
  "needed",
  "many",
  "until",
  "reach",
  "target",
  "next",
  "week",
  "days",
  "from",
  "with",
  "because",
  "reason",
  "remark",
  "note",
  "comment",
  "shift",
  "move",
  "reschedule",
  "postpone",
  "change",
  "please",
  "about",
  "your",
  "when",
  "whose",
  "birthday",
  "birthdays",
]);

export function resolveSubjectMatch(query: string, subjects: any[] = []): any | null {
  const lower = query.toLowerCase();
  if (!subjects || subjects.length === 0) return null;

  const wantsLab = /\b(lab|practical|demo)\b/i.test(lower);
  let bestSub: any = null;
  let bestScore = 0;

  for (const s of subjects) {
    const nameLower = String(s.name || "").toLowerCase();
    const codeLower = String(s.code || "").toLowerCase();
    let score = 0;

    if (nameLower && lower.includes(nameLower)) {
      score += 100 + nameLower.length;
    }
    if (
      codeLower &&
      codeLower.length >= 2 &&
      new RegExp(`\\b${codeLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower)
    ) {
      score += 90 + codeLower.length;
    }

    for (const [alias, fullName] of Object.entries(SUBJECT_ALIAS_MAP)) {
      if (new RegExp(`\\b${alias}\\b`, "i").test(lower)) {
        const matchesName =
          nameLower.includes(alias) || nameLower.includes(fullName.toLowerCase());
        if (matchesName) {
          score += alias.length * 10;
        }
      }
    }

    if (score > 0 && wantsLab && /\b(lab|practical)\b/i.test(nameLower)) {
      score += 40;
    } else if (score > 0 && !wantsLab && /\b(lab|practical)\b/i.test(nameLower)) {
      score -= 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSub = s;
    }
  }

  if (bestScore > 0 && bestSub) return bestSub;

  // Stage 2: Bounded fuzzy subject fallback when exact/code/alias matching yields 0
  const qTokens = (lower.match(/[a-z]{4,}/g) || []).filter((t) => !ENTITY_FUZZY_STOP_WORDS.has(t));
  if (qTokens.length === 0) return null;

  for (const s of subjects) {
    const nameLower = String(s.name || "").toLowerCase();
    const subWords = (nameLower.match(/[a-z]{4,}/g) || []).filter(
      (w) => !["lab", "practical", "laboratory", "and", "for", "the"].includes(w),
    );
    let score = 0;

    for (const qt of qTokens) {
      for (const sw of subWords) {
        const minLen = Math.min(qt.length, sw.length);
        if (minLen <= 4 && qt[0] !== sw[0]) continue;
        const maxDist = minLen >= 6 && qt[0] === sw[0] ? 2 : 1;
        const dist = boundedEditDistance(qt, sw, maxDist);
        if (dist <= maxDist) {
          score += Math.max(15, sw.length * 10 - dist * 18);
        }
      }
      for (const [alias, fullName] of Object.entries(SUBJECT_ALIAS_MAP)) {
        if (alias.length < 4 || qt[0] !== alias[0]) continue;
        const maxDist = alias.length >= 7 ? 2 : 1;
        const dist = boundedEditDistance(qt, alias, maxDist);
        if (dist <= maxDist && (nameLower.includes(alias) || nameLower.includes(fullName.toLowerCase()))) {
          score += Math.max(15, alias.length * 10 - dist * 15);
        }
      }
    }

    if (score > 0 && wantsLab && /\b(lab|practical)\b/i.test(nameLower)) {
      score += 40;
    } else if (score > 0 && !wantsLab && /\b(lab|practical)\b/i.test(nameLower)) {
      score -= 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSub = s;
    }
  }

  return bestScore > 0 ? bestSub : null;
}

function parseBirthdayInput(
  str: string,
  currentBirthday?: string | null,
): { isoDate: string; formatted: string } | null {
  if (!str) return null;
  const clean = stripEdgePunctuation(str);

  const isoMatch = clean.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1970 && y <= 2030) {
      const isoDate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const formatted = formatUtcDate(isoDate, { month: "long", day: "numeric", year: "numeric" });
      return { isoDate, formatted };
    }
  }

  const dmyMatch = clean.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    let d = p1;
    let m = p2;
    if (p2 > 12 && p1 <= 12) {
      m = p1;
      d = p2;
    }
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1970 && y <= 2030) {
      const isoDate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const formatted = formatUtcDate(isoDate, { month: "long", day: "numeric", year: "numeric" });
      return { isoDate, formatted };
    }
  }

  const monthMap: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, sept: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };

  const getDefaultYear = (): number => {
    if (currentBirthday) {
      const iso = toIsoDateOnly(currentBirthday);
      const ey = iso ? parseInt(iso.slice(0, 4), 10) : NaN;
      if (!isNaN(ey) && ey >= 1970 && ey <= 2025) return ey;
    }
    return 2004;
  };

  const mFirst = clean.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i,
  );
  if (mFirst) {
    const m = monthMap[mFirst[1].toLowerCase()];
    const d = parseInt(mFirst[2], 10);
    const y = mFirst[3] ? parseInt(mFirst[3], 10) : getDefaultYear();
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const isoDate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const formatted = formatUtcDate(isoDate, { month: "long", day: "numeric", year: "numeric" });
      return { isoDate, formatted };
    }
  }

  const dFirst = clean.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*,?\s*(\d{4}))?\b/i,
  );
  if (dFirst) {
    const d = parseInt(dFirst[1], 10);
    const m = monthMap[dFirst[2].toLowerCase()];
    const y = dFirst[3] ? parseInt(dFirst[3], 10) : getDefaultYear();
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const isoDate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const formatted = formatUtcDate(isoDate, { month: "long", day: "numeric", year: "numeric" });
      return { isoDate, formatted };
    }
  }

  return null;
}

/**
 * Compute next upcoming occurrence of a birthday event (supports both current-year
 * semester dates like "2026-11-25" and birth-year dates like "2004-11-25").
 */
function nextBirthdayOccurrenceIso(rawDate: any, todayIso: string): { nextIso: string; daysUntil: number } | null {
  const baseIso = toIsoDateOnly(rawDate);
  if (!baseIso) return null;
  const [by, bm, bd] = baseIso.split("-").map(Number);
  const [ty] = todayIso.split("-").map(Number);

  if (by >= ty) {
    if (baseIso < todayIso) return null;
    return { nextIso: baseIso, daysUntil: diffDaysIso(baseIso, todayIso) };
  }

  // Birth year stored in past (< todayYear): project to this year or next year
  let candidate = `${ty}-${String(bm).padStart(2, "0")}-${String(bd).padStart(2, "0")}`;
  if (candidate < todayIso) {
    candidate = `${ty + 1}-${String(bm).padStart(2, "0")}-${String(bd).padStart(2, "0")}`;
  }
  return { nextIso: candidate, daysUntil: diffDaysIso(candidate, todayIso) };
}

function formatCountdown(daysUntil: number): string {
  if (daysUntil === 0) return "today! 🎉";
  if (daysUntil === 1) return "tomorrow (in **1 day**)!";
  return `in **${daysUntil} days**`;
}

export function evaluateClientFastPath(input: ClientFastPathInput): ClientFastPathResult | null {
  const {
    query,
    user,
    subjects = [],
    overallPercentage = 100,
    targetPercentage = 75,
    totalAttended = 0,
    totalClasses = 0,
    events = [],
    timetableSlots = [],
    assignments = [],
    history = [],
    lastWorkingDay,
    semesterName,
    semesterEndDate,
    now = new Date(),
    prefersDarkSystem = true,
  } = input;

  if (!query || !query.trim()) return null;

  const rawClean = stripEdgePunctuation(query)
    .replace(/^(?:(?:hey|hi|hello|ok|okay)?\s*(?:attendx|assistant|bot|ai)[\s,:]+)/i, "");
  const normalized = normalizeCopilotQuery(rawClean);
  const lower = stripEdgePunctuation(normalized).toLowerCase();

  if (!lower) return null;

  // 1. Abusive / Toxic Language Guardrail (0ms)
  if (TOXIC_PATTERN.test(lower)) {
    return {
      intent: "CHIT_CHAT",
      reply:
        "I'm here to help you manage your attendance, timetable, assignments, and academic queries for AttendX. Please keep our conversation respectful so I can assist you effectively.",
    };
  }

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const localTodayIso = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const todayDayIndex = (now.getDay() + 6) % 7; // 0=Mon..6=Sun
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const uName = user?.name || "Student";
  const currentTarget = Number(targetPercentage || 75);
  const currentOverall = Number(overallPercentage ?? 100);
  const pGlobal = currentTarget / 100;
  const overallSafeBunks =
    totalClasses > 0 && pGlobal > 0
      ? Math.max(0, Math.floor((totalAttended - pGlobal * totalClasses) / pGlobal))
      : 0;
  const overallNeeded =
    totalClasses > 0 && pGlobal < 1
      ? Math.max(0, Math.ceil((pGlobal * totalClasses - totalAttended) / (1 - pGlobal)))
      : 0;
  const overallStatus =
    currentOverall >= currentTarget ? "Safe" : currentOverall >= currentTarget - 5 ? "Warning" : "Danger";

  const subjectNameById: Record<string, string> = {};
  for (const s of subjects) {
    subjectNameById[s.id] = s.name;
  }

  const getDayClasses = (dayIdx: number) =>
    timetableSlots
      .filter((slot: any) => Number(slot.dayOfWeek) === dayIdx)
      .sort((a: any, b: any) => String(a.startTime || "").localeCompare(String(b.startTime || "")))
      .map((slot: any) => ({
        startTime: slot.startTime || "09:00",
        endTime: slot.endTime || "09:50",
        subjectId: slot.subjectId,
        subjectName: slot.subject?.name || subjectNameById[slot.subjectId] || "Scheduled Class",
        room: slot.room || "TBD",
        slotType: slot.type || slot.slotType || "Lecture",
      }));

  const todayClasses = getDayClasses(todayDayIndex);
  const currentHHMM = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  let nextUpcomingClass: {
    subjectName: string;
    dayName: string;
    startTime: string;
    endTime: string;
    room: string;
  } | null = null;
  const remainingToday = todayClasses.filter((c) => c.startTime >= currentHHMM);
  if (remainingToday.length > 0) {
    nextUpcomingClass = { ...remainingToday[0], dayName: "Today" };
  } else {
    for (let offset = 1; offset <= 7; offset++) {
      const checkDay = (todayDayIndex + offset) % 7;
      const daySlots = getDayClasses(checkDay);
      if (daySlots.length > 0) {
        const first = daySlots[0];
        nextUpcomingClass = {
          subjectName: first.subjectName,
          dayName: offset === 1 ? `Tomorrow (${dayNames[checkDay]})` : dayNames[checkDay],
          startTime: first.startTime,
          endTime: first.endTime,
          room: first.room,
        };
        break;
      }
    }
  }

  // 2. Greetings, Farewells & Identity (0ms)
  const farewellPattern =
    /^(?:bye(?:\s+bye)?|byebye|goodbye|good\s+bye|cya(?:\s+later)?|see\s+(?:you|ya|u)(?:\s+(?:later|soon|around))?|catch\s+you\s+later|talk\s+to\s+you\s+later|take\s+care|have\s+a\s+(?:good|great|nice)\s+day|goodnight|good\s+night)$/i;

  if (farewellPattern.test(lower)) {
    if (/\bsee\s+(?:you|ya|u)\s+later\b/i.test(lower)) {
      const firstName = uName.split(" ")[0] || uName;
      return {
        intent: "CHIT_CHAT",
        reply: `Goodbye, ${firstName}! Feel free to reach back out anytime you need help with your timetable or attendance. Have a great day!`,
      };
    }
    return {
      intent: "CHIT_CHAT",
      reply: `See you later, ${uName}! Stay on top of your ${currentTarget}% attendance goal!`,
    };
  }

  const greetingPattern =
    /^(?:(?:hi+|he+y+|hello+|heya|howdy|sup|yo|namaste|greetings|good\s+(?:morning|afternoon|evening|day))[\s,!.]*){1,3}$|^(?:how\s+(?:are|r)\s+(?:you|u|ya)(?:\s+doing)?|how(?:'s|\s+is)\s+it\s+going|what(?:'s|\s+is)\s+up|whats\s+up|who\s+(?:are|r)\s+(?:you|u)|what\s+is\s+your\s+name|what(?:'s|\s+is)\s+your\s+name|who\s+(?:made|created|built|developed|designed)\s+(?:you|u)|what\s+can\s+you\s+do|help|thank(?:s(?:\s+(?:a\s+lot|so\s+much|very\s+much))?|\s+you(?:\s+(?:so\s+much|very\s+much|a\s+lot))?|\s+u)?|thx|ty|tysm|appreciate\s+it)$/i;

  if (greetingPattern.test(lower)) {
    if (/\b(who\s+(?:made|created|built|developed|designed)\s+(?:you|u))\b/i.test(lower)) {
      return {
        intent: "CHIT_CHAT",
        reply:
          "I am AttendX AI Copilot, created and engineered by **Naman Rai** as your intelligent academic companion and policy advisor for IIIT Una.",
      };
    }
    if (/\b(what\s+can\s+you\s+do|help)\b/i.test(lower)) {
      return {
        intent: "CHIT_CHAT",
        reply:
          "I can instantly check your attendance & safe bunks, simulate leaves, switch light/dark themes, navigate across the app, tell you your next class or upcoming holiday, swap timetable slots, and email your weekly or monthly attendance reports!",
      };
    }
    if (/^(thank|thx|ty|tysm)/i.test(lower)) {
      return {
        intent: "CHIT_CHAT",
        reply: `You're welcome, ${uName}! Let me know anytime you need help with your attendance or schedule.`,
      };
    }
    let reply = `Hey ${uName}! Your overall attendance is **${currentOverall.toFixed(1)}%** (${totalAttended}/${totalClasses} classes — **${overallStatus}** vs your ${currentTarget}% target).`;
    if (nextUpcomingClass) {
      reply += ` Your next class is **${nextUpcomingClass.subjectName}** (${nextUpcomingClass.dayName} at ${nextUpcomingClass.startTime}).`;
    }
    reply += " How can I help you today?";
    return { intent: "CHIT_CHAT", reply };
  }

  // 3. Theme Switching (Dark / Light / System) (0ms)
  const themeMatch =
    lower.match(
      /^(?:please\s+)?(?:switch|change|set|turn|enable|toggle|go|use)?\s*(?:the\s+)?(?:app\s+)?(?:to\s+|on\s+)?(dark|light|system)\s*(?:mode|theme)?$/i,
    ) ||
    lower.match(
      /\b(?:switch|change|set|turn)\s+(?:the\s+)?(?:app\s+)?(?:theme|mode)\s+to\s+(dark|light|system)\b/i,
    );
  if (themeMatch) {
    const requested = themeMatch[1].toLowerCase() as "dark" | "light" | "system";
    const resolvedTheme: "dark" | "light" =
      requested === "system" ? (prefersDarkSystem ? "dark" : "light") : requested;
    return {
      intent: "UPDATE_SETTINGS",
      reply:
        requested === "system"
          ? `Switched your app appearance to **system mode** (${resolvedTheme}).`
          : `Switched your app appearance to **${resolvedTheme} mode**.`,
      effects: [{ type: "SET_THEME", theme: resolvedTheme, requestedMode: requested }],
    };
  }

  // 4. Birthday & Peer Birthday Knowledge (0ms)
  const setBdayMatch =
    lower.match(
      /\b(?:set|update|change|save|make|put|record|register)\s+(?:my\s+)?(?:birthdays?|b'?days?|dob)(?:\s+(?:date|to|as|=|is))?\s+([^?.!]+)/i,
    ) ||
    lower.match(/^(?:my\s+)?(?:birthdays?|b'?days?|dob)\s+(?:is|=|to)\s+([^?.!]+)/i) ||
    lower.match(/\b(?:i\s+was\s+born\s+(?:on|in))\s+([^?.!]+)/i);

  let isFollowUpBday = false;
  let followUpCandidate = "";
  if (!setBdayMatch) {
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
    if (
      lastAssistant &&
      /birthday/i.test(lastAssistant.content) &&
      /(?:saved\s+in\s+your\s+profile|tell\s+me\s+here|what\s+is\s+your\s+birthday|set\s+my\s+birthday)/i.test(
        lastAssistant.content,
      )
    ) {
      const parsedDirect = parseBirthdayInput(lower, user?.birthday);
      if (parsedDirect) {
        isFollowUpBday = true;
        followUpCandidate = lower;
      }
    }
  }

  if (setBdayMatch || isFollowUpBday) {
    const candidate = (setBdayMatch ? setBdayMatch[1] : followUpCandidate).trim();
    const parsed = parseBirthdayInput(candidate, user?.birthday);
    if (parsed) {
      const isoPayload = `${parsed.isoDate}T00:00:00.000Z`;
      return {
        intent: "CHIT_CHAT",
        reply: `Done, ${uName}! 🎂 I have updated your birthday to **${parsed.formatted}**. You'll get a special celebration greeting on your birthday!`,
        effects: [{ type: "UPDATE_BIRTHDAY", isoPayload, formatted: parsed.formatted }],
      };
    }
  }

  if (/\b(birthdays?|b'?days?|b-?days?|dob|born)\b/i.test(lower)) {
    const isMyBirthday =
      (/\bmy\s+(?:birthdays?|b'?days?|dob)\b/i.test(lower) ||
        /\b(?:when|what)\s+(?:is\s+)?my\b/i.test(lower) ||
        /\bdo\s+you\s+(?:know|remember|have)\s+my\s+(?:birthdays?|b'?days?|dob)\b/i.test(lower) ||
        /\b(?:tell\s+me|check|show)\s+(?:my\s+)?(?:birthdays?|b'?days?|dob)\b/i.test(lower) ||
        /\bwhen\s+was\s+i\s+born\b/i.test(lower) ||
        /^(?:my\s+)?(?:birthdays?|b'?days?|dob)\??$/i.test(lower)) &&
      !/\b(whose|who(?:'s|\s+has|\s+is)|anybody|anyone|peer|friend|classmate|next|upcoming|coming\s+up)\b/i.test(lower) &&
      !/\b(?:set|update|change|save|make|put|record|register)\b/i.test(lower);

    if (isMyBirthday) {
      if (user?.birthday) {
        const bIso = toIsoDateOnly(user.birthday);
        const bFormatted = formatUtcDate(bIso, { month: "long", day: "numeric", year: "numeric" });
        return {
          intent: "CHIT_CHAT",
          reply: `Yes, ${uName}! According to your profile, your birthday is **${bFormatted}**! 🎂 Let me know if you need to update it.`,
        };
      }
      return {
        intent: "CHIT_CHAT",
        reply: `You don't have a birthday saved in your profile yet! You can set it in **Settings > Edit Profile**, or just tell me here (e.g. "Set my birthday to November 18")! 🎂`,
      };
    }

    // Helper: Build chronological list of upcoming birthdays (BOTH peers + user profile)
    const buildUpcomingBirthdays = () => {
      const items: Array<{ label: string; isUser: boolean; nextIso: string; daysUntil: number; dateLabel: string }> = [];

      if (user?.birthday) {
        const occ = nextBirthdayOccurrenceIso(user.birthday, localTodayIso);
        if (occ) {
          items.push({
            label: "Yours",
            isUser: true,
            nextIso: occ.nextIso,
            daysUntil: occ.daysUntil,
            dateLabel: formatUtcDate(occ.nextIso, { month: "long", day: "numeric" }),
          });
        }
      }

      for (const e of events || []) {
        if (!isPeerBirthdayEvent(e)) continue;
        const occ = nextBirthdayOccurrenceIso(e.date || e.startDate, localTodayIso);
        if (!occ) continue;
        items.push({
          label: String(e.title || e.name || "Peer Birthday").trim(),
          isUser: false,
          nextIso: occ.nextIso,
          daysUntil: occ.daysUntil,
          dateLabel: formatUtcDate(occ.nextIso, { month: "long", day: "numeric" }),
        });
      }

      items.sort((a, b) => a.daysUntil - b.daysUntil || (a.isUser === b.isUser ? a.label.localeCompare(b.label) : a.isUser ? -1 : 1));
      return items;
    };

    const upcomingHolidaysWithBday = (events || [])
      .filter((e: any) => {
        if (!isPublicHolidayEvent(e)) return false;
        const startStr = toIsoDateOnly(e.date || e.startDate);
        return Boolean(startStr && startStr >= localTodayIso && /\b(birthdays?|jayanti)\b/i.test(e.title || ""));
      })
      .sort((a: any, b: any) => toIsoDateOnly(a.date || a.startDate).localeCompare(toIsoDateOnly(b.date || b.startDate)));

    const buildHolidayNote = (): string => {
      if (upcomingHolidaysWithBday.length === 0) return "";
      const topHol = upcomingHolidaysWithBday[0];
      const hDate = formatUtcDate(toIsoDateOnly(topHol.date || topHol.startDate), { month: "long", day: "numeric" });
      return `\n\n*(Note: **${topHol.title}** on ${hDate} is an official institute holiday, not a peer birthday).*`;
    };

    // Next / Upcoming Birthdays (evaluate BEFORE today-only check whenever next/upcoming/list is requested!)
    const isNextOrUpcomingBday =
      /\b(?:next|upcoming|coming\s+up)\s+(?:peer\s+|friend'?s?\s+)?(?:birthdays?|b'?days?)\b/i.test(lower) ||
      /\b(?:whose|who(?:'s|\s+is|\s+has)|which\s+(?:peer|friend)?'?s?)\s+(?:(?:the\s+)?next\s+)?(?:birthdays?|b'?days?)\s+(?:is\s+)?(?:next|coming\s+up|soonest)\b/i.test(lower) ||
      /\bwho\s+has\s+(?:the\s+)?next\s+(?:birthdays?|b'?days?)\b/i.test(lower) ||
      /\b(?:list|show|all)\s+(?:upcoming\s+)?(?:peer\s+)?(?:birthdays?|b'?days?)\b/i.test(lower);

    if (isNextOrUpcomingBday) {
      const combined = buildUpcomingBirthdays();
      const peersOnly = combined.filter((i) => !i.isUser);
      const userEntry = combined.find((i) => i.isUser) || null;
      const holidayNote = buildHolidayNote();
      const wantsList = /\b(upcoming\s+birthdays|list|all|every)\b/i.test(lower);

      if (combined.length === 0) {
        return {
          intent: "CHIT_CHAT",
          reply: `You don't have any upcoming peer birthdays scheduled on your calendar, and your birthday isn't saved yet. You can add peer birthdays in **Semester Overview > Add Event** or tell me your birthday anytime!${holidayNote}`,
        };
      }

      if (wantsList) {
        const lines = combined
          .slice(0, 5)
          .map((item) => {
            const label = item.isUser ? "**Your Birthday**" : `**${item.label}**`;
            return `• ${label} — ${item.dateLabel} (${item.daysUntil === 0 ? "Today! 🎉" : item.daysUntil === 1 ? "Tomorrow!" : `in ${item.daysUntil} days`})`;
          })
          .join("\n");
        return {
          intent: "CHIT_CHAT",
          reply: `Here are the upcoming birthdays on your calendar:\n\n${lines}${holidayNote}`,
        };
      }

      const first = combined[0];
      const asksSpecificallyPeer = /\b(peer|whose|who\s+has|friend|classmate|his|her)\b/i.test(lower);

      // Same-day tie or peer vs user comparison: mention BOTH clearly!
      const sameDayMatches = combined.filter((i) => i.daysUntil === first.daysUntil);
      let reply = "";
      if (sameDayMatches.length > 1) {
        const names = sameDayMatches.map((m) => (m.isUser ? "**yours**" : `**${m.label}**`)).join(" and ");
        reply = `The next birthdays coming up are ${names} on **${first.dateLabel}** (${formatCountdown(first.daysUntil)})! 🎂`;
      } else if (first.isUser && asksSpecificallyPeer && peersOnly.length > 0) {
        const topPeer = peersOnly[0];
        reply = `Your own birthday comes up first on **${first.dateLabel}** (${formatCountdown(first.daysUntil)}), and the next peer birthday on your calendar is **${topPeer.label}** on **${topPeer.dateLabel}** (${formatCountdown(topPeer.daysUntil)})! 🎂`;
      } else if (first.isUser) {
        const peerNote =
          peersOnly.length > 0
            ? ` Next peer birthday: **${peersOnly[0].label}** on **${peersOnly[0].dateLabel}** (${formatCountdown(peersOnly[0].daysUntil)}).`
            : "";
        reply = `The next birthday coming up is **yours on ${first.dateLabel}** (${formatCountdown(first.daysUntil)})! 🎂${peerNote}`;
      } else {
        const morePeers = peersOnly
          .slice(1, 3)
          .map((p) => `**${p.label}** (${p.dateLabel})`)
          .join(", ");
        const followParts: string[] = [];
        if (morePeers) followParts.push(`Following up: ${morePeers}`);
        if (userEntry) followParts.push(`Your birthday is on **${userEntry.dateLabel}** (${formatCountdown(userEntry.daysUntil)})`);
        reply = `The next birthday coming up is **${first.label}** on **${first.dateLabel}** (${formatCountdown(first.daysUntil)})! 🎂${followParts.length ? ` ${followParts.join(". ")}.` : ""}`;
      }

      return { intent: "CHIT_CHAT", reply: reply + holidayNote };
    }

    // Specific person's birthday ("When is Raghav's birthday?", "Is Priya Didi's birthday next?")
    const specificMatch =
      lower.match(/(?:when|what|is)\s+(?:is\s+)?([a-z0-9\s'-]+?)(?:'s|\s+has)?\s+(?:birthdays?|b'?days?|dob)\b/i) ||
      lower.match(/(?:when|is\s+it)\s+([a-z0-9\s'-]+?)(?:'s)?\s+(?:birthdays?|b'?days?)\b/i) ||
      lower.match(/\b([a-z0-9\s'-]+?)'s\s+(?:birthdays?|b'?days?|dob)\b/i);

    if (specificMatch) {
      const queryName = specificMatch[1].trim().toLowerCase();
      if (queryName && !/^(my|your|the|whose|who|any|anyone|anybody|next|upcoming|today)$/.test(queryName)) {
        let matchedEvent = (events || []).find((e: any) => {
          const t = String(e.title || "").toLowerCase();
          return t.includes(queryName) || queryName.split(" ").some((part) => part.length >= 3 && t.includes(part));
        });
        if (!matchedEvent) {
          const qParts = (queryName.match(/[a-z]{4,}/g) || []).filter((p) => !ENTITY_FUZZY_STOP_WORDS.has(p));
          let bestDist = Infinity;
          for (const e of events || []) {
            const titleWords = (String(e.title || "").toLowerCase().match(/[a-z]{4,}/g) || []).filter(
              (w) => w !== "birthday" && w !== "bday",
            );
            for (const qp of qParts) {
              const maxDist = qp.length >= 7 ? 2 : 1;
              for (const tw of titleWords) {
                if (qp[0] !== tw[0]) continue;
                const d = boundedEditDistance(qp, tw, maxDist);
                if (d <= maxDist && (d < bestDist || (d === bestDist && isPeerBirthdayEvent(e)))) {
                  bestDist = d;
                  matchedEvent = e;
                }
              }
            }
          }
        }
        if (matchedEvent) {
          const baseIso = toIsoDateOnly(matchedEvent.date || matchedEvent.startDate);
          if (isPublicHolidayEvent(matchedEvent)) {
            const formatted = formatUtcDate(baseIso, { month: "long", day: "numeric" });
            return {
              intent: "CHIT_CHAT",
              reply: `According to your calendar, **${matchedEvent.title}** is an official institute holiday on **${formatted}**! 🌴`,
            };
          }
          const occ = nextBirthdayOccurrenceIso(baseIso, localTodayIso);
          const formatted = formatUtcDate(occ ? occ.nextIso : baseIso, { month: "long", day: "numeric" });
          const timing = occ ? ` (${formatCountdown(occ.daysUntil)})` : "";
          const titleStr = String(matchedEvent.title || "").trim();
          const hasBdayWord = /\b(birthdays?|b'?days?|b-?days?)\b/i.test(titleStr);
          return {
            intent: "CHIT_CHAT",
            reply: hasBdayWord
              ? `According to your calendar, **${titleStr}** is on **${formatted}**${timing}! 🎂`
              : `According to your calendar, **${titleStr}**'s birthday is on **${formatted}**${timing}! 🎂`,
          };
        }
      }
    }

    // Whose birthday is today / general peer birthdays check
    const isWhoseBirthdayToday =
      /\b(whose|who\s+has|anybody(?:'s)?|anyone(?:'s)?|any|check)\s+(?:peer\s+)?(?:birthdays?|b'?days?)\b/i.test(lower) ||
      /\b(?:birthdays?|b'?days?)\s+(?:is\s+)?today\b/i.test(lower) ||
      /\bis\s+today\s+(?:anybody(?:'s)?|anyone(?:'s)?|a)\s+(?:birthdays?|b'?days?)\b/i.test(lower);

    if (isWhoseBirthdayToday) {
      const todayMmDd = localTodayIso.slice(5);
      const userBdayIso = toIsoDateOnly(user?.birthday);
      const isUserBdayToday = Boolean(userBdayIso && userBdayIso.slice(5) === todayMmDd);

      const todayPeerBdays = (events || []).filter((e: any) => {
        if (!isPeerBirthdayEvent(e)) return false;
        const startStr = toIsoDateOnly(e.date || e.startDate);
        return startStr.slice(5) === todayMmDd || startStr === localTodayIso;
      });

      if (isUserBdayToday && todayPeerBdays.length > 0) {
        const names = todayPeerBdays.map((e: any) => e.title).join(", ");
        return {
          intent: "CHIT_CHAT",
          reply: `Today is **YOUR birthday**, ${uName}, AND **${names}**'s birthday! 🎉🎂 Double celebration today!`,
        };
      }
      if (isUserBdayToday) {
        return {
          intent: "CHIT_CHAT",
          reply: `Today is **YOUR birthday**, ${uName}! 🎉🎂 Wishing you a wonderful birthday filled with joy and academic success from the entire AttendX team!`,
        };
      }
      if (todayPeerBdays.length > 0) {
        const names = todayPeerBdays.map((e: any) => e.title).join(", ");
        return {
          intent: "CHIT_CHAT",
          reply: `Today on your calendar: **${names}**! 🎉🎂 Let them know you're celebrating with them today!`,
        };
      }

      const combined = buildUpcomingBirthdays();
      const peersUpcoming = combined.filter((i) => !i.isUser).slice(0, 3);
      const userBdayStr = user?.birthday
        ? ` Your birthday on record is **${formatUtcDate(toIsoDateOnly(user.birthday), { month: "long", day: "numeric" })}**.`
        : " (Set your birthday anytime by saying 'Set my birthday to November 18').";

      if (peersUpcoming.length > 0) {
        const formattedList = peersUpcoming
          .map((p) => `**${p.label}** (${p.dateLabel}, ${p.daysUntil === 1 ? "tomorrow" : `in ${p.daysUntil}d`})`)
          .join(", ");
        return {
          intent: "CHIT_CHAT",
          reply: `There are no peer birthdays scheduled for today. Upcoming on your calendar: ${formattedList}.${userBdayStr}`,
        };
      }

      return {
        intent: "CHIT_CHAT",
        reply: `There are no peer birthdays scheduled for today.${userBdayStr}`,
      };
    }
  }

  // 5. Timetable Alerts & Notification Settings (0ms)
  const alertUpdates: Record<string, any> = {};
  const alertNotes: string[] = [];

  const reminderLeadMatch =
    lower.match(
      /\b(?:switch|set|change|turn|make)?\s*(?:the\s+)?(?:class\s+reminders?|lecture\s+alerts?|reminder\s+offset|time\s+before\s+class)\s*(?:to\s+|as\s+)?(5|10|15|off|never|none|disable)\s*(?:min(?:ute)?s?)?\b/i,
    ) ||
    lower.match(
      /\b(?:switch|change)\s+(?:from\s+)?\d+\s*(?:min(?:ute)?s?)?\s+(?:to\s+|into\s+)(5|10|15|off|never|none)\s*(?:min(?:ute)?s?)?\b/i,
    ) ||
    lower.match(/\b(?:remind|notify)\s+me\s+(5|10|15)\s*(?:minutes?|mins?)\s+before\b/i) ||
    lower.match(/\b(5|10|15)\s*(?:minutes?|mins?)\s+(?:before\s+class|class\s+reminder)\b/i) ||
    lower.match(/\b(?:turn\s+off|disable|stop|no)\s+(?:class\s+reminders?|lecture\s+alerts?)\b/i);

  if (reminderLeadMatch) {
    const rawVal = (reminderLeadMatch[1] || "off").toLowerCase();
    if (/^(off|never|none|disable)$/.test(rawVal) || /turn\s+off|disable|stop|no/.test(reminderLeadMatch[0])) {
      alertUpdates.classReminderOffset = -1;
      alertNotes.push("turned **OFF** class reminders (no pre-lecture alerts)");
    } else {
      const mins = parseInt(rawVal, 10);
      if ([5, 10, 15].includes(mins)) {
        alertUpdates.classReminderOffset = mins;
        alertNotes.push(`set class reminder lead time to **${mins} minutes before class**`);
      }
    }
  }

  if (
    /\b(?:don'?t|do\s+not|stop|hide|remove|disable|turn\s+off|no|without|not)\s+(?:include|including|show|showing|display|displaying)?\s*(?:the\s+)?(?:room\s+location|room|location|classroom)(?:\s+(?:in|from)\s+(?:notifications?|alerts?))?\b/i.test(
      lower,
    ) ||
    /\b(?:hide|remove|disable)\s+(?:room(?:\s+location)?|location)(?:\s+(?:in|from)\s+(?:notifications?|alerts?))?\b/i.test(
      lower,
    )
  ) {
    alertUpdates.showLocation = false;
    alertNotes.push("configured notifications to **hide room location**");
  } else if (
    /\b(?:include|including|show|showing|display|displaying|add|adding|enable|turn\s+on|with)\s+(?:the\s+)?(?:room(?:\s+location)?|location|classroom)\s+(?:in|on)\s+(?:the\s+)?(?:notifications?|alerts?)\b/i.test(
      lower,
    ) ||
    /\b(?:turn\s+on\s+show\s+location|show\s+room|include\s+location)\b/i.test(lower)
  ) {
    alertUpdates.showLocation = true;
    alertNotes.push("configured notifications to **include room location**");
  }

  if (
    /\b(?:don'?t|do\s+not|stop|disable|turn\s+off|no|i\s+do\s+not\s+want|without)\s+(?:want\s+)?(?:the\s+)?(?:next\s+class\s+)?heads[\s-]*up\b/i.test(
      lower,
    ) ||
    /\b(?:don'?t|do\s+not|stop)\s+notify(?:ing)?\s+(?:me\s+)?when\s+(?:current\s+)?class\s+ends\b/i.test(lower)
  ) {
    alertUpdates.notifyNextClassOnEnd = false;
    alertNotes.push("turned **OFF** the Next Class Heads-up alert");
  } else if (
    /\b(?:enable|turn\s+on|activate|start|i\s+want)\s+(?:the\s+)?(?:next\s+class\s+)?heads[\s-]*up\b/i.test(lower) ||
    /\bnotify\s+(?:me\s+)?when\s+(?:current\s+)?class\s+ends\b/i.test(lower)
  ) {
    alertUpdates.notifyNextClassOnEnd = true;
    alertNotes.push("turned **ON** the Next Class Heads-up alert");
  }

  if (
    /\b(?:don'?t|do\s+not|stop|disable|turn\s+off|no|i\s+do\s+not\s+want|without)\s+(?:the\s+)?(?:end\s+of\s+day(?:\s+summary)?|done\s+for\s+the\s+day(?:\s+alert)?|daily\s+completion(?:\s+alert)?)\b/i.test(
      lower,
    )
  ) {
    alertUpdates.endOfDaySummary = false;
    alertNotes.push("turned **OFF** the End of Day Summary alert");
  } else if (
    /\b(?:enable|turn\s+on|activate|start|i\s+want)\s+(?:the\s+)?(?:end\s+of\s+day(?:\s+summary)?|done\s+for\s+the\s+day(?:\s+alert)?)\b/i.test(
      lower,
    )
  ) {
    alertUpdates.endOfDaySummary = true;
    alertNotes.push("turned **ON** the End of Day Summary alert");
  }

  if (Object.keys(alertUpdates).length > 0) {
    return {
      intent: "UPDATE_SETTINGS",
      reply: `Done! I have ${alertNotes.join(" and ")}. Your alarms and local notifications have been rescheduled immediately.`,
      effects: [{ type: "UPDATE_TIMETABLE_ALERTS", updates: alertUpdates }],
    };
  }

  // 6. Timetable Slot Queries BEFORE Navigation so "Today's schedule" & "Timetable today" return classes (0ms)
  const isScheduleQuery =
    /^(?:what(?:'s|\s+is)\s+(?:my\s+)?)?(?:next\s+(?:class|lecture|lab)|classes\s+today|(?:my\s+)?(?:classes|schedule|timetable|routine)\s+today|today(?:'s)?\s+(?:classes|schedule|timetable)|timetable\s+today)$/i.test(
      lower,
    ) ||
    /^what\s+classes\s+(?:do\s+i\s+have|are\s+there)\s+(?:today|tomorrow)\??$/i.test(lower) ||
    /\b(?:routine|schedule|timetable|classes)\s+(?:for\s+|on\s+)?tomorrow\b/i.test(lower) ||
    /\btomorrow(?:'s)?\s+(?:routine|schedule|timetable|classes)\b/i.test(lower) ||
    /\b(?:do\s+i\s+have\s+any|any|are\s+there\s+any|show(?:\s+me)?)\s+labs?\s+(?:today|tomorrow)\b/i.test(lower) ||
    /^(?:labs?|practicals?)\s+(?:today|tomorrow)\b/i.test(lower);

  if (isScheduleQuery) {
    if (/next\s+(?:class|lecture|lab)/i.test(lower)) {
      if (nextUpcomingClass) {
        return {
          intent: "TIMETABLE_QUERY",
          reply: `Your next class is **${nextUpcomingClass.subjectName}** (${nextUpcomingClass.dayName}, **${nextUpcomingClass.startTime} – ${nextUpcomingClass.endTime}**${nextUpcomingClass.room && nextUpcomingClass.room !== "TBD" ? `, Room ${nextUpcomingClass.room}` : ""}).`,
        };
      }
      return { intent: "TIMETABLE_QUERY", reply: "You have no upcoming classes found in your weekly timetable." };
    }

    const asksTomorrow = /\btomorrow\b/i.test(lower);
    const targetDayIndex = asksTomorrow ? (todayDayIndex + 1) % 7 : todayDayIndex;
    const targetDayLabel = asksTomorrow ? `tomorrow (${dayNames[targetDayIndex]})` : `today (${dayNames[targetDayIndex]})`;
    const dayList = getDayClasses(targetDayIndex);

    if (/\b(?:labs?|practicals?)\b/i.test(lower)) {
      const labs = dayList.filter(
        (c) => /lab|practical/i.test(String(c.slotType || "")) || /\blab\b|practical/i.test(String(c.subjectName || "")),
      );
      if (labs.length === 0) {
        return {
          intent: "TIMETABLE_QUERY",
          reply: `You have **no labs scheduled ${targetDayLabel}**!`,
        };
      }
      const formattedLabs = labs
        .map((c) => `• **${c.startTime} – ${c.endTime}**: ${c.subjectName}${c.room && c.room !== "TBD" ? ` (${c.room})` : ""}`)
        .join("\n");
      return {
        intent: "TIMETABLE_QUERY",
        reply: `Yes! You have **${labs.length}** lab session${labs.length !== 1 ? "s" : ""} **${targetDayLabel}**:\n${formattedLabs}`,
      };
    }

    if (dayList.length === 0) {
      return {
        intent: "TIMETABLE_QUERY",
        reply: `You have **no classes scheduled ${targetDayLabel}**!${!asksTomorrow && nextUpcomingClass ? ` Your next class is **${nextUpcomingClass.subjectName}** on ${nextUpcomingClass.dayName} at ${nextUpcomingClass.startTime}.` : ""}`,
      };
    }

    const formatted = dayList
      .map((c) => `• **${c.startTime} – ${c.endTime}**: ${c.subjectName} (${c.slotType}${c.room && c.room !== "TBD" ? `, ${c.room}` : ""})`)
      .join("\n");
    return {
      intent: "TIMETABLE_QUERY",
      reply: `Here is your schedule for **${targetDayLabel}** (${dayList.length} session${dayList.length !== 1 ? "s" : ""}):\n${formatted}`,
    };
  }

  // 7. Direct App Navigation (0ms)
  const strippedNav = stripEdgePunctuation(
    lower
      .replace(
        /^(?:can\s+you(?:\s+please)?|could\s+you(?:\s+please)?|would\s+you|please|pls|i\s+want\s+to|i\s+need\s+to|help\s+me(?:\s+to)?|let\s+me|just)\s+/i,
        "",
      )
      .replace(
        /^(?:navigate(?:\s+to)?|open(?:\s+up)?|go\s+to|take\s+me\s+to|show(?:\s+me)?|view|switch\s+to|display|check(?:\s+out)?|bring\s+up|launch|see|head\s+to)\s+/i,
        "",
      )
      .replace(/^(?:all\s+)?(?:the|my|our)\s+/i, "")
      .replace(/\s+(?:please|pls|for\s+me|now|right\s+now|asap|screen|tab|page|view|modal|section|form|dialog)$/i, ""),
  );

  let navTarget: { path: string; title: string } | null = null;
  if (/^(?:(?:exam|semester|holiday|academic|event|upcoming)\s+)?countdowns?$|^countdown(?:\s+timers?)?$/i.test(strippedNav)) {
    navTarget = { path: "/semester/countdowns", title: "Semester Countdowns" };
  } else if (/^(?:(?:semester|academic|upcoming|college)\s+)?holidays?$|^holiday\s+list$/i.test(strippedNav) && !/^list\b/i.test(lower)) {
    navTarget = { path: "/semester/holidays", title: "Semester Holidays" };
  } else if (/^(?:(?:semester|academic|upcoming|calendar)\s+)?events?$|^academic\s+calendar$|^event\s+list$/i.test(strippedNav) && !/^list\b/i.test(lower)) {
    navTarget = { path: "/semester/events", title: "Semester Events" };
  } else if (/^(?:(?:class|weekly|daily)\s+)?(?:timetable|time\s*table|schedule|routine)$/i.test(strippedNav)) {
    navTarget = { path: "/timetable", title: "Timetable" };
  } else if (/^(?:edit\s+)?profile$|^my\s+account$|^user\s+profile$/i.test(strippedNav)) {
    navTarget = { path: "/settings/profile", title: "Edit Profile" };
  } else if (/^(?:(?:linked|active|connected|logged\s*in)\s+)?(?:devices|sessions)$/i.test(strippedNav)) {
    navTarget = { path: "/settings/devices", title: "Linked Devices" };
  } else if (/^peer\s*[- ]?sync$|^friends\s+sync$|^data\s+transfer$/i.test(strippedNav)) {
    navTarget = { path: "/settings/peer-sync", title: "Peer Sync" };
  } else if (/^(?:(?:send|give|open|show|submit)\s+)?feedback(?:\s+(?:form|page|screen|tab|dialog|modal))?$|^report\s+(?:a\s+)?(?:bug|issue)$/i.test(strippedNav)) {
    navTarget = { path: "/settings/feedback", title: "Send Feedback" };
  } else if (/^changelog$|^what'?s\s+new$|^update\s+history$|^release\s+notes$/i.test(strippedNav)) {
    navTarget = { path: "/settings/changelog", title: "Update History" };
  } else if (/^contact(?:\s+us)?$|^support$/i.test(strippedNav)) {
    navTarget = { path: "/settings/contact", title: "Contact Us" };
  } else if (/^faqs?$|^help(?:\s+(?:desk|center|&?\s*support))?$/i.test(strippedNav)) {
    navTarget = { path: "/settings/faq", title: "FAQ" };
  } else if (/^(?:app\s+)?(?:settings|preferences|options)$/i.test(strippedNav)) {
    navTarget = { path: "/settings", title: "Settings" };
  } else if (/^(?:(?:detailed|attendance|analytics)\s+)?reports?$|^analytics$|^bunk\s+calculator$|^attendance\s+stats?$/i.test(strippedNav)) {
    navTarget = { path: "/report", title: "Analytics Reports" };
  } else if (/^(?:attendance\s+)?(?:forecast|predictive|prediction)(?:\s+engine)?$|^what\s*if\s+calculator$/i.test(strippedNav)) {
    navTarget = { path: "/predictive", title: "Forecast Engine" };
  } else if (/^(?:my\s+)?(?:subjects?|courses?)$|^attendance\s+cards?$/i.test(strippedNav)) {
    navTarget = { path: "/subjects", title: "Subjects" };
  } else if (/^(?:(?:pending|upcoming|academic|my)\s+)?(?:assignments?|tasks?)$|^todo(?:\s*list)?$|^homework$/i.test(strippedNav)) {
    navTarget = { path: "/assignments", title: "Assignments" };
  } else if (/^(?:campus\s+)?classrooms?$|^campus\s+rooms?$/i.test(strippedNav)) {
    navTarget = { path: "/classrooms", title: "Classrooms" };
  } else if (/^semester(?:\s+(?:overview|hub))?$|^timeline$/i.test(strippedNav)) {
    navTarget = { path: "/semester", title: "Semester Overview" };
  } else if (/^calendar$|^month\s+view$/i.test(strippedNav)) {
    navTarget = { path: "/calendar", title: "Calendar" };
  } else if (/^(?:today(?:'s)?(?:\s+(?:agenda|dashboard|overview|plan))?|daily\s+(?:agenda|dashboard|overview)|agenda|dashboard|home(?:\s+screen)?|main\s+screen)$/i.test(strippedNav)) {
    navTarget = { path: "/today", title: "Today's Agenda" };
  }

  if (navTarget) {
    let extraNote = "";
    if (navTarget.path === "/assignments" && assignments && assignments.length > 0) {
      const pending = assignments.filter((a: any) => !a.completions || a.completions.length === 0);
      if (pending.length > 0) {
        const preview = pending
          .slice(0, 3)
          .map((a: any) => `• **${a.title}** (due ${toIsoDateOnly(a.deadline) || "TBD"})`)
          .join("\n");
        extraNote = ` You have **${pending.length}** pending task${pending.length !== 1 ? "s" : ""}:\n${preview}`;
      }
    }
    return {
      intent: "NAVIGATE_APP",
      reply: `Opening **${navTarget.title}**.${extraNote}`,
      effects: [{ type: "NAVIGATE", path: navTarget.path, title: navTarget.title }],
    };
  }

  // 8. Semester End / Last Teaching Day (0ms)
  if (
    /\b(last\s+(?:day\s+of\s+teaching|teaching\s+day|working\s+day)|when\s+does\s+(?:the\s+)?semester\s+end|end\s+of\s+(?:teaching|semester))\b/i.test(
      lower,
    )
  ) {
    const endIso = toIsoDateOnly(lastWorkingDay || semesterEndDate);
    if (endIso) {
      const daysLeft = Math.max(0, diffDaysIso(endIso, localTodayIso));
      const friendly = formatUtcDate(endIso, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
      return {
        intent: "FORECAST_SIMULATION",
        reply: `The **Last Day of Teaching** for ${semesterName || "this semester"} is **${friendly}** (**${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining**). After this date, preparation leaves and end-term examinations begin.`,
      };
    }
  }

  // 9. Event & Academic Calendar Lookups (0ms)
  const isCalendarLookup =
    /^(?:what(?:'s|\s+is)\s+(?:the\s+|my\s+|our\s+)?)?(?:next|upcoming)\s+(?:event|events|holiday|vacation|break|exam|midsem|endsem|milestone|festival|fest)s?$/i.test(
      lower,
    ) ||
    /\b(?:when\s+(?:is|are|was|were)\s+(?:the\s+|my\s+|our\s+)?(?:next\s+|upcoming\s+)?(?:event|holiday|exam|break|vacation|midsem|endsem|fest|festival)s?|tell\s+me\s+(?:the\s+)?next\s+(?:upcoming\s+)?event|next\s+holiday)\b/i.test(
      lower,
    ) ||
    /\b(?:how\s+many\s+days\s+(?:until|to|left\s+for|before)|days\s+(?:left\s+)?(?:until|to|for)|countdown\s+to|time\s+until)\s+(?:the\s+|my\s+|our\s+)?(?:next\s+)?(?:exam|midsem|endsem|holiday|vacation|break|event|fest|festival)s?\b/i.test(
      lower,
    ) ||
    /\b(?:when\s+(?:is|are|was|were)\s+(?:the\s+|my\s+|our\s+)?(?:next\s+)?(?:exam|midsem|endsem|test|quiz)s?)\b/i.test(
      lower,
    ) ||
    /^(?:when\s+(?:is|are|was|were)|countdown\s+to)\s+(?:midsem|endsem)s?/i.test(lower) ||
    /^(?:midsem|endsem)\s+(?:date|dates|schedule|timing|when|countdowns?)$/i.test(lower) ||
    /\b(?:list\s+(?:all\s+)?(?:upcoming\s+)?(?:holidays|events|exams|fests|festivals)|what\s+(?:campus\s+)?(?:festivals?|fests?|holidays?|events?)\s+are\s+(?:coming\s+up|upcoming)|all\s+upcoming\s+(?:holidays|events|festivals))\b/i.test(
      lower,
    );

  if (isCalendarLookup) {
    const allParsedEvents = (events || [])
      .map((e: any) => {
        const dStr = toIsoDateOnly(e.date || e.startDate);
        const endStr = toIsoDateOnly(e.endDate) || dStr;
        if (!dStr) return null;
        const daysUntil = Math.max(0, diffDaysIso(dStr, localTodayIso));
        const isPast = endStr < localTodayIso;
        const daysAgo = isPast ? Math.max(1, diffDaysIso(localTodayIso, endStr)) : 0;
        return {
          title: e.title || e.name || e.eventName || "Academic Event",
          date: dStr,
          endDate: endStr !== dStr ? endStr : undefined,
          daysUntil,
          daysAgo,
          isPast,
          eventType: String(e.eventType || e.event_type || "other").toLowerCase(),
        };
      })
      .filter((e): e is NonNullable<typeof e> => Boolean(e));

    const upcoming = allParsedEvents
      .filter((e) => !e.isPast)
      .sort((a, b) => a.date.localeCompare(b.date));

    const isExamEvent = (e: any): boolean => {
      const type = String(e.eventType || "").toLowerCase().replace(/[-_]/g, " ").trim();
      const title = String(e.title || "").toLowerCase();
      if (type.includes("holiday") || type.includes("vacation") || type.includes("break") || type.includes("fest")) return false;
      if (/\b(break|vacation|holiday|fest|festival|puja|diwali|chaturdasi|duj|jayanti|birthday)\b/i.test(title)) return false;
      if (/\b(exams?|midsem|endsem|tests?|quiz(?:zes)?|assessments?|lab\s+exams?|ct)\b/i.test(type)) return true;
      if (
        /\b(mid\s*sem(?:ester)?\s+exam|end\s*sem(?:ester)?\s+exam|exams?|theory\s+exam|lab\s+exam|practical\s+exam|class\s+test|cycle\s+test|unit\s+test|quiz|assessment)\b/i.test(
          title,
        )
      ) {
        return true;
      }
      return false;
    };

    const wantsFest = /\b(fest|fests|festival|festivals)\b/i.test(lower);
    const wantsList = /\b(list|all|what\s+(?:campus\s+)?(?:festivals?|fests?|holidays?|events?)\s+are\s+coming\s+up)\b/i.test(lower);
    const wantsBreak = /\b(break|vacation)\b/i.test(lower);
    const wantsMidBreak = /\bmid\s*sem(?:ester)?\s*(?:break|vacation)\b/i.test(lower) || /\bmidsem\b/i.test(lower) && wantsBreak;
    const wantsEndsem = /\b(endsem)\b/i.test(lower) && !wantsBreak;
    const wantsMidsem = /\b(midsem)\b/i.test(lower) && !wantsBreak;
    const wantsHoliday = /\b(holidays?|vacations?)\b/i.test(lower);
    const wantsExam = (/\b(exams?|tests?|quiz(?:zes)?|assessments?)\b/i.test(lower) || wantsEndsem || wantsMidsem) && !wantsBreak && !wantsHoliday;

    if (wantsFest) {
      const upcomingFests = upcoming.filter(
        (e) =>
          e.eventType.includes("fest") ||
          /\b(fest|festival|mridang|meraki|techfest|cultural|yalgaar|prabodh|carnival)\b/i.test(e.title),
      );
      if (upcomingFests.length > 0) {
        const list = upcomingFests
          .slice(0, 5)
          .map(
            (e) =>
              `• **${e.title}** — ${e.date}${e.endDate ? ` to ${e.endDate}` : ""} (${e.daysUntil === 0 ? "Today" : `in **${e.daysUntil} days**`})`,
          )
          .join("\n");
        return {
          intent: "TIMETABLE_QUERY",
          reply: `Here are the upcoming campus festivals on your calendar:\n\n${list}`,
        };
      }
      const pastFests = allParsedEvents
        .filter(
          (e) =>
            e.isPast &&
            (e.eventType.includes("fest") ||
              /\b(fest|festival|mridang|meraki|techfest|cultural|yalgaar)\b/i.test(e.title)),
        )
        .sort((a, b) => b.date.localeCompare(a.date));
      if (pastFests.length > 0) {
        const last = pastFests[0];
        return {
          intent: "TIMETABLE_QUERY",
          reply: `No upcoming campus festivals are scheduled for the remainder of this semester. The most recent fest was **${last.title}** (${last.date}${last.endDate ? ` – ${last.endDate}` : ""}, ${last.daysAgo} days ago).`,
        };
      }
      return {
        intent: "TIMETABLE_QUERY",
        reply: "You don't have any upcoming campus festivals recorded in your active semester calendar.",
      };
    }

    if (wantsMidBreak) {
      const isMidBreak = (e: any) =>
        (/\bmid\s*sem(?:ester)?\b/i.test(e.title) || e.eventType.includes("break") || e.eventType.includes("vacation")) &&
        /\bmid\s*sem|autumn\b/i.test(e.title);
      const upcomingMidBreaks = upcoming.filter(isMidBreak);
      if (upcomingMidBreaks.length > 0) {
        const top = upcomingMidBreaks[0];
        return {
          intent: "TIMETABLE_QUERY",
          reply: `Your **${top.title}** is scheduled for **${top.date}${top.endDate ? ` – ${top.endDate}` : ""}** (${formatCountdown(top.daysUntil)}).`,
        };
      }
      const pastMidBreaks = allParsedEvents.filter((e) => e.isPast && isMidBreak(e)).sort((a, b) => b.date.localeCompare(a.date));
      const nextGeneralBreak = upcoming.find(
        (e) => e.eventType.includes("vacation") || e.eventType.includes("break") || /\b(break|vacation)\b/i.test(e.title),
      );
      if (pastMidBreaks.length > 0) {
        const past = pastMidBreaks[0];
        const nextNote = nextGeneralBreak
          ? ` Next upcoming break: **${nextGeneralBreak.title}** on **${nextGeneralBreak.date}${nextGeneralBreak.endDate ? ` – ${nextGeneralBreak.endDate}` : ""}** (${formatCountdown(nextGeneralBreak.daysUntil)}).`
          : "";
        return {
          intent: "TIMETABLE_QUERY",
          reply: `The **${past.title}** has already concluded (${past.date}${past.endDate ? ` – ${past.endDate}` : ""}, ${past.daysAgo} days ago).${nextNote}`,
        };
      }
    }

    if (wantsMidsem) {
      const upcomingMidsems = upcoming.filter((e) => {
        const type = e.eventType;
        const title = e.title.toLowerCase();
        return (type.includes("midsem") || /\bmid\s*sem(?:ester)?\b/i.test(title)) && !type.includes("break") && !title.includes("break") && !type.includes("holiday");
      });
      if (upcomingMidsems.length > 0) {
        const top = upcomingMidsems[0];
        const more = upcomingMidsems
          .slice(1, 4)
          .map((e) => `• **${e.title}** — ${e.date}${e.endDate ? ` to ${e.endDate}` : ""} (${e.daysUntil === 0 ? "Today" : `in ${e.daysUntil}d`})`)
          .join("\n");
        return {
          intent: "TIMETABLE_QUERY",
          reply: `Your next upcoming mid-semester exam is **${top.title}** on **${top.date}${top.endDate ? ` – ${top.endDate}` : ""}** (${formatCountdown(top.daysUntil)}).${more ? `\n\n**Following up:**\n${more}` : ""}`,
        };
      }
      const pastMidsems = allParsedEvents
        .filter((e) => {
          const type = e.eventType;
          const title = e.title.toLowerCase();
          return e.isPast && (type.includes("midsem") || /\bmid\s*sem(?:ester)?\b/i.test(title)) && !type.includes("break") && !title.includes("break") && !type.includes("holiday");
        })
        .sort((a, b) => b.date.localeCompare(a.date));
      if (pastMidsems.length > 0) {
        const past = pastMidsems[0];
        const daysAgoText = past.daysAgo === 1 ? "yesterday (1 day ago)" : `${past.daysAgo} days ago`;
        return {
          intent: "TIMETABLE_QUERY",
          reply: `The **${past.title}** for this semester has already concluded. It took place on **${past.date}${past.endDate ? ` – ${past.endDate}` : ""}** (${daysAgoText}).`,
        };
      }
      return { intent: "TIMETABLE_QUERY", reply: "You don't have any mid-semester exams recorded in your active semester calendar." };
    }

    if (wantsEndsem) {
      const upcomingEndsems = upcoming.filter((e) => {
        const type = e.eventType;
        const title = e.title.toLowerCase();
        return (type.includes("endsem") || /\bend\s*sem(?:ester)?\b/i.test(title)) && !type.includes("break") && !title.includes("break") && !type.includes("holiday");
      });
      if (upcomingEndsems.length > 0) {
        const top = upcomingEndsems[0];
        const more = upcomingEndsems
          .slice(1, 4)
          .map((e) => `• **${e.title}** — ${e.date}${e.endDate ? ` to ${e.endDate}` : ""} (${e.daysUntil === 0 ? "Today" : `in ${e.daysUntil}d`})`)
          .join("\n");
        return {
          intent: "TIMETABLE_QUERY",
          reply: `Your next upcoming end-semester exam is **${top.title}** on **${top.date}${top.endDate ? ` – ${top.endDate}` : ""}** (${formatCountdown(top.daysUntil)}).${more ? `\n\n**Following up:**\n${more}` : ""}`,
        };
      }
      const pastEndsems = allParsedEvents
        .filter((e) => {
          const type = e.eventType;
          const title = e.title.toLowerCase();
          return e.isPast && (type.includes("endsem") || /\bend\s*sem(?:ester)?\b/i.test(title)) && !type.includes("break") && !title.includes("break") && !type.includes("holiday");
        })
        .sort((a, b) => b.date.localeCompare(a.date));
      if (pastEndsems.length > 0) {
        const past = pastEndsems[0];
        return {
          intent: "TIMETABLE_QUERY",
          reply: `The **${past.title}** for this semester has already concluded. It took place on **${past.date}${past.endDate ? ` – ${past.endDate}` : ""}** (${past.daysAgo} days ago).`,
        };
      }
      return { intent: "TIMETABLE_QUERY", reply: "You don't have any end-semester exams recorded in your active semester calendar." };
    }

    if (wantsBreak) {
      const upcomingBreaks = upcoming.filter(
        (e) => e.eventType.includes("vacation") || e.eventType.includes("break") || /\b(break|vacation)\b/i.test(e.title),
      );
      if (upcomingBreaks.length > 0) {
        const top = upcomingBreaks[0];
        const more = upcomingBreaks
          .slice(1, 4)
          .map((e) => `• **${e.title}** — ${e.date}${e.endDate ? ` to ${e.endDate}` : ""} (${e.daysUntil === 0 ? "Today" : `in ${e.daysUntil}d`})`)
          .join("\n");
        return {
          intent: "TIMETABLE_QUERY",
          reply: `Your next upcoming break / vacation is **${top.title}** on **${top.date}${top.endDate ? ` – ${top.endDate}` : ""}** (${formatCountdown(top.daysUntil)}).${more ? `\n\n**Following up:**\n${more}` : ""}`,
        };
      }
      const pastBreaks = allParsedEvents
        .filter((e) => e.isPast && (e.eventType.includes("vacation") || e.eventType.includes("break") || /\b(break|vacation)\b/i.test(e.title)))
        .sort((a, b) => b.date.localeCompare(a.date));
      if (pastBreaks.length > 0) {
        const past = pastBreaks[0];
        return {
          intent: "TIMETABLE_QUERY",
          reply: `The **${past.title}** has already ended. It ran from **${past.date}${past.endDate ? ` to ${past.endDate}` : ""}** (${past.daysAgo} days ago).`,
        };
      }
      return { intent: "TIMETABLE_QUERY", reply: "You don't have any breaks or vacations recorded in your active semester calendar." };
    }

    if (wantsExam) {
      const upcomingExams = upcoming.filter(isExamEvent);
      if (upcomingExams.length > 0) {
        const top = upcomingExams[0];
        const more = upcomingExams
          .slice(1, 4)
          .map((e) => `• **${e.title}** — ${e.date}${e.endDate ? ` to ${e.endDate}` : ""} (${e.daysUntil === 0 ? "Today" : `in ${e.daysUntil}d`})`)
          .join("\n");
        return {
          intent: "TIMETABLE_QUERY",
          reply: `Your next upcoming exam is **${top.title}** on **${top.date}${top.endDate ? ` – ${top.endDate}` : ""}** (${formatCountdown(top.daysUntil)}).${more ? `\n\n**Following up:**\n${more}` : ""}`,
        };
      }
      const pastExams = allParsedEvents.filter((e) => e.isPast && isExamEvent(e)).sort((a, b) => b.date.localeCompare(a.date));
      if (pastExams.length > 0) {
        const past = pastExams[0];
        return {
          intent: "TIMETABLE_QUERY",
          reply: `All examinations for this term have concluded. The last conducted exam was **${past.title}** on **${past.date}${past.endDate ? ` – ${past.endDate}` : ""}** (${past.daysAgo} days ago).`,
        };
      }
      return { intent: "TIMETABLE_QUERY", reply: "You don't have any upcoming exams or tests recorded in your active semester calendar." };
    }

    if (wantsHoliday) {
      const upcomingHolidays = upcoming.filter(
        (e) =>
          e.eventType.includes("holiday") ||
          e.eventType.includes("vacation") ||
          /\b(holiday|diwali|puja|jayanti|chaturdasi|duj|christmas|vacation)\b/i.test(e.title),
      );
      if (upcomingHolidays.length > 0) {
        if (wantsList) {
          const allList = upcomingHolidays
            .slice(0, 8)
            .map((e) => `• **${e.title}** — ${e.date}${e.endDate ? ` to ${e.endDate}` : ""} (${e.daysUntil === 0 ? "Today" : `in ${e.daysUntil}d`})`)
            .join("\n");
          return {
            intent: "TIMETABLE_QUERY",
            reply: `Here are all **${upcomingHolidays.length}** upcoming holidays & breaks on your calendar:\n\n${allList}`,
          };
        }
        const top = upcomingHolidays[0];
        const more = upcomingHolidays
          .slice(1, 4)
          .map((e) => `• **${e.title}** — ${e.date}${e.endDate ? ` to ${e.endDate}` : ""} (${e.daysUntil === 0 ? "Today" : `in ${e.daysUntil}d`})`)
          .join("\n");
        return {
          intent: "TIMETABLE_QUERY",
          reply: `Your next upcoming holiday is **${top.title}** on **${top.date}${top.endDate ? ` – ${top.endDate}` : ""}** (${formatCountdown(top.daysUntil)}).${more ? `\n\n**Following up:**\n${more}` : ""}`,
        };
      }
      return { intent: "TIMETABLE_QUERY", reply: "You don't have any more upcoming holidays recorded in your active semester calendar." };
    }

    if (upcoming.length === 0) {
      return { intent: "TIMETABLE_QUERY", reply: "You don't have any upcoming events recorded in your active semester calendar." };
    }

    const top = upcoming[0];
    const more = upcoming
      .slice(1, 4)
      .map((e) => `• **${e.title}** — ${e.date}${e.endDate ? ` to ${e.endDate}` : ""} (${e.daysUntil === 0 ? "Today" : `in ${e.daysUntil}d`})`)
      .join("\n");
    return {
      intent: "TIMETABLE_QUERY",
      reply: `Your next upcoming event is **${top.title}** on **${top.date}${top.endDate ? ` – ${top.endDate}` : ""}** (${formatCountdown(top.daysUntil)}).${more ? `\n\n**Following up:**\n${more}` : ""}`,
    };
  }

  // 10. Multi-Day / Next Week Attendance Simulation (0ms)
  const isMultiDaySim =
    /\b(?:what\s+(?:happens\s+)?if\s+i|if\s+i|simulate)\s+(?:miss(?:ing)?|skip(?:ping)?|bunk(?:ing)?|take\s+leave\s+for|absent\s+for)\b/i.test(
      lower,
    ) && /\b(week|weeks|days?|monday|tuesday|wednesday|thursday|friday)\b/i.test(lower);

  if (isMultiDaySim) {
    let daysCount = 0;
    const daysMatch = lower.match(/\b(\d+)\s*days?\b/i);
    const weeksMatch = lower.match(/\b(\d+)\s*weeks?\b/i);
    const hasNextWeek = /\bnext\s+week\b/i.test(lower);

    if (daysMatch) daysCount = Math.min(30, Math.max(1, parseInt(daysMatch[1], 10)));
    else if (weeksMatch) daysCount = Math.min(30, Math.max(1, parseInt(weeksMatch[1], 10) * 7));
    else if (hasNextWeek) daysCount = 7;

    if (daysCount > 0 && subjects.length > 0) {
      // Determine start date: Monday of next week if "next week", else tomorrow
      const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      if (hasNextWeek) {
        const daysUntilNextMon = (7 - todayDayIndex) % 7 || 7;
        start.setUTCDate(start.getUTCDate() + daysUntilNextMon);
      } else {
        start.setUTCDate(start.getUTCDate() + 1);
      }

      const holidayDates = new Set<string>();
      for (const e of events || []) {
        const type = String(e.eventType || e.event_type || "").toLowerCase();
        if (e.isHoliday || type === "holiday" || type === "vacation") {
          const sIso = toIsoDateOnly(e.date || e.startDate);
          const eIso = toIsoDateOnly(e.endDate) || sIso;
          if (sIso) {
            const [sy, sm, sd] = sIso.split("-").map(Number);
            const [ey, em, ed] = eIso.split("-").map(Number);
            const cur = new Date(Date.UTC(sy, sm - 1, sd));
            const end = new Date(Date.UTC(ey, em - 1, ed));
            while (cur <= end) {
              holidayDates.add(cur.toISOString().split("T")[0]);
              cur.setUTCDate(cur.getUTCDate() + 1);
            }
          }
        }
      }

      const missedBySubject: Record<string, number> = {};
      for (let i = 0; i < daysCount; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        const iso = d.toISOString().split("T")[0];
        if (holidayDates.has(iso)) continue;
        const dIdx = (d.getUTCDay() + 6) % 7;
        for (const slot of timetableSlots) {
          if (Number(slot.dayOfWeek) === dIdx && slot.subjectId) {
            missedBySubject[slot.subjectId] = (missedBySubject[slot.subjectId] || 0) + 1;
          }
        }
      }

      const totalMissedSlots = Object.values(missedBySubject).reduce((a, b) => a + b, 0);
      const projOverallTot = totalClasses + totalMissedSlots;
      const projOverallPct = projOverallTot > 0 ? (totalAttended / projOverallTot) * 100 : currentOverall;

      const lines = subjects
        .filter((s) => (missedBySubject[s.id] || 0) > 0)
        .map((s) => {
          const miss = missedBySubject[s.id];
          const att = Number(s.attended || 0);
          const tot = Number(s.total || 0);
          const tgt = Number(s.target ?? currentTarget);
          const newTot = tot + miss;
          const newPct = newTot > 0 ? (att / newTot) * 100 : 100;
          const badge = newPct >= tgt ? `Safe (≥${tgt}%)` : `⚠️ Drops below ${tgt}%`;
          return `• **${s.name}**: −${miss} class${miss !== 1 ? "es" : ""} → **${newPct.toFixed(1)}%** (${att}/${newTot}) — *${badge}*`;
        });

      const windowLabel = hasNextWeek
        ? daysMatch
          ? `the first ${daysCount} days of next week`
          : "next week"
        : `the next ${daysCount} days`;

      if (lines.length === 0) {
        return {
          intent: "FORECAST_SIMULATION",
          reply: `Good news! You have **0 scheduled classes** during **${windowLabel}** (accounting for weekends/holidays), so your overall attendance stays at **${currentOverall.toFixed(1)}%**.`,
        };
      }

      return {
        intent: "FORECAST_SIMULATION",
        reply: `If you miss **${windowLabel}** (**${totalMissedSlots}** scheduled class${totalMissedSlots !== 1 ? "es" : ""}, holidays excluded), your overall attendance moves from **${currentOverall.toFixed(1)}%** to **${projOverallPct.toFixed(1)}%** (${totalAttended}/${projOverallTot}):\n\n${lines.join("\n")}`,
      };
    }
  }

  // 11. Current Attendance, Safe Bunks & Summary Query (0ms)
  const isDirectAttendanceQuery =
    /^(?:what(?:'s|\s+is)\s+(?:my\s+)?)?(?:current\s+|overall\s+|total\s+)?attendance(?:\s+status|\s+percentage|\s+right\s+now|\s+summary)?$/i.test(
      lower,
    ) ||
    /^(?:show(?:\s+me)?\s+(?:my\s+)?|check(?:\s+my)?\s+|tell(?:\s+me)?\s+(?:my\s+)?|view(?:\s+my)?\s+)?(?:current\s+|overall\s+|total\s+)?attendance(?:\s+(?:status|percentage|summary))?(?:\s+in\s+.+)?$/i.test(
      lower,
    ) ||
    /^(?:am\s+i\s+safe|how\s+many\s+(?:classes|lectures|bunks)\s+(?:can\s+i\s+(?:bunk|miss|skip)|do\s+i\s+need(?:\s+to\s+attend)?))(?:\s+in\s+.+)?$/i.test(
      lower,
    );

  if (
    isDirectAttendanceQuery &&
    !/\b(if\s+i|next\s+week|from\s+|between\s+|tomorrow|monday|tuesday|wednesday|thursday|friday)\b/i.test(lower)
  ) {
    const requestedTargetMatch = lower.match(/\b(?:reach|hit|get\s+to|achieve)\s+(\d{1,3})\s*%/i);
    const customTargetPct = requestedTargetMatch ? Math.min(99, Math.max(1, parseInt(requestedTargetMatch[1], 10))) : null;

    const matchedSub = resolveSubjectMatch(lower, subjects);
    if (matchedSub) {
      const att = Number(matchedSub.attended || 0);
      const tot = Number(matchedSub.total || 0);
      const tgt = customTargetPct ?? Number(matchedSub.target ?? currentTarget);
      const pct = matchedSub.percentage !== undefined ? Number(matchedSub.percentage) : tot > 0 ? (att / tot) * 100 : 100;
      const p = tgt / 100;
      const safeBunksLeft = tot > 0 && p > 0 ? Math.max(0, Math.floor((att - p * tot) / p)) : 0;
      const classesNeeded = tot > 0 && p < 1 ? Math.max(0, Math.ceil((p * tot - att) / (1 - p))) : 0;
      const bufferMsg =
        pct >= tgt
          ? safeBunksLeft > 0
            ? `You can safely miss **${safeBunksLeft}** consecutive class${safeBunksLeft !== 1 ? "es" : ""} and stay above ${tgt}%.`
            : `You are right on the edge of ${tgt}% — missing the next class will drop you below target.`
          : `You need to attend the next **${classesNeeded}** consecutive class${classesNeeded !== 1 ? "es" : ""} to reach ${tgt}%.`;
      const skipCount = pct >= tgt ? Math.max(1, safeBunksLeft) : -classesNeeded;
      const projTot = tot + Math.abs(skipCount);
      const projAtt = skipCount < 0 ? att + Math.abs(skipCount) : att;
      return {
        intent: "FORECAST_SIMULATION",
        reply: `In **${matchedSub.name}${matchedSub.code ? ` (${matchedSub.code})` : ""}**, your current attendance is **${pct.toFixed(1)}%** (${att}/${tot} classes, Target: ${tgt}%). ${bufferMsg}`,
        simulation: {
          subjectId: matchedSub.id,
          subjectName: matchedSub.name,
          skipCount,
          currentAttended: att,
          currentTotal: tot,
          projectedPercentage: projTot > 0 ? Math.round((projAtt / projTot) * 1000) / 10 : 100,
          targetPercentage: tgt,
        },
      };
    }

    const overallBuffer =
      currentOverall >= currentTarget
        ? `You are **Safe** (+${(currentOverall - currentTarget).toFixed(1)}% above ${currentTarget}%) with an overall buffer of **${overallSafeBunks}** class${overallSafeBunks !== 1 ? "es" : ""}.`
        : `You are below your ${currentTarget}% target and need **${overallNeeded}** consecutive classes overall.`;
    const subjectLines = subjects
      .map((s) => {
        const att = Number(s.attended || 0);
        const tot = Number(s.total || 0);
        const tgt = Number(s.target ?? currentTarget);
        const pct = s.percentage !== undefined ? Number(s.percentage) : tot > 0 ? (att / tot) * 100 : 100;
        const p = tgt / 100;
        const bunks = tot > 0 && p > 0 ? Math.max(0, Math.floor((att - p * tot) / p)) : 0;
        const need = tot > 0 && p < 1 ? Math.max(0, Math.ceil((p * tot - att) / (1 - p))) : 0;
        const tag = pct >= tgt ? (bunks > 0 ? `Safe: can miss ${bunks}` : "On edge (0 bunks)") : `Attend next ${need}`;
        return `• **${s.name}**: **${pct.toFixed(1)}%** (${att}/${tot}) — *${tag}*`;
      })
      .join("\n");
    return {
      intent: "TIMETABLE_QUERY",
      reply: `Your overall attendance is **${currentOverall.toFixed(1)}%** (${totalAttended}/${totalClasses} classes). ${overallBuffer}${subjectLines ? `\n\n**Subject Breakdown:**\n${subjectLines}` : ""}`,
    };
  }

  // 12. Single-Subject Simulation ("What if I miss 2 classes of DBMS?") (0ms)
  const singleSimMatch = lower.match(
    /^(?:what\s+(?:happens\s+)?if\s+i|if\s+i|simulate)\s+(miss(?:ing)?|skip(?:ping)?|bunk(?:ing)?|attend(?:ing)?)\s+(?:the\s+)?(?:next\s+)?(\d+)\s+(?:class(?:es)?|lectures?|sessions?|labs?)?\s*(?:of|in|for)?\s+(.+)$/i,
  );
  if (singleSimMatch && !/\b(week|month|semester|days|monday|tuesday|wednesday|thursday|friday)\b/i.test(singleSimMatch[3])) {
    const isMiss = /miss|skip|bunk/.test(singleSimMatch[1].toLowerCase());
    const count = Math.max(1, parseInt(singleSimMatch[2], 10));
    const matchedSub = resolveSubjectMatch(singleSimMatch[3].trim(), subjects);
    if (matchedSub) {
      const att = Number(matchedSub.attended || 0);
      const tot = Number(matchedSub.total || 0);
      const tgt = Number(matchedSub.target ?? currentTarget);
      const pct = tot > 0 ? (att / tot) * 100 : 100;
      const projTot = tot + count;
      const projAtt = isMiss ? att : att + count;
      const projPct = projTot > 0 ? (projAtt / projTot) * 100 : 100;
      const p = tgt / 100;
      let reply = "";
      if (isMiss) {
        reply = `If you miss **${count}** class${count !== 1 ? "es" : ""} of **${matchedSub.name}**, your attendance moves from **${pct.toFixed(1)}%** to **${projPct.toFixed(1)}%** (${projAtt}/${projTot} classes). `;
        if (projPct >= tgt) {
          const bunksAfter = Math.max(0, Math.floor((projAtt - p * projTot) / p));
          reply += `You remain **safe** above your ${tgt}% target with **${bunksAfter}** safe bunk${bunksAfter !== 1 ? "s" : ""} remaining.`;
        } else {
          const recoverNeeded = p < 1 ? Math.max(0, Math.ceil((p * projTot - projAtt) / (1 - p))) : 0;
          reply += `Warning: This drops you **below your ${tgt}% target**! You would need to attend **${recoverNeeded}** consecutive classes to recover.`;
        }
      } else {
        reply = `If you attend the next **${count}** class${count !== 1 ? "es" : ""} of **${matchedSub.name}**, your attendance rises from **${pct.toFixed(1)}%** to **${projPct.toFixed(1)}%** (${projAtt}/${projTot} classes).`;
      }
      return {
        intent: "FORECAST_SIMULATION",
        reply,
        simulation: {
          subjectId: matchedSub.id,
          subjectName: matchedSub.name,
          skipCount: isMiss ? count : -count,
          currentAttended: att,
          currentTotal: tot,
          projectedPercentage: Math.round(projPct * 10) / 10,
          targetPercentage: tgt,
        },
      };
    }
  }

  return null;
}
