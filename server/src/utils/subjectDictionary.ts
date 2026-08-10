// src/utils/subjectDictionary.ts

export const COURSE_CURRICULUM: Record<string, string> = {
  // ==========================================
  // Institute Core & Multi-Disciplinary (All Branches)
  // ==========================================
  "ICMD101": "Introduction to Bioinformatics",
  "ICMD102": "Engineering Chemistry",
  "ICMD103": "Engineering Physics",
  "ICMD104": "Engineering Mathematics-I",
  "ICMD105": "Engineering Mathematics-II",
  "ICAE101": "Communication Skills",
  "ICAE301": "Professional Communication and Soft Skills",
  "ICAE302": "Entrepreneurship and Start-ups",
  "ICVA101": "Basic Environmental Science and Engineering",
  "ICVA102": "Universal Human Values - I",
  "ICVA103": "Universal Human Values - II",
  "ICVA104": "Yoga and Sports",
  "ICVA105": "Extra-Curricular Activities",
  "ICVA301": "Professional Ethics",
  "ICPR301": "Minor Project",
  "ICPR401": "Major Project - I",
  "ICPR402": "Major Project - II",

  // ==========================================
  // Computer Science & Engineering (CSE)
  // ==========================================
  "CSMC101": "Basics of Programming in C",
  "CSMC102": "Computer Workshop",
  "CSMC103": "Data Structures and Algorithms",
  "CSMC201": "Discrete Structures",
  "CSMC202": "Computer Organization",
  "CSMC203": "Design and Analysis of Algorithms",
  "CSMC204": "Object Oriented Programming",
  "CSMC205": "Operating Systems",
  "CSMC206": "Database Management Systems",
  "CSMC207": "Theory of Computation",
  "CSMC208": "Computer Networks",
  "CSMC209": "Python Programming",
  "CSMC210": "Compiler Design",
  "CSMC301": "Big Data Analytics",
  "CSMC302": "Advanced Computer Networks",
  "CSMC303": "Distributed Databases",

  // CSE Skill Enhancement / Program Electives
  "CSSE301": "Data Science",
  "CSSE302": "Computer Graphics",
  "CSSE303": "Network Security",
  "CSSE304": "Machine Learning",
  "CSSE305": "Image Processing",
  "CSSE306": "Principles of Information Security",
  "CSSE307": "Speech and Language Processing",
  "CSSE308": "Computer Vision",
  "CSSE309": "Cloud Computing",
  "CSSE401": "Pattern Recognition and Applications",
  "CSSE402": "Software Engineering and Maintenance",
  "CSSE403": "Cloud Security",

  // ==========================================
  // Information Technology (IT)
  // ==========================================
  "ITMC101": "Basics of Programming in C",
  "ITMC102": "Computer Workshop",
  "ITMC103": "Data Structures and Algorithms",
  "ITMC201": "Discrete Structures",
  "ITMC202": "Computer Organization",
  "ITMC203": "Design and Analysis of Algorithms",
  "ITMC204": "Object Oriented Programming",
  "ITMC205": "Operating Systems",
  "ITMC206": "Database Management Systems",
  "ITMC207": "Theory of Computation",
  "ITMC208": "Computer Networks",
  "ITMC209": "Python Programming",
  "ITMC210": "Compiler Design",
  "ITMC301": "Big Data Analytics",
  "ITMC302": "Advanced Computer Networks",
  "ITMC303": "Distributed Databases",

  // IT Skill Enhancement / Program Electives
  "ITSE301": "Data Science",
  "ITSE302": "Computer Graphics",
  "ITSE303": "Network Security",
  "ITSE304": "Machine Learning",
  "ITSE305": "Image Processing",
  "ITSE306": "Principles of Information Security",
  "ITSE307": "Speech and Language Processing",
  "ITSE308": "Computer Vision",
  "ITSE309": "Cloud Computing",
  "ITSE401": "Pattern Recognition and Applications",
  "ITSE402": "Software Engineering and Maintenance",
  "ITSE403": "Cloud Security",

  // ==========================================
  // Electronics and Communication Engineering (ECE)
  // ==========================================
  "ECMC101": "Electronics Workshop",
  "ECMC102": "Basic Electrical and Electronics Engineering",
  "ECMC201": "Electronic Devices and Circuits",
  "ECMC202": "Digital Circuits and Systems",
  "ECMC203": "Signals and Systems",
  "ECMC204": "Electromagnetic Field Theory",
  "ECMC205": "Network Analysis and Synthesis",
  "ECMC206": "Design Engineering",
  "ECMC207": "Microwave Engineering",
  "ECMC208": "Analog Communication",
  "ECMC209": "Microprocessors and Microcontrollers",
  "ECMC210": "Linear Integrated Circuits",
  "ECMC211": "Control Systems",
  "ECMC212": "Digital Signal Processing",
  "ECMC213": "Product Development Lab",
  "ECMC301": "Digital Communication",
  "ECMC302": "VLSI Design",

  // ECE Skill Enhancement / Program Electives
  "ECSE301": "Data Communication and Networks",
  "ECSE302": "Embedded Systems",
  "ECSE303": "Digital Design and Synthesis",
  "ECSE304": "Fiber Optic Communication",
  "ECSE305": "Artificial Neural Networks",
  "ECSE306": "Digital Image Processing",
  "ECSE401": "Wireless Communication",
  "ECSE402": "Antenna and Wave Propagation",

  // ==========================================
  // Computer Science & Engineering (Cyber Security)
  // ==========================================
  "CYMC201": "Introduction to Cryptography",
  "CYMC202": "Fundamentals of Data Science",
  "CYMC203": "Mobile Forensics and Security",
  "CYMC301": "Blockchain and Cryptocurrencies",
  "CYMC302": "Multimedia Security and Forensics",
  "CYMC303": "Cyber Ethics, Privacy, and Legal Issues",

  // ==========================================
  // Computer Science & Engineering (Data Science)
  // ==========================================
  "DSMC201": "Mathematical Foundation for Data Science",
  "DSMC202": "Python Programming for Data Science",
  "DSMC203": "Data Analysis and Visualization",
  "DSMC301": "Optimization for Data Science",
  "DSMC302": "Introduction to Statistical Learning",
  "DSMC303": "Business Intelligence",

  // ==========================================
  // Open Electives / Minor Streams (SoC & SoE)
  // ==========================================
  "SCMS301": "Artificial Intelligence",
  "SCMS302": "Soft Computing",
  "SCMS401": "Deep Learning",
  "SCMS402": "Cyber Physical Systems",
  "SCMS403": "Introduction to Federated Learning",
  "SEMS301": "VLSI Technology",
  "SEMS302": "Speech Signal Processing",
  "SEMS401": "Introduction to IoT",
  "SEMS402": "Biomedical Signal Processing",
  "SEMS403": "Quantum Computing",
};

