export const COURSE_CURRICULUM: Record<string, string> = {
  // ==========================================
  // Institute Core & Multi-Disciplinary (All Branches)
  // ==========================================
  ICMD101: "Introduction to Bioinformatics",
  ICMD102: "Engineering Chemistry",
  ICMD103: "Engineering Physics",
  ICMD104: "Engineering Mathematics-I",
  ICMD105: "Engineering Mathematics-II",
  ICAE101: "Communication Skills",
  ICAE301: "Professional Communication and Soft Skills",
  ICAE302: "Entrepreneurship and Start-ups",
  ICVA101: "Basic Environmental Science and Engineering",
  ICVA102: "Universal Human Values - I",
  ICVA103: "Universal Human Values - II",
  ICVA104: "Yoga and Sports",
  ICVA105: "Extra-Curricular Activities",
  ICVA301: "Professional Ethics",
  ICPR301: "Minor Project",
  ICPR401: "Major Project - I",
  ICPR402: "Major Project - II",

  // ==========================================
  // Computer Science & Engineering (CSE)
  // ==========================================
  CSMC101: "Basics of Programming in C",
  CSMC102: "Computer Workshop",
  CSMC103: "Data Structures and Algorithms",
  CSMC201: "Discrete Structures",
  CSMC202: "Computer Organization",
  CSMC203: "Design and Analysis of Algorithms",
  CSMC204: "Object Oriented Programming",
  CSMC205: "Operating Systems",
  CSMC206: "Database Management Systems",
  CSMC207: "Theory of Computation",
  CSMC208: "Computer Networks",
  CSMC209: "Python Programming",
  CSMC210: "Compiler Design",
  CSMC301: "Big Data Analytics",
  CSMC302: "Advanced Computer Networks",
  CSMC303: "Distributed Databases",

  // CSE Skill Enhancement / Program Electives
  CSSE301: "Data Science",
  CSSE302: "Computer Graphics",
  CSSE303: "Network Security",
  CSSE304: "Machine Learning",
  CSSE305: "Image Processing",
  CSSE306: "Principles of Information Security",
  CSSE307: "Speech and Language Processing",
  CSSE308: "Computer Vision",
  CSSE309: "Cloud Computing",
  CSSE401: "Pattern Recognition and Applications",
  CSSE402: "Software Engineering and Maintenance",
  CSSE403: "Cloud Security",

  // ==========================================
  // Information Technology (IT)
  // ==========================================
  ITMC101: "Basics of Programming in C",
  ITMC102: "Computer Workshop",
  ITMC103: "Data Structures and Algorithms",
  ITMC201: "Discrete Structures",
  ITMC202: "Computer Organization",
  ITMC203: "Design and Analysis of Algorithms",
  ITMC204: "Object Oriented Programming",
  ITMC205: "Operating Systems",
  ITMC206: "Database Management Systems",
  ITMC207: "Theory of Computation",
  ITMC208: "Computer Networks",
  ITMC209: "Python Programming",
  ITMC210: "Compiler Design",
  ITMC301: "Big Data Analytics",
  ITMC302: "Advanced Computer Networks",
  ITMC303: "Distributed Databases",

  // IT Skill Enhancement / Program Electives
  ITSE301: "Data Science",
  ITSE302: "Computer Graphics",
  ITSE303: "Network Security",
  ITSE304: "Machine Learning",
  ITSE305: "Image Processing",
  ITSE306: "Principles of Information Security",
  ITSE307: "Speech and Language Processing",
  ITSE308: "Computer Vision",
  ITSE309: "Cloud Computing",
  ITSE401: "Pattern Recognition and Applications",
  ITSE402: "Software Engineering and Maintenance",
  ITSE403: "Cloud Security",

  // ==========================================
  // Electronics and Communication Engineering (ECE)
  // ==========================================
  ECMC101: "Electronics Workshop",
  ECMC102: "Basic Electrical and Electronics Engineering",
  ECMC201: "Electronic Devices and Circuits",
  ECMC202: "Digital Circuits and Systems",
  ECMC203: "Signals and Systems",
  ECMC204: "Electromagnetic Field Theory",
  ECMC205: "Network Analysis and Synthesis",
  ECMC206: "Design Engineering",
  ECMC207: "Microwave Engineering",
  ECMC208: "Analog Communication",
  ECMC209: "Microprocessors and Microcontrollers",
  ECMC210: "Linear Integrated Circuits",
  ECMC211: "Control Systems",
  ECMC212: "Digital Signal Processing",
  ECMC213: "Product Development Lab",
  ECMC301: "Digital Communication",
  ECMC302: "VLSI Design",

  // ECE Skill Enhancement / Program Electives
  ECSE301: "Data Communication and Networks",
  ECSE302: "Embedded Systems",
  ECSE303: "Digital Design and Synthesis",
  ECSE304: "Fiber Optic Communication",
  ECSE305: "Artificial Neural Networks",
  ECSE306: "Digital Image Processing",
  ECSE401: "Wireless Communication",
  ECSE402: "Antenna and Wave Propagation",

  // ==========================================
  // Computer Science & Engineering (Cyber Security)
  // ==========================================
  CYMC201: "Introduction to Cryptography",
  CYMC202: "Fundamentals of Data Science",
  CYMC203: "Mobile Forensics and Security",
  CYMC301: "Blockchain and Cryptocurrencies",
  CYMC302: "Multimedia Security and Forensics",
  CYMC303: "Cyber Ethics, Privacy, and Legal Issues",

  // ==========================================
  // Computer Science & Engineering (Data Science)
  // ==========================================
  DSMC201: "Mathematical Foundation for Data Science",
  DSMC202: "Python Programming for Data Science",
  DSMC203: "Data Analysis and Visualization",
  DSMC301: "Optimization for Data Science",
  DSMC302: "Introduction to Statistical Learning",
  DSMC303: "Business Intelligence",

  // ==========================================
  // Open Electives / Minor Streams (SoC & SoE)
  // ==========================================
  SCMS301: "Artificial Intelligence",
  SCMS302: "Soft Computing",
  SCMS401: "Deep Learning",
  SCMS402: "Cyber Physical Systems",
  SCMS403: "Introduction to Federated Learning",
  SEMS301: "VLSI Technology",
  SEMS302: "Speech Signal Processing",
  SEMS401: "Introduction to IoT",
  SEMS402: "Biomedical Signal Processing",
  SEMS403: "Quantum Computing",
};

