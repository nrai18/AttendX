/**
 * Global Curriculum Dictionary — AttendX
 * Covers all branches at IIITU: ECE, CSE, IT, DS, CY
 * Year 1 (Sem 1-2), Year 2 (Sem 3-4), Year 3 (Sem 5-6), Year 4 (Sem 7-8)
 *
 * Code convention:
 *  - XXMC = Major Core
 *  - XXSE = Skill Enhancement / Program Elective
 *  - SCMS/SEMS/CSMS/ITMS/DSMS/CYMS = Minor / Open Electives
 *  - ICMD = Multi Disciplinary (Institute Common)
 *  - ICAE = Ability Enhancement (Institute Common)
 *  - ICVA = Value Added / Institute Core
 *  - XXL = Lab (standalone practical)
 */
export const SUBJECT_DICTIONARY: Record<string, { title: string; category: string; credits?: number }> = {

  // ─── YEAR 1 — SEMESTER 1 & 2 (Common for all branches) ───────────────────

  "ICMD101": { title: "Introduction to Bioinformatics", category: "Multi Disciplinary", credits: 3 },
  "ICMD102": { title: "Engineering Chemistry", category: "Multi Disciplinary", credits: 4 },
  "ICMD103": { title: "Engineering Physics", category: "Multi Disciplinary", credits: 4 },
  "ICMD104": { title: "Engineering Mathematics I", category: "Multi Disciplinary", credits: 4 },
  "ICMD105": { title: "Engineering Mathematics II", category: "Multi Disciplinary", credits: 4 },
  "ICMD106": { title: "Engineering Mathematics III", category: "Multi Disciplinary", credits: 4 },
  "ICMD107": { title: "Environmental Studies", category: "Multi Disciplinary", credits: 3 },

  "ICAE101": { title: "Communication Skills", category: "Ability Enhancement", credits: 4 },
  "ICAE102": { title: "Technical Writing and Presentation", category: "Ability Enhancement", credits: 2 },

  "ICVA101": { title: "Indian Constitution and Human Rights", category: "Institute Core / Value Added", credits: 2 },
  "ICVA102": { title: "Yoga and Wellness", category: "Institute Core / Value Added", credits: 1 },
  "ICVA103": { title: "NCC / NSS / Sports", category: "Institute Core / Value Added", credits: 1 },

  "CSMC101": { title: "Basics of Programming in C", category: "Major Core", credits: 4 },
  "CSMC102": { title: "Computer Workshop", category: "Major Core", credits: 2 },
  "CSMC103": { title: "Data Structures and Algorithms", category: "Major Core", credits: 4 },

  "ECMC101": { title: "Electronics Workshop", category: "Major Core", credits: 2 },
  "ECMC102": { title: "Basic Electrical and Electronics Engineering", category: "Major Core", credits: 4 },

  // ─── YEAR 2 — SEMESTER 3 & 4 ──────────────────────────────────────────────

  // --- ECE (Electronics & Communication Engineering) ---
  "ECMC201": { title: "Electronic Devices and Circuits", category: "Major Core", credits: 4 },
  "ECMC202": { title: "Digital Circuits and Systems", category: "Major Core", credits: 4 },
  "ECMC203": { title: "Signals and Systems", category: "Major Core", credits: 4 },
  "ECMC204": { title: "Electromagnetic Field Theory", category: "Major Core", credits: 4 },
  "ECMC205": { title: "Network Analysis and Synthesis", category: "Major Core", credits: 4 },
  "ECMC206": { title: "Design Engineering", category: "Major Core", credits: 2 },
  "ECMC207": { title: "Microwave Engineering", category: "Major Core", credits: 4 },
  "ECMC208": { title: "Analog Communication", category: "Major Core", credits: 4 },
  "ECMC209": { title: "Microprocessors and Microcontrollers", category: "Major Core", credits: 4 },
  "ECMC210": { title: "Linear Integrated Circuits", category: "Major Core", credits: 4 },
  "ECMC211": { title: "Control Systems", category: "Major Core", credits: 4 },
  "ECMC212": { title: "Digital Signal Processing", category: "Major Core", credits: 4 },
  "ECMC213": { title: "Product Development Lab", category: "Major Core", credits: 1 },

  // --- CSE (Computer Science & Engineering) ---
  "CSMC201": { title: "Object-Oriented Programming using Java", category: "Major Core", credits: 4 },
  "CSMC202": { title: "Database Management Systems", category: "Major Core", credits: 4 },
  "CSMC203": { title: "Operating Systems", category: "Major Core", credits: 4 },
  "CSMC204": { title: "Computer Organization and Architecture", category: "Major Core", credits: 4 },
  "CSMC205": { title: "Theory of Computation", category: "Major Core", credits: 4 },
  "CSMC206": { title: "Software Engineering", category: "Major Core", credits: 4 },
  "CSMC207": { title: "Computer Networks", category: "Major Core", credits: 4 },
  "CSMC208": { title: "Algorithm Design and Analysis", category: "Major Core", credits: 4 },
  "CSMC209": { title: "Python Programming", category: "Major Core", credits: 4 },
  "CSMC210": { title: "Compiler Design", category: "Major Core", credits: 4 },
  "CSMC211": { title: "Web Technologies", category: "Major Core", credits: 4 },
  "CSMC212": { title: "Discrete Mathematics", category: "Major Core", credits: 4 },
  "CSMC213": { title: "Cloud Computing", category: "Major Core", credits: 4 },
  "CSMC214": { title: "Machine Learning", category: "Major Core", credits: 4 },

  // --- IT (Information Technology) ---
  "ITMC201": { title: "Object-Oriented Programming using Java", category: "Major Core", credits: 4 },
  "ITMC202": { title: "Database Management Systems", category: "Major Core", credits: 4 },
  "ITMC203": { title: "Operating Systems", category: "Major Core", credits: 4 },
  "ITMC204": { title: "Computer Organization and Architecture", category: "Major Core", credits: 4 },
  "ITMC205": { title: "Data Communication Networks", category: "Major Core", credits: 4 },
  "ITMC206": { title: "Software Engineering", category: "Major Core", credits: 4 },
  "ITMC207": { title: "Web Technologies", category: "Major Core", credits: 4 },
  "ITMC208": { title: "Algorithm Design and Analysis", category: "Major Core", credits: 4 },
  "ITMC209": { title: "Python Programming", category: "Major Core", credits: 4 },
  "ITMC210": { title: "Human Computer Interaction", category: "Major Core", credits: 4 },
  "ITMC211": { title: "Information Security", category: "Major Core", credits: 4 },

  // --- DS (Data Science) ---
  "DSMC201": { title: "Statistical Methods for Data Science", category: "Major Core", credits: 4 },
  "DSMC202": { title: "Database Management Systems", category: "Major Core", credits: 4 },
  "DSMC203": { title: "Python for Data Science", category: "Major Core", credits: 4 },
  "DSMC204": { title: "Linear Algebra and Probability", category: "Major Core", credits: 4 },
  "DSMC205": { title: "Data Structures and Algorithms", category: "Major Core", credits: 4 },
  "DSMC206": { title: "Data Visualization", category: "Major Core", credits: 3 },
  "DSMC207": { title: "Machine Learning Fundamentals", category: "Major Core", credits: 4 },
  "DSMC208": { title: "Big Data Analytics", category: "Major Core", credits: 4 },

  // --- CY (Cyber Security) ---
  "CYMC201": { title: "Network Fundamentals and Security", category: "Major Core", credits: 4 },
  "CYMC202": { title: "Cryptography and Secure Communications", category: "Major Core", credits: 4 },
  "CYMC203": { title: "Operating Systems Security", category: "Major Core", credits: 4 },
  "CYMC204": { title: "Database Security", category: "Major Core", credits: 4 },
  "CYMC205": { title: "Ethical Hacking and Penetration Testing", category: "Major Core", credits: 4 },
  "CYMC206": { title: "Malware Analysis and Forensics", category: "Major Core", credits: 4 },
  "CYMC207": { title: "Web Application Security", category: "Major Core", credits: 4 },
  "CYMC208": { title: "Incident Response and Management", category: "Major Core", credits: 4 },

  // ─── YEAR 3 — SEMESTER 5 & 6 ──────────────────────────────────────────────

  // --- ECE Sem 5 Core ---
  "ECMC301": { title: "Digital Communication", category: "Major Core", credits: 4 },
  "ECMC302": { title: "VLSI Design", category: "Major Core", credits: 4 },
  "ECMC303": { title: "RF and Microwave Engineering", category: "Major Core", credits: 4 },
  "ECMC304": { title: "Information Theory and Coding", category: "Major Core", credits: 4 },
  "ECMC305": { title: "Advanced Digital Signal Processing", category: "Major Core", credits: 4 },
  "ECMC306": { title: "Satellite Communication", category: "Major Core", credits: 4 },

  // ECE Sem 5 Program Electives
  "ECSE301": { title: "Data Communication and Networks", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ECSE302": { title: "Embedded Systems", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ECSE303": { title: "Digital Design and Synthesis", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ECSE304": { title: "Fiber Optic Communication", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ECSE305": { title: "Artificial Neural Networks", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ECSE306": { title: "Digital Image Processing", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ECSE307": { title: "Internet of Things", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ECSE308": { title: "Power Electronics", category: "Skill Enhancement / Program Elective", credits: 4 },

  // ECE Sem 7 Program Electives
  "ECSE401": { title: "Wireless Communication", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ECSE402": { title: "Antenna and Wave Propagation", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ECSE403": { title: "5G and Beyond Wireless Networks", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ECSE404": { title: "Advanced VLSI Design", category: "Skill Enhancement / Program Elective", credits: 4 },

  // --- CSE Sem 5 Core ---
  "CSMC301": { title: "Artificial Intelligence", category: "Major Core", credits: 4 },
  "CSMC302": { title: "Computer Graphics and Visualization", category: "Major Core", credits: 4 },
  "CSMC303": { title: "Mobile Application Development", category: "Major Core", credits: 4 },
  "CSMC304": { title: "Distributed Systems", category: "Major Core", credits: 4 },
  "CSMC305": { title: "Cryptography and Network Security", category: "Major Core", credits: 4 },

  // CSE Sem 5 Program Electives
  "CSSE301": { title: "Machine Learning", category: "Skill Enhancement / Program Elective", credits: 4 },
  "CSSE302": { title: "Natural Language Processing", category: "Skill Enhancement / Program Elective", credits: 4 },
  "CSSE303": { title: "Blockchain Technology", category: "Skill Enhancement / Program Elective", credits: 4 },
  "CSSE304": { title: "Cloud Computing and DevOps", category: "Skill Enhancement / Program Elective", credits: 4 },
  "CSSE305": { title: "Full-Stack Web Development", category: "Skill Enhancement / Program Elective", credits: 4 },
  "CSSE306": { title: "Computer Vision", category: "Skill Enhancement / Program Elective", credits: 4 },

  // CSE Sem 7 Program Electives
  "CSSE401": { title: "Deep Learning", category: "Skill Enhancement / Program Elective", credits: 4 },
  "CSSE402": { title: "Advanced Cloud Architecture", category: "Skill Enhancement / Program Elective", credits: 4 },
  "CSSE403": { title: "Quantum Computing", category: "Skill Enhancement / Program Elective", credits: 4 },

  // --- IT Sem 5 Core ---
  "ITMC301": { title: "Network Security and Management", category: "Major Core", credits: 4 },
  "ITMC302": { title: "Cloud Infrastructure", category: "Major Core", credits: 4 },
  "ITMC303": { title: "Mobile and Pervasive Computing", category: "Major Core", credits: 4 },
  "ITMC304": { title: "Digital Forensics", category: "Major Core", credits: 4 },
  "ITMC305": { title: "Enterprise Resource Planning", category: "Major Core", credits: 4 },

  // IT Sem 5 Program Electives
  "ITSE301": { title: "Full-Stack Web Technologies", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ITSE302": { title: "DevOps and Continuous Integration", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ITSE303": { title: "Blockchain and Distributed Ledger", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ITSE304": { title: "Cybersecurity Fundamentals", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ITSE305": { title: "Augmented and Virtual Reality", category: "Skill Enhancement / Program Elective", credits: 4 },

  // IT Sem 7 Program Electives (compact identifiers)
  "ITSE401": { title: "Advanced Cloud and Edge Computing", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ITSE402": { title: "Digital Transformation Strategy", category: "Skill Enhancement / Program Elective", credits: 4 },

  // --- DS Sem 5 Core ---
  "DSMC301": { title: "Deep Learning", category: "Major Core", credits: 4 },
  "DSMC302": { title: "Natural Language Processing", category: "Major Core", credits: 4 },
  "DSMC303": { title: "Time Series Analysis", category: "Major Core", credits: 4 },
  "DSMC304": { title: "Data Engineering and Pipelines", category: "Major Core", credits: 4 },

  // DS Program Electives
  "DSSE301": { title: "Reinforcement Learning", category: "Skill Enhancement / Program Elective", credits: 4 },
  "DSSE302": { title: "Computer Vision for Data Science", category: "Skill Enhancement / Program Elective", credits: 4 },
  "DSSE303": { title: "Explainable AI", category: "Skill Enhancement / Program Elective", credits: 4 },

  // --- CY Sem 5 Core ---
  "CYMC301": { title: "Advanced Network Security", category: "Major Core", credits: 4 },
  "CYMC302": { title: "Secure Software Development", category: "Major Core", credits: 4 },
  "CYMC303": { title: "Cloud Security", category: "Major Core", credits: 4 },
  "CYMC304": { title: "Cyber Laws and Compliance", category: "Major Core", credits: 4 },

  // CY Program Electives
  "CYSE301": { title: "Mobile Security", category: "Skill Enhancement / Program Elective", credits: 4 },
  "CYSE302": { title: "IoT Security", category: "Skill Enhancement / Program Elective", credits: 4 },
  "CYSE303": { title: "Threat Intelligence and Hunting", category: "Skill Enhancement / Program Elective", credits: 4 },

  // ─── YEAR 4 — SEMESTER 7 & 8 (Compact Identifiers) ─────────────────────

  // ECE Sem 7 Core (compact)
  "ECL801": { title: "Major Project / Capstone Lab (ECE)", category: "Major Core", credits: 8 },
  "ECMC401": { title: "Optical Networks", category: "Major Core", credits: 4 },
  "ECMC402": { title: "Advanced Communication Systems", category: "Major Core", credits: 4 },
  "ECMC403": { title: "Radar and Navigation Systems", category: "Major Core", credits: 4 },
  "ECMC404": { title: "Smart Grid and Energy Systems", category: "Major Core", credits: 4 },

  // CSE Sem 7 Core (compact)
  "CSL801": { title: "Major Project / Capstone Lab (CSE)", category: "Major Core", credits: 8 },
  "CSSE24": { title: "Advanced Machine Learning and AI", category: "Skill Enhancement / Program Elective", credits: 4 },
  "CSSE13": { title: "Distributed and Cloud Systems", category: "Skill Enhancement / Program Elective", credits: 4 },
  "CSSE23": { title: "Cybersecurity and Ethical Hacking", category: "Skill Enhancement / Program Elective", credits: 4 },
  "CSMC401": { title: "Compiler Design and Optimization", category: "Major Core", credits: 4 },
  "CSMC402": { title: "High Performance Computing", category: "Major Core", credits: 4 },
  "CSMC403": { title: "Advanced Algorithms", category: "Major Core", credits: 4 },

  // IT Sem 7 Core (compact)
  "ITL801": { title: "Major Project / Capstone Lab (IT)", category: "Major Core", credits: 8 },
  "ITSE23": { title: "DevOps Engineering and SRE", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ITSE25": { title: "Enterprise Cloud Solutions", category: "Skill Enhancement / Program Elective", credits: 4 },
  "ITMC401": { title: "Knowledge Management Systems", category: "Major Core", credits: 4 },
  "ITMC402": { title: "E-Commerce and Digital Business", category: "Major Core", credits: 4 },

  // DS Sem 7 Core (compact)
  "DSL801": { title: "Major Project / Capstone Lab (DS)", category: "Major Core", credits: 8 },
  "DSMC401": { title: "AI Ethics and Governance", category: "Major Core", credits: 3 },
  "DSMC402": { title: "Advanced Statistical Modeling", category: "Major Core", credits: 4 },
  "DSSE401": { title: "Generative AI and Large Language Models", category: "Skill Enhancement / Program Elective", credits: 4 },
  "DSSE402": { title: "Data Privacy and Federated Learning", category: "Skill Enhancement / Program Elective", credits: 3 },

  // CY Sem 7 Core (compact)
  "CYL801": { title: "Major Project / Capstone Lab (CY)", category: "Major Core", credits: 8 },
  "CYMC401": { title: "Zero Trust Security Architecture", category: "Major Core", credits: 4 },
  "CYMC402": { title: "Penetration Testing Advanced", category: "Major Core", credits: 4 },
  "CYSE401": { title: "Security Operations Center (SOC) Management", category: "Skill Enhancement / Program Elective", credits: 4 },

  // ─── MINOR / OPEN ELECTIVES ───────────────────────────────────────────────

  // SC- prefix = Science (AI/ML minor from CSE)
  "SCMS301": { title: "Artificial Intelligence", category: "Minor / Open Elective", credits: 3 },
  "SCMS302": { title: "Soft Computing", category: "Minor / Open Elective", credits: 4 },
  "SCMS401": { title: "Deep Learning", category: "Minor / Open Elective", credits: 4 },
  "SCMS402": { title: "Cyber Physical Systems", category: "Minor / Open Elective", credits: 3 },
  "SCMS403": { title: "Introduction to Federated Learning", category: "Minor / Open Elective", credits: 3 },

  // SE- prefix = Systems Engineering minor (from ECE)
  "SEMS301": { title: "VLSI Technology", category: "Minor / Open Elective", credits: 3 },
  "SEMS302": { title: "Speech Signal Processing", category: "Minor / Open Elective", credits: 4 },
  "SEMS401": { title: "Introduction to IoT", category: "Minor / Open Elective", credits: 4 },
  "SEMS402": { title: "Biomedical Signal Processing", category: "Minor / Open Elective", credits: 3 },
  "SEMS403": { title: "Quantum Computing", category: "Minor / Open Elective", credits: 3 },

  // CS Minor courses offered by CSE for non-CSE students
  "CSMS301": { title: "Data Science and Analytics", category: "Minor / Open Elective", credits: 3 },
  "CSMS302": { title: "Web Application Development", category: "Minor / Open Elective", credits: 3 },
  "CSMS401": { title: "Blockchain and Applications", category: "Minor / Open Elective", credits: 3 },
  "CSMS402": { title: "DevOps and Cloud Fundamentals", category: "Minor / Open Elective", credits: 3 },

  // IT Minor courses
  "ITMS301": { title: "Business Intelligence and Analytics", category: "Minor / Open Elective", credits: 3 },
  "ITMS302": { title: "Digital Marketing and Analytics", category: "Minor / Open Elective", credits: 3 },
  "ITMS401": { title: "Project Management (Agile/Scrum)", category: "Minor / Open Elective", credits: 3 },

  // DS Minor courses
  "DSMS301": { title: "Exploratory Data Analysis", category: "Minor / Open Elective", credits: 3 },
  "DSMS401": { title: "Applied Machine Learning", category: "Minor / Open Elective", credits: 3 },

  // CY Minor courses
  "CYMS301": { title: "Introduction to Cybersecurity", category: "Minor / Open Elective", credits: 3 },
  "CYMS401": { title: "Digital Forensics and Investigation", category: "Minor / Open Elective", credits: 3 },

  // ─── ABILITY ENHANCEMENT & INSTITUTE CORE ────────────────────────────────

  "ICAE301": { title: "Professional Communication and Soft Skills", category: "Ability Enhancement", credits: 2 },
  "ICAE302": { title: "Entrepreneurship and Start-ups", category: "Ability Enhancement", credits: 3 },
  "ICAE303": { title: "Leadership and Team Management", category: "Ability Enhancement", credits: 2 },
  "ICAE401": { title: "Research Methodology and Technical Writing", category: "Ability Enhancement", credits: 2 },
  "ICAE402": { title: "Industry Internship / Industrial Training", category: "Ability Enhancement", credits: 6 },

  "ICVA301": { title: "Professional Ethics", category: "Institute Core / Value Added", credits: 2 },
  "ICVA302": { title: "Indian Knowledge Systems", category: "Institute Core / Value Added", credits: 2 },
  "ICVA401": { title: "Social Responsibility and Sustainability", category: "Institute Core / Value Added", credits: 2 },
};