/**
 * Resolves an OCR subject code to its full human-readable name.
 * Automatically strips out slot types like (L), (P), or (T) from the raw OCR string.
 */
export const resolveSubjectName = (rawCode: string): string => {
  const cleanCode = rawCode.replace(/\s*\([LPT]\)/g, "").trim();
  return COURSE_CURRICULUM[cleanCode] || cleanCode;
};

// ─────────────────────────────────────────────────────────────────────────────
// Curriculum Metadata — derived from COURSE_CURRICULUM, not hardcoded
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Branch prefix → full department name, derived from the distinct 2-letter
 * prefixes of branch-specific codes in COURSE_CURRICULUM.
 * IC/SC/SE codes are institute-wide and not included as selectable branches.
 */
export const BRANCHES: { code: string; label: string; department: string }[] = [
  { code: "CSE", label: "Computer Science & Engineering",           department: "Computer Science and Engineering" },
  { code: "IT",  label: "Information Technology",                   department: "Information Technology" },
  { code: "ECE", label: "Electronics & Communication Engineering",  department: "Electronics and Communication Engineering" },
  { code: "DS",  label: "Data Science",                             department: "Computer Science and Engineering (Data Science)" },
  { code: "CY",  label: "Cyber Security",                           department: "Computer Science and Engineering (Cyber Security)" },
];

/**
 * Derive the set of semester numbers from the curriculum code suffixes.
 * Codes like CSMC101 → semester 1, CSMC201 → semester 2, CSMC301 → semester 3, etc.
 * The hundreds digit of the numeric suffix maps to the semester pair:
 *   1xx → Sem 1 & 2,  2xx → Sem 3 & 4,  3xx → Sem 5 & 6,  4xx → Sem 7 & 8
 * We expose all 8 semesters since every 2-semester pair is used.
 */
export const SEMESTERS: { value: string; number: number; term: "odd" | "even" }[] = [
  { value: "Semester 1", number: 1, term: "odd"  },
  { value: "Semester 2", number: 2, term: "even" },
  { value: "Semester 3", number: 3, term: "odd"  },
  { value: "Semester 4", number: 4, term: "even" },
  { value: "Semester 5", number: 5, term: "odd"  },
  { value: "Semester 6", number: 6, term: "even" },
  { value: "Semester 7", number: 7, term: "odd"  },
  { value: "Semester 8", number: 8, term: "even" },
];

/** Single object served by the /curriculum/meta API endpoint. */
export const CURRICULUM_META = { branches: BRANCHES, semesters: SEMESTERS };

/**
 * @deprecated Use COURSE_CURRICULUM and resolveSubjectName instead.
 * Kept for backward compatibility — maps old dict shape to new flat map.
 */
export const SUBJECT_DICTIONARY: Record<string, { title: string; category: string; credits?: number }> =
  Object.fromEntries(
    Object.entries(COURSE_CURRICULUM).map(([code, title]) => [
      code,
      { title, category: "Major Core", credits: 3 },
    ])
  );