export const resolveSubjectName = (rawCode: string): string => {
  if (!rawCode) return "";
  const cleanCode = rawCode.replace(/\s*\([LPT]\)/g, "").trim();
  return COURSE_CURRICULUM[cleanCode] || cleanCode;
};

export const BRANCH_NAMES: Record<string, string> = {
  CSE: "Computer Science & Engineering",
  IT: "Information Technology",
  ECE: "Electronics & Communication Engineering",
  CY: "CSE (Cyber Security)",
  DS: "CSE (Data Science)",
};

export const CURRICULUM_META = {
  branches: Object.keys(BRANCH_NAMES),
  branchNames: BRANCH_NAMES,
  semesters: [1, 2, 3, 4, 5, 6, 7, 8],
};

// Map each code to a SUBJECT_DICTIONARY record for backwards compatibility
export const SUBJECT_DICTIONARY: Record<
  string,
  { title: string; category: string; credits: number }
> = {};

for (const [code, title] of Object.entries(COURSE_CURRICULUM)) {
  let category = "Core";
  let credits = 4;

  if (
    code.startsWith("ICMD") ||
    code.startsWith("ICAE") ||
    code.startsWith("ICVA") ||
    code.startsWith("ICPR")
  ) {
    category = "Institute Core";
    credits = code.includes("PR") ? 2 : code.includes("301") ? 2 : 3;
  } else if (
    code.includes("SE") ||
    code.startsWith("SCMS") ||
    code.startsWith("SEMS")
  ) {
    category = "Elective";
    credits = 4;
  }

  SUBJECT_DICTIONARY[code] = {
    title,
    category,
    credits,
  };
}
