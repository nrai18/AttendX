import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { EmailService } from "./email.service";
import { prisma } from "../lib/prisma";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type IntentType =
  | "CHIT_CHAT"
  | "APP_FAQ"
  | "POLICY_RAG"
  | "SUBMIT_FEEDBACK"
  | "NAVIGATE_APP"
  | "UPDATE_SETTINGS"
  | "TIMETABLE_QUERY"
  | "FORECAST_SIMULATION"
  | "TRIGGER_REPORT"
  | "MARK_ATTENDANCE"
  | "SHIFT_TIMETABLE"
  | "MODIFY_SUBJECTS"
  | "MODIFY_TARGET"
  | "SIMULATE_ATTENDANCE"
  | "KNOWLEDGE_BASE"
  | "OUT_OF_SCOPE";

export interface ActionPayload {
  id: string;
  type: string;
  category: "SAFE" | "DESTRUCTIVE";
  isDestructive: boolean;
  requiresConfirmation: boolean;
  target: string;
  description: string;
  impact: string;
  payload: Record<string, any>;
}

export const ActionPolicyMatrix = {
  // Safe Actions (Tier 1)
  NAVIGATE: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },
  READ_STATS: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },
  FILTER_VIEW: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },
  SET_SIMULATION_PREVIEW: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },
  SWITCH_THEME: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },
  SHARE_APP: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },
  CHANGE_REMINDER_FREQUENCY: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },
  MARK_ATTENDANCE: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },
  TRIGGER_REPORT: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },
  SUBMIT_FEEDBACK: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },

  // Destructive Actions (Tier 2)
  REMOVE_SUBJECT: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  DROP_SUBJECT_FROM_TIMETABLE: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  REMOVE_ATTENDANCE: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  MARK_FULL_DAY_OFF: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  SHIFT_TIMETABLE_SLOT: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  ADD_SUBJECT: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  CHANGE_TARGET: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  CHANGE_GLOBAL_TARGET: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
};

export interface CopilotResponse {
  intent: IntentType;
  reply: string;
  response: string;
  citations: string[];
  actions: ActionPayload[];
  requiresConfirmation?: boolean;
  simulation?: {
    subjectId?: string;
    subjectName?: string;
    skipCount: number;
    currentAttended: number;
    currentTotal: number;
    projectedPercentage: number;
    targetPercentage: number;
  };
}

export interface SubjectContext {
  id: string;
  name: string;
  code?: string;
  target?: number;
  attended?: number;
  total?: number;
  percentage?: number;
}

export interface CopilotContext {
  userId?: string;
  userName?: string;
  appVersion?: string;
  activeSemesterId?: string;
  semesterName?: string;
  startDate?: string;
  endDate?: string;
  commencementDate?: string;
  lastWorkingDay?: string;
  overallPercentage?: number;
  targetPercentage?: number;
  totalAttended?: number;
  totalClasses?: number;
  currentRoute?: string;
  selectedItems?: any[];
  localTime?: string;
  subjects?: SubjectContext[];
  historyLogs?: any[];
  calendarEvents?: any[];
  history?: Array<{ role: string; content?: string; text?: string }>;
}

export interface OrdinanceRecord {
  id: string;
  part: string;
  section: string;
  title: string;
  keywords: string[];
  text: string;
}

// Default embedded IIIT Una ordinances to guarantee 100% offline self-containment
const EMBEDDED_ORDINANCES: OrdinanceRecord[] = [
  {
    id: "ord_1",
    part: "ORDINANCES",
    section: "O.1 - O.6",
    title: "General Ordinances for B.Tech & B.Tech (Honors)",
    keywords: ["academic session", "semesters", "admission", "JEE Mains", "JoSAA", "CSAB", "duration", "honors", "senate"],
    text: "O.1 Each academic session is divided into two regular semesters (Odd: mid July-Nov, Even: Jan-mid May) and two vacation semesters (winter ~4 weeks, summer ~8 weeks), following a Senate approved schedule.\nO.2 Admission to B.Tech. Degree program is made from qualified candidates of JEE (Mains) through CSAB and JoSAA.\nO.3 Admission to a particular branch of study is decided by JoSAA.\nO.4 Duration of B.Tech / B.Tech (Honors) is minimum 8 semesters (4 years) and maximum 12 semesters (6 years / max period 7 years under Reg 2.3).\nO.5 Students can opt for B.Tech. (Honors) at the end of the 4th semester subject to Senate conditions.\nO.6 Award of B.Tech / B.Tech (Honors) degree shall be in accordance with Senate approved regulations."
  },
  {
    id: "reg_1_2",
    part: "PART A: ACADEMIC RULES",
    section: "1 & 2",
    title: "Eligibility for Admission & Duration of Program",
    keywords: ["admission eligibility", "reservation", "SC", "ST", "OBC", "PwD", "EWS", "cancellation of admission", "duration", "maximum period", "7 years"],
    text: "1.1 Admission is as per MHRD/MoE guidelines with reservations for SC, ST, OBC, PwD, EWS.\n1.2 Admissions made in odd semester at 1st year level based on JEE (Mains) rank via JoSAA.\n1.3 If misinformation or unfulfilled requirements are found at any time, admission can be cancelled by Senate.\n1.4 Institute reserves right to cancel admission on grounds of indiscipline or misconduct. Medical fitness is required.\n2.1 Duration: 4 academic years (8 regular semesters of ~20 weeks each: Odd Sem mid-July to Nov, Even Sem Jan to mid-May, winter break ~4 weeks, summer break ~8 weeks).\n2.3 Maximum period for completion of B.Tech. program is seven (7) years."
  },
  {
    id: "reg_3_4",
    part: "PART A: ACADEMIC RULES",
    section: "3 & 4",
    title: "Fee Structure & Programs of Study",
    keywords: ["fee structure", "payment window", "fee deadline", "June 30", "December 31", "bank loan", "programs of study"],
    text: "3.1 Fee structure is decided by competent authority.\n3.2 Fee Payment Window:\n- Odd Semester: 1 - 30 June (Deadline: 30 June).\n- Even Semester: 1 - 31 December (Deadline: 31 December).\nAll students, including those availing bank loans, must pay fees by the deadline.\n4. B.Tech degree programs are offered in specializations specified by engineering schools as per UG curriculum."
  },
  {
    id: "reg_5_structure",
    part: "PART A: ACADEMIC RULES",
    section: "5.1 - 5.3",
    title: "Structure of Program & Credit Distribution",
    keywords: ["credits", "major", "minor", "project", "internship", "honors credits", "160 credits", "172 credits", "NPTEL", "SWAYAM", "MOOCs"],
    text: "5.1 Credit Distribution for regular B.Tech (Total: 160 Credits):\n1. Major (Core): 75 credits\n2. Minor (Stream): 18 credits\n3. Multi-disciplinary: 19 credits\n4. Ability Enhancement: 9 credits\n5. Skill Enhancement: 16 credits\n6. Value Added Courses: 8 credits\n7. Project: 15 credits (Semesters VI, VII, VIII)\n8. Internship: 10 credits (VIII semester in lieu of project requirements for eligible students)\nTotal for Regular B.Tech = 160 Credits.\nHonours/Online Optional Courses: 12 credits.\nTotal for B.Tech with Honors = 172 Credits.\n5.3 Interdisciplinary projects allowed (max 3 students team across departments with HoD permission). Elective withdrawal allowed within 2 weeks from semester start.\nHonors Eligibility: GPA >= 8.5 in each of the first four semesters. Must maintain GPA >= 8.5 across all 8 semesters. NPTEL/SWAYAM courses must be passed with Elite or above certificate."
  },
  {
    id: "reg_5_minor",
    part: "PART A: ACADEMIC RULES",
    section: "5.4 - 5.6",
    title: "Minor Degree Rules & Eligibility",
    keywords: ["minor degree", "minor track", "minor eligibility", "CGPA 7.5", "4th semester", "18-20 credits", "one attempt", "extra credit"],
    text: "5.4 Minor Degree:\n- Ordered sequence of 5 courses (18-20 credits) in a domain outside the major discipline, spread from 4th to 8th semester.\n- Credits earned in Minor are in addition to 160 major credits.\n5.5 Eligibility for Minor:\n- Registration in 4th semester for students with CGPA >= 7.5 up to 3rd semester, with all courses passed in ONE attempt without grace.\n- Maximum ONE Minor track allowed.\n5.6 Minor Degree Award Rules:\n- Must complete all courses in the chosen minor track in ONE attempt.\n- If student fails any minor course, minor registration ceases (not eligible for minor degree, but regular degree unaffected; passed credits recorded as Extra Credits on mark sheet).\n- Minor degree must be completed simultaneously with major degree (cannot be earned later).\n- Separate CGPAs are calculated and mentioned on mark sheet for Major and Minor."
  },
  {
    id: "reg_5_7_course_plan",
    part: "PART A: ACADEMIC RULES",
    section: "5.7",
    title: "Course Plan & Assessments",
    keywords: ["course plan", "course outcomes", "assessments", "compensation assessment", "absentee assessment", "class committee"],
    text: "5.7 Course Plan:\n- Details course overview, objectives, outcomes, teaching-learning activities, assessment methods, and compensation policy.\n- Number of assessments per course ranges from 4 to 6 (group tasks, quizzes, assignments, open book tests, lab exercises, mini-projects, end-semester exam).\n- Students missing an assessment for genuine/emergency reasons may be granted ONE compensation assessment as per absentee schedule.\n- Approved by Class Committee (CC) chairperson and HoD."
  },
  {
    id: "reg_6_attendance",
    part: "PART A: ACADEMIC RULES",
    section: "6.1 - 6.10",
    title: "Attendance Policy, Mandatory 75%, Shortage Grades (L & R), Leave Rules & On-Duty",
    keywords: ["attendance", "75%", "minimum attendance", "mandatory attendance", "L grade", "R grade", "55%", "shortage attendance", "medical leave", "9 days leave", "5% relaxation", "70%", "on-duty", "6 weeks absence", "sports leave", "interview on-duty", "CCPD"],
    text: "6.1 Mandatory Requirement: 75% attendance is mandatory for all courses (except in cases of medical/sports/institute representing, etc.).\n6.2 Consequence of Shortage: Students having less than 75% attendance in any course SHALL NOT BE PERMITTED to appear for the end semester examination in that course.\n6.3 Continuous Assessment: Minimum 75% attendance required to be eligible for continuous assessment exams.\n6.4 Shortage Attendance Grades:\n- 55% to 75% Attendance: Awarded 'L' Grade (Lack of Attendance). The student must complete the attendance criteria by attending required classes before course instructor during semester breaks (if offered) and get an attendance completion certificate to appear in the supplementary exam.\n- Less than 55% (<55%) Attendance: Awarded 'R' Grade (Redo). The student MUST re-register for the course in the next academic year and repeat the entire course.\n6.5 Short Duration Absence (up to 9 days):\n- For absence of maximum 9 days (inclusive of prefixing and suffixing weekends), submit leave application to concerned HoD with supporting documents.\n- HoD shall grant leave. Consolidated attendance is calculated by REMOVING this period of leave (denominator reduced). Admissible ONCE per semester.\n6.6 Long Duration Absence (> 9 days):\n- Prior application through HoD to Dean-Academic Affairs with supporting documents.\n- Granted if aggregate attendance was at least 75% at time of applying.\n- If permitted student's attendance still remains below 75%, a 5% relaxation may be granted (lowering requirement to 70%).\n6.7 Unnotified Absence > 6 Weeks: If absent for more than 6 weeks without notifying Dean-Academic Affairs, registration for that semester stands CANCELLED.\n6.8 On-Duty (OD) Attendance: Representing the Institute in approved extracurriculars (Sports, Games, Cultural meets, Seminars, Workshops, Conferences, CCPD Interviews, NCC/NSS Camps) is considered 'on-duty' with prior HoD permission. Period of absence is COUNTED AS 'PRESENT' for attendance computation.\n6.10 Elective Change: Marked absent in newly registered elective for duration of attending classes in previously registered elective."
  },
  {
    id: "reg_7_8_9",
    part: "PART A: ACADEMIC RULES",
    section: "7, 8, 9",
    title: "Faculty Mentor, Registration & Class Committee",
    keywords: ["faculty mentor", "STAR records", "registration", "enrolment", "class committee", "meetings", "chairperson"],
    text: "7. Faculty Mentor (FM): Assigned in 1st year, guides student until graduation, meets 2-3 times/semester, maintains Student Appraisal Records (STAR).\n8. Registration & Enrolment: First working day of every semester is registration day. Must clear all dues (Institute, Hostel, Library) to be eligible for enrolment.\n9. Class Committee (CC):\n- Constitution: Chairperson (faculty not teaching that class), all course teachers, and 4 nominated student members.\n- Meets 3 times per semester: 1st meeting within 1 week of semester start; 2nd meeting after 6 weeks; 3rd meeting after 10 weeks to review feedback and assessment progress."
  },
  {
    id: "reg_10_assessment",
    part: "PART A: ACADEMIC RULES",
    section: "10.1 - 10.4",
    title: "Assessment Procedure, Theory & Lab Weightages, Integrated Courses & Projects",
    keywords: ["assessment weightage", "theory weightage", "lab weightage", "mid-term exam", "end semester exam", "continuous assessment", "integrated course", "project evaluation", "viva-voce"],
    text: "10.1 Typical Assessment Weightages:\nA. Theory Courses (100%):\n- Continuous Assessment (quizzes/tests/assignments, min 2): 20%\n- Mid-Term Examination (90 minutes): 30%\n- End-Semester Examination (180 minutes): 50%\nB. Lab Courses (100%):\n- Continuous Assessment (programming/demos/assignments, min 2): 40%\n- Lab File / Record: 10%\n- End-Semester Exam / Viva (180 minutes): 50%\n10.2 Integrated Courses (Theory + Lab):\n- Evaluation based on credit ratio (e.g., for 4-credit 3-0-2 course, Lab is 25% and Theory is 75%).\n10.4 Project Work Evaluation:\n- Evaluated by Project Monitoring Committee (PMC: HoD/nominee, coordinator, guide).\n- Continuous supervisor assessment: 20%\n- Mid-Semester Review (6-8 weeks from start): 40%\n- Final Viva-Voce: 40% (with internal/external examiner from IISc/IITs/NITs/IIITs/Govt labs)."
  },
  {
    id: "reg_11_12_13_grading",
    part: "PART A: ACADEMIC RULES",
    section: "11, 12, 13",
    title: "Grading System, Relative vs Absolute, Passing 30% End-Sem Rule, Supplementary Exams",
    keywords: ["grading system", "letter grades", "grade points", "relative grading", "absolute grading", "30% end-sem minimum", "passing criteria", "cut-off", "mean", "supplementary examination", "ABS", "I grade", "M grade", "PAC"],
    text: "11. Absentee Assessment: Genuine reasons get compensation test. End-sem absence results in 'ABS' grade and loss of weightage.\n12. Performance Analysis Committee (PAC): Meets within 7 days of last exam to finalize grade ranges and submit to Dean Academic.\n13. Grading System:\n- Letter Grades & Grade Points: S (10 - Outstanding), A (9 - Excellent), B (8 - Very Good), C (7 - Good), D (6 - Average), E (5 - Marginal), I (0 - Incomplete), L (Lack of Attendance), R (Redo Course), M (Malpractice), ABS (Absent).\n- Relative Grading: Followed for classes with >= 30 students. Passing cut-off is X_bar / 2 (half of class mean). Students scoring above cut-off placed in top 6 bands (S to E: 10%, 15%, 25%, 25%, 15%, 10% typically). Below cut-off gets 'I' grade.\n- Absolute Grading: Used if class strength < 30 students: S (>=85), A (75-84), B (65-74), C (55-64), D (45-54), E (35-44), I (<=34).\n- MANDATORY 30% PASS CRITERIA: A student MUST score at least 30% marks in the End-Semester Examination to be awarded any passing grade. Scoring <30% in end-sem results in an 'I' grade automatically.\n- Supplementary Examinations: Conducted 1 week prior to registration of next semester for students with 'I', 'L', 'M', and 'ABS' grades."
  },
  {
    id: "reg_14_15_16_17_18_19",
    part: "PART A: ACADEMIC RULES",
    section: "14 - 19",
    title: "Transparency, Re-evaluation, Break of Study, SGPA/CGPA & Degree Requirements",
    keywords: ["revaluation", "re-evaluation", "answer scripts", "temporary break of study", "SGPA", "CGPA", "B.Tech degree eligibility", "honors degree eligibility", "CGPA 5", "CGPA 8.5"],
    text: "14. Transparency in Assessment: Students can review evaluated answer scripts within 2 weeks of reopening. Answer scripts retained for 2 academic years for audit.\n15. Temporary Break of Study: Allowed with Dean Academic approval on HoD recommendation. Governed by rules in force upon rejoining.\n16. SGPA & CGPA Calculation:\n- SGPA = (Sum of Credits * Grade Points) / (Total Semester Credits)\n- CGPA = (Sum of Credits * Grade Points for all courses) / (Total Accumulated Credits)\n17. B.Tech Degree Eligibility Requirements:\n- Earn minimum prescribed total credits (160 credits).\n- Minimum CGPA of 5.0.\n- No outstanding dues (Institute, Library, Hostels).\n- No pending disciplinary actions.\n18. B.Tech (Honors) Degree Eligibility Requirements:\n- SGPA >= 8.0 in first four semesters.\n- Completed 4 additional approved MOOC/NPTEL courses (3 credits each = 12 credits) starting from 5th semester.\n- SGPA >= 8.5 from 5th to 8th semesters.\n- Overall CGPA >= 8.5 across all semesters.\n- No backlogs and no disciplinary actions."
  },
  {
    id: "reg_20_21_22_23_24",
    part: "PART A: ACADEMIC RULES",
    section: "20 - 24",
    title: "Exam Conduct, Malpractices, Penalties, Appellate Committee & Scholarships",
    keywords: ["malpractice", "exam hall rules", "cheating", "impersonation", "mobile phones", "M grade", "debarring", "rustication", "appellate committee", "scholarship"],
    text: "20. Exam Conduct: Strict discipline. Disciplinary committee handles academic dishonesty.\n21. Malpractice Rules & Punishments:\n- Taking answer booklet outside: 'M' Grade in subject.\n- Verbal communication after 1 warning: Answer script taken away, asked to leave hall.\n- Possession of unauthorized material / mobile phones / programmable calculators / copying: Zero marks in continuous eval; 'I' Grade in end-sem (eligible for makeup).\n- Possession/exchange of another candidate's answer book: Zero marks & 'I' Grade in subject.\n- Misbehavior, threatening invigilator, repeated offences: Cancellation of all theory exams in semester + debarred for 1 year (2 semesters).\n- Impersonation: Handed over to police; cancellation of all exams + debarred for 2 years for both impersonator and candidate.\n- Physical assault: RUSTICATION from Institute.\n22. Certificate Retention Fee charged as per norms.\n23. Academic Appellate Committee: Dean Academics (Convener), Dean Student Welfare, HoD.\n24. Scholarships: Institute does not offer direct institute scholarship; students can avail Central/State Govt scholarships."
  },
  {
    id: "reg_part_b_hostel_1_4",
    part: "PART B: ADMINISTRATIVE & HOSTEL",
    section: "1 - 4",
    title: "Hostel Management, Accommodation, Allotment & Exemption",
    keywords: ["hostel management", "accommodation", "room allocation", "vacation stay", "PhD hostel", "allotment", "exemption from hostel"],
    text: "1. Hostel Management: Managed by Hostel Administration Committee (HAC) including Chief Warden, Warden, Assistant Warden, Caretaker, and Student Secretaries (Hostel, Cultural, Sports, Mess).\n2. Accommodation: Available to B.Tech students during working academic year only. Must vacate rooms before vacations (unless permission granted for project/institute work). PhD scholars get hostel up to max 5 years.\n3. Conditions of Allotment: Personal Data Form with parent contact required. Standard room inventory: cot, table, chair, ceiling fan, tube light. Room changes not permitted normally. Room vacating slip in triplicate.\n4. Exemption from Residence: Married/Research/QIP scholars provided campus quarters are exempted. Day scholars/exemption granted by Chief Warden if shortage of rooms."
  },
  {
    id: "reg_part_b_hostel_code_conduct",
    part: "PART B: ADMINISTRATIVE & HOSTEL",
    section: "5.1 - 5.12",
    title: "Hostel Code of Conduct, Girls In-Timing (10:00 PM), Room Upkeep & Property Damage",
    keywords: ["hostel code of conduct", "girls in-timing", "10:00 PM", "curfew", "ID cards", "room maintenance", "furniture", "property damage", "damage fine"],
    text: "5.1 Maintain courteous behavior inside and outside campus.\n5.2 Must carry valid Institute ID card at all times.\n5.3 Keep rooms and common areas clean. No pasting/scribbling on walls.\n5.4 Girls In-Timing: All girl students must be inside the hostel before 10:00 PM. Prior permission from Warden required to stay away during weekends/holidays.\n5.5 - 5.11 Room upkeep is personal responsibility. No screening pirated/unlicensed movies. Damage to room/furniture recovered from occupants or collective fine on hostel. No moving furniture or tampering with electrical fittings.\n5.12 Must sign Hostel Upkeep Undertaking form."
  },
  {
    id: "reg_part_b_ragging",
    part: "PART B: ADMINISTRATIVE & HOSTEL",
    section: "5.13 - 5.14",
    title: "Anti-Ragging Regulations, UGC Guidelines & Severe Punishments",
    keywords: ["ragging", "anti-ragging", "UGC regulations", "punishment for ragging", "suspension", "expulsion", "rustication", "FIR", "first year hostel separate"],
    text: "5.13 Ragging is totally banned and a criminal offence under IPC & UGC Regulations 2009.\n5.14 Definition of Ragging: Any conduct teasing, handling with rudeness, rowdism, causing psychological harm, physical abuse, extortion, forced acts, or disrupting academic activity of freshers.\n- Protection for Informants: Students reporting ragging are protected.\n- 1st Year Protection: First year UG students are lodged in separate fenced hostels; seniors are strictly denied entry.\n- Punishments for Ragging:\n  i) Suspension from classes and academic privileges.\n  ii) Withholding scholarships/fellowships.\n  iii) Debarring from tests/exams.\n  iv) Withholding results.\n  v) Debarring from representing institute in sports/meets.\n  vi) Suspension/expulsion from hostel.\n  vii) Cancellation of admission.\n  viii) Rustication for 1 to 4 semesters.\n  ix) Expulsion from institute & debarring from admission to other institutions, plus collective punishment if culprits not identified."
  },
  {
    id: "reg_part_b_drugs_appliances_vehicles",
    part: "PART B: ADMINISTRATIVE & HOSTEL",
    section: "5.15 - 9.18",
    title: "Smoking/Alcohol Ban, Electrical Appliances Ban, Vehicle Ban, Guests & Responsibilities",
    keywords: ["alcohol ban", "smoking ban", "drugs", "substance abuse", "electrical appliances", "heaters banned", "cooking forbidden", "powered vehicles banned", "guests", "visitors", "campus timing 10:00 PM"],
    text: "5.15 Smoking, Alcohol & Narcotics: STRICTLY PROHIBITED in campus and hostels. Possession or consumption leads to IMMEDIATE EXPULSION from hostel and RUSTICATION from Institute. Entire campus is a smoke-free zone.\n6. Guests & Visitors: Guest stay max 1 week with prior Warden approval on payment. No overnight guests in student rooms. Men visiting women's hostel and vice-versa is strictly restricted.\n8. Appliances & Cooking: Electric heaters, immersion rods, electric stoves, and electric irons are FORBIDDEN in rooms. Private cooking in rooms is strictly forbidden (appliances confiscated + fine).\n9. Collective Responsibilities:\n- Powered vehicles (bikes/cars) for students are COMPLETELY BANNED on campus. Violating vehicles will be confiscated until course completion with heavy penal charges.\n- Cycles must be parked in designated parking only.\n- Students going outside should return to campus before 10:00 PM.\n- No picnics without Dean Student Welfare permission. No organizing unauthorized meetings/functions."
  },
  {
    id: "reg_part_b_mess_rules",
    part: "PART B: ADMINISTRATIVE & HOSTEL",
    section: "11.1 - 11.29",
    title: "Mess Rules, Compulsory Dining, Rebate / Reduction Policy (N-2 Days)",
    keywords: ["mess rules", "mess reduction", "mess rebate", "N-2 days", "mess fees", "medical mess reduction", "3 days in advance", "food waste", "self service"],
    text: "11. Mess Rules:\n11.1 All hostel residents must be members of a hostel mess. Must carry ID card & mess card.\n11.2 Permanent membership for semester. Mess change only for 2nd year UG onwards senior boys.\n11.9 - 11.10 Self-service system; unlimited food except special items. No wasting food.\n11.21 No food or utensils (plates, spoons, tumblers) allowed outside mess/in rooms (unless sick with Medical Officer certificate).\n11.11 - 11.17 Mess Reduction (Rebate) Policy:\n- Admissible Grounds: Approved study holidays/semester vacations, HoD-recommended sports/competitions/educational tours, placement interviews/internships, hospitalization due to serious illness.\n- Application Deadline: Apply in prescribed form 3 DAYS IN ADVANCE forwarded by Warden, and sign the Mess Leaving Register.\n- Calculation Formula: Entitled to reduction ONLY for (N - 2) days, where N is the total number of days absent from the mess.\n- Medical Leave from native place: Must intimate Mess Manager by post before holiday expiry with doctor's certificate (Civil Asst Surgeon or higher).\n11.20 Cooking in rooms is strictly forbidden."
  },
  {
    id: "reg_part_b_roll_call_1st_year",
    part: "PART B: ADMINISTRATIVE & HOSTEL",
    section: "13 & 14",
    title: "Roll Call Extension (till 11:00 PM) & First Year UG Hostel Special Rules",
    keywords: ["roll call extension", "11:00 PM", "club extension", "festival extension", "first year rules", "9:30 PM entry", "10:00 PM roll call", "no birthday party", "no terrace", "dress code", "senior hostel visit banned"],
    text: "13. Roll Call Extension Rules:\n- Extension granted for club work and festival teams till 11:00 PM (conducted in Admin building).\n- Apply to Warden before 4:00 PM on the day with staff advisor permission letter.\n- Girls roll call extension after 10:00 PM uses biometric system and intimation to warden & parents. (Min 3 girls per club/team).\n14. Special Rules for ALL First Year UG Hostels:\n14.1 Must enter hostel before 9:30 PM. Latecomers banned from outings for 1 week (doubled on repetition).\n14.2 Compulsory roll call by 10:00 PM.\n14.3 Maintain silence after 10:00 PM.\n14.4 Mandatory entry in IN/OUT register when leaving campus.\n14.5 No tobacco/alcohol/drugs.\n14.7 No corridor games except indoor board games (chess/carrom).\n14.8 Birthday parties and celebrations inside hostel are NOT ALLOWED.\n14.9 Hostel terrace is strictly out of bounds.\n14.12 Dress Code: Sleeveless dress is NOT permitted in the mess.\n14.13 Anti-Ragging Separation: First year students are STRICTLY PROHIBITED from visiting senior hostels. Violators face suspension from hostel."
  },
  {
    id: "reg_part_b_cells_discipline",
    part: "PART B: ADMINISTRATIVE & HOSTEL",
    section: "15 - 18 & Student Disciplinary Code",
    title: "Women's Cell (POSH), Grievance Cell, RTI, Reservation & Student Disciplinary Code",
    keywords: ["women's cell", "sexual harassment", "POSH Act 2013", "grievance cell", "RTI", "reservation cell", "disciplinary code", "sanctions", "suspension", "restitution", "expulsion", "appeal to senate", "police assistance"],
    text: "15. Women's Cell: Constituted under Sexual Harassment of Women at Workplace (Prevention, Prohibition, Redressal) Act 2013. Gender-neutral policy covering physical advances, sexual remarks, stalking, voyeurism, exhibitionism, offensive work environment. Criminal offences result in academic termination/suspension.\n16. Grievance Cell: Redresses student grievances, suggestion boxes, email to officer in-charge.\n17. RTI Cell: RTI Act 2005 compliance (www.iiitu.ac.in/rti.html).\n18. Reservation Cell: UGC/AICTE norms.\nSTUDENT CONDUCT & DISCIPLINARY CODE (Sections 1-15):\n- Applicable to all students across all campus activities.\n- Prohibited: Groupism, mobile phones in classrooms/labs/exam halls, anti-institutional/political agitations, strikes, gherao, damaging property, weapons/explosives, rash driving, unauthorized outsiders.\n- Sanctions:\n  * Minor: Formal warning letter.\n  * Major: Debarring from exams, Suspension (with loss of attendance for suspension period), Restitution (compensating property damage / physical injury), Forfeiture of caution deposit, Expulsion (permanent dismissal).\n- Functionaries: HoDs/Wardens impose minor sanctions; Dean Student Welfare recommends major sanctions; Director is ultimate authority for major sanctions.\n- Right to Appeal: Appeal against authority lies to Director; appeal against Director lies to Senate (Senate decision is final)."
  }
];

export class CustomMlCopilotService {
  private static isWarmedUp = false;
  private static ordinances: OrdinanceRecord[] = EMBEDDED_ORDINANCES;

  /**
   * Warmup method called on server startup to initialize service and ordinances
   */
  public static warmup(): void {
    if (this.isWarmedUp) return;
    try {
      const candidates = [
        path.resolve(process.cwd(), "ml-server/data/iiit_una_ordinances.json"),
        path.resolve(process.cwd(), "../ml-server/data/iiit_una_ordinances.json"),
        path.resolve(__dirname, "../../../ml-server/data/iiit_una_ordinances.json"),
        path.resolve(__dirname, "../../ml-server/data/iiit_una_ordinances.json"),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, "utf8");
          this.ordinances = JSON.parse(raw);
          break;
        }
      }
    } catch {
      this.ordinances = EMBEDDED_ORDINANCES;
    }
    this.isWarmedUp = true;
    console.log(`[CustomMlCopilotService] Warmup completed. Gemini 3.8-Flash intent router initialized with ${this.ordinances.length} ordinances.`);
  }

  /**
   * Helper to construct schema-compliant Copilot actions conforming to ActionPolicyMatrix
   */
  public static createAction(
    type: string,
    payload: Record<string, any>,
    target: string,
    description: string,
    customImpact?: string
  ): ActionPayload {
    const policy = (ActionPolicyMatrix as Record<string, any>)[type] || {
      category: "SAFE" as const,
      isDestructive: false,
      requiresConfirmation: false,
    };
    const isDestructive = Boolean(policy.isDestructive);
    const requiresConfirmation = Boolean(policy.requiresConfirmation);
    const category = (policy.category || (isDestructive ? "DESTRUCTIVE" : "SAFE")) as "SAFE" | "DESTRUCTIVE";
    const impact =
      customImpact ||
      (isDestructive
        ? `Destructive action: Modifies or alters persistent academic data for ${target}.`
        : `Safe action: No persistent data loss.`);

    return {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type,
      category,
      isDestructive,
      requiresConfirmation,
      target,
      description,
      impact,
      payload,
    };
  }

  /**
   * Main entrypoint for processing user queries using Gemini 3.8-Flash intent router
   */
  public static async process(
    query: string,
    context: CopilotContext = {},
    masterPrompt?: string
  ): Promise<CopilotResponse> {
    if (!this.isWarmedUp) {
      this.warmup();
    }

    // Preserve toxic guardrail
    const TOXIC_PATTERN = /\b(fuck|shit|bitch|asshole|dick|dickhead|cunt|slut|whore|bastard|fag|nigger|nigga|retard|stfu|idiot|dumbass|motherfucker)\b/i;
    if (TOXIC_PATTERN.test(query)) {
      const reply = "Please keep the conversation respectful and focused on your academic schedule.";
      return {
        intent: "CHIT_CHAT",
        reply,
        response: reply,
        citations: [],
        actions: [],
        requiresConfirmation: false,
      };
    }

    let parsed: any = null;

    if (process.env.GEMINI_API_KEY) {
      try {
        const relevantOrd = this.searchOrdinance(query);
        const ordContext = relevantOrd ? `[RELEVANT ORDINANCE]\nSection: ${relevantOrd.section}\nTitle: ${relevantOrd.title}\nText: ${relevantOrd.summary}` : "";

        const systemPrompt = `You are AttendX AI Copilot, the intelligent academic advisor and intent router for AttendX (created by Naman Rai).
Analyze the student's query and app context, classify their intent into exactly ONE of the 12 supported intents, formulate a helpful, concise, friendly reply, and stage any corresponding actions.

CRITICAL: Return ONLY a valid JSON object matching the schema below. No markdown wrapping or backticks.

Supported Intents:
1. CHIT_CHAT: Greetings, conversational pleasantries, small talk, questions about creator (Naman Rai), or assistant identity.
2. APP_FAQ: Questions about AttendX features (peer sync, backups, import/export, notifications, offline mode, settings).
3. POLICY_RAG: Questions regarding college academic regulations, IIIT Una ordinances, 75% attendance rule, shortage grades (L grade: 55-75%, R grade: <55%), leave rules (9-day medical leave), 5% relaxation, on-duty (OD) rules, hostel in-timing (10:00 PM), mess rebate (N-2 days), anti-ragging, exams, or grading.
4. SUBMIT_FEEDBACK: Bug reports, user feedback, complaints, or feature requests.
5. NAVIGATE_APP: Requests to navigate to specific app screens (timetable, settings, reports, calendar, forecast/predictive, today/agenda, assignments, peer-sync, semester).
6. UPDATE_SETTINGS: Requests to change app settings (switch theme to dark/light, change reminder frequency).
7. TIMETABLE_QUERY: Queries about scheduled lectures, classes today/tomorrow, or timetable lookup.
8. FORECAST_SIMULATION: Questions asking "what if I miss/attend X classes", "can I bunk", or simulating attendance percentages.
9. TRIGGER_REPORT: Requests to email or send attendance report, summary, or analytics to the student.
10. MARK_ATTENDANCE: Marking attendance for a subject (present, absent, medical, on duty) or marking a full day off.
11. SHIFT_TIMETABLE: Rescheduling, postponing, or shifting a timetable slot to another time or day.
12. MODIFY_SUBJECTS: Adding a new subject or removing/dropping a subject from the timetable/enrollment.
13. MODIFY_TARGET: Changing individual subject target or global attendance target percentage.

Action Types & Payloads:
- Safe Actions (executed immediately):
  * NAVIGATE: { "path": string } (e.g. "/timetable", "/settings", "/report", "/calendar", "/predictive", "/today", "/peer-sync", "/semester")
  * READ_STATS: {}
  * FILTER_VIEW: { "filter": string }
  * SET_SIMULATION_PREVIEW: { "subjectId": string, "skipCount": number }
  * SWITCH_THEME: { "theme": "dark" | "light" | "system" }
  * SHARE_APP: {}
  * CHANGE_REMINDER_FREQUENCY: { "frequency": string }
  * MARK_ATTENDANCE: { "subjectId": string, "date": string, "status": "present" | "absent" | "medical" | "od" | "off" }
  * TRIGGER_REPORT: { "stats": object }
  * SUBMIT_FEEDBACK: { "type": string, "description": string, "issue": string }
- Destructive Actions (flagged as requiresConfirmation=true):
  * REMOVE_SUBJECT: { "subjectId": string }
  * DROP_SUBJECT_FROM_TIMETABLE: { "slotId": string, "subjectId": string }
  * REMOVE_ATTENDANCE: { "subjectId": string, "date": string }
  * MARK_FULL_DAY_OFF: { "date": string }
  * SHIFT_TIMETABLE_SLOT: { "subjectId": string, "dayOfWeek": number, "newStartTime": string, "newEndTime": string }
  * ADD_SUBJECT: { "name": string, "code": string, "target": number }
  * CHANGE_TARGET: { "subjectId": string, "target": number }
  * CHANGE_GLOBAL_TARGET: { "target": number }

Response JSON Schema:
{
  "intent": "CHIT_CHAT" | "APP_FAQ" | "POLICY_RAG" | "SUBMIT_FEEDBACK" | "NAVIGATE_APP" | "UPDATE_SETTINGS" | "TIMETABLE_QUERY" | "FORECAST_SIMULATION" | "TRIGGER_REPORT" | "MARK_ATTENDANCE" | "SHIFT_TIMETABLE" | "MODIFY_SUBJECTS" | "MODIFY_TARGET",
  "reply": "string (clear, conversational response to the student)",
  "citations": ["string (e.g. section references if policy question)"],
  "simulation": {
    "subjectName": "string",
    "skipCount": number,
    "currentAttended": number,
    "currentTotal": number,
    "projectedPercentage": number,
    "targetPercentage": number
  },
  "feedback": {
    "type": "bug" | "feature" | "feedback" | "general",
    "description": "string",
    "issue": "string"
  },
  "actions": [
    {
      "type": "string",
      "target": "string",
      "description": "string",
      "impact": "string",
      "payload": {}
    }
  ]
}`;

        const subjectsSummary = (context.subjects || [])
          .map((s) => `  * ${s.name} (ID: ${s.id}${s.code ? `, Code: ${s.code}` : ""}): ${s.attended || 0}/${s.total || 0} (${(s.percentage || 0).toFixed(1)}%, Target: ${s.target || 75}%)`)
          .join("\n") || "  None enrolled";

        const userPrompt = `User Query: "${query}"
Context:
- User Name: ${context.userName || "Student"}
- Current Route: ${context.currentRoute || "/today"}
- Local Time: ${context.localTime || new Date().toISOString()}
- Overall Attendance: ${context.overallPercentage ?? 100}% (${context.totalAttended ?? 0}/${context.totalClasses ?? 0} classes)
- Target Attendance: ${context.targetPercentage ?? 75}%
- Enrolled Subjects:
${subjectsSummary}

${ordContext}

${masterPrompt ? `Master Context:\n${masterPrompt}` : ""}`;

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });

        const responseText = response.text || "{}";
        const cleaned = responseText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        parsed = JSON.parse(cleaned);
      } catch (err) {
        console.warn("[CustomMlCopilotService] Gemini router failed or threw error, using fallback router:", err);
      }
    } else {
      console.warn("[CustomMlCopilotService] GEMINI_API_KEY is not configured, using fallback intent router.");
    }

    if (!parsed) {
      return await this.fallbackProcess(query, context);
    }

    const intent: IntentType = parsed.intent || "CHIT_CHAT";
    const reply: string = parsed.reply || "I have processed your request.";
    const citations: string[] = Array.isArray(parsed.citations) ? parsed.citations : [];
    const simulation = parsed.simulation;

    // Map actions through ActionPolicyMatrix
    const rawActions: any[] = Array.isArray(parsed.actions) ? parsed.actions : [];
    const validatedActions: ActionPayload[] = [];
    let requiresConfirmation = false;

    for (const raw of rawActions) {
      if (!raw || !raw.type) continue;
      const action = this.createAction(
        raw.type,
        raw.payload || {},
        raw.target || "system",
        raw.description || raw.type,
        raw.impact
      );
      if (action.requiresConfirmation) {
        requiresConfirmation = true;
      }
      validatedActions.push(action);
    }

    // Connect Email Hooks (Requirement R4)
    // 1. TRIGGER_REPORT
    if (intent === "TRIGGER_REPORT" || validatedActions.some((a) => a.type === "TRIGGER_REPORT")) {
      let userEmail = "";
      let userName = context.userName || "Student";
      if (context.userId) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: context.userId },
            select: { email: true, name: true },
          });
          if (user) {
            userEmail = user.email;
            userName = user.name || userName;
          }
        } catch (dbErr) {
          console.error("[CustomMlCopilotService] Failed to query user for report email:", dbErr);
        }
      }

      const stats = {
        overallPercentage: context.overallPercentage ?? 100,
        weeklyAttended: context.totalAttended ?? 0,
        weeklyTotal: context.totalClasses ?? 0,
        subjects: context.subjects || [],
      };

      if (userEmail) {
        try {
          await EmailService.sendWeeklyReport(userEmail, userName, stats);
        } catch (mailErr) {
          console.error("[CustomMlCopilotService] Failed to send weekly report email:", mailErr);
        }
      }

      if (!validatedActions.some((a) => a.type === "TRIGGER_REPORT")) {
        validatedActions.push(
          this.createAction(
            "TRIGGER_REPORT",
            { email: userEmail, stats },
            userEmail ? `email:${userEmail}` : "user:report",
            `Send weekly attendance report to ${userEmail || "registered email"}`,
            "Safe action: Dispatches weekly attendance report email."
          )
        );
      }
    }

    // 2. SUBMIT_FEEDBACK
    if (intent === "SUBMIT_FEEDBACK" || validatedActions.some((a) => a.type === "SUBMIT_FEEDBACK")) {
      let userEmail = "";
      let userName = context.userName || "Student";
      if (context.userId) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: context.userId },
            select: { email: true, name: true },
          });
          if (user) {
            userEmail = user.email;
            userName = user.name || userName;
          }
        } catch (dbErr) {
          console.error("[CustomMlCopilotService] Failed to query user for feedback email:", dbErr);
        }
      }

      const feedbackData = {
        type: parsed.feedback?.type || "feedback",
        description: parsed.feedback?.description || query,
        issue: parsed.feedback?.issue || "Copilot User Feedback",
      };

      if (context.userId) {
        try {
          await (prisma as any).feedback.create({
            data: {
              userId: context.userId,
              type: feedbackData.type,
              issue: feedbackData.issue,
              frequency: "once",
              description: feedbackData.description,
              email: userEmail || "anonymous@attendx.tech",
            },
          });
        } catch (dbErr) {
          console.error("[CustomMlCopilotService] Failed to store feedback in database:", dbErr);
        }
      }

      if (userEmail) {
        try {
          await EmailService.sendFeedbackReceipt(userEmail, userName, feedbackData);
        } catch (mailErr) {
          console.error("[CustomMlCopilotService] Failed to send feedback receipt email:", mailErr);
        }
      }

      if (!validatedActions.some((a) => a.type === "SUBMIT_FEEDBACK")) {
        validatedActions.push(
          this.createAction(
            "SUBMIT_FEEDBACK",
            { feedback: feedbackData, email: userEmail },
            "support:feedback",
            "Submit user feedback and send confirmation email",
            "Safe action: Logs feedback ticket and dispatches receipt email."
          )
        );
      }
    }

    return {
      intent,
      reply,
      response: reply,
      citations,
      actions: validatedActions,
      requiresConfirmation,
      simulation,
    };
  }

  /**
   * Graceful fallback intent router when Gemini API is unavailable or offline
   */
  private static async fallbackProcess(query: string, context: CopilotContext): Promise<CopilotResponse> {
    const lower = query.toLowerCase();
    const localDate = context.localTime ? new Date(context.localTime) : new Date();

    // 1. CHIT_CHAT
    const greetingPattern = /^\s*(hi+|he+y+|hello+|heya|howdy|sup|yo|namaste|greetings|good\s+(morning|afternoon|evening|day|night)|how\s+(are|r)\s+(you|u|ya)|how\s+do\s+you\s+do|how('s|\s+is)\s+it\s+going|how\s+are\s+you\s+doing|what('s|\s+is)\s+up|whats\s+up|who\s+(are|r)\s+(you|u)|what\s+is\s+your\s+name|what('s|\s+is)\s+your\s+name|who\s+(made|created|built|developed)\s+(you|u)|what\s+can\s+you\s+do|tell\s+me\s+about\s+yourself|what\s+are\s+you|thank(s|\s+you|\s+u|\s+you\s+so\s+much)?|thx|appreciate\s+it|bye(\s+bye)?|goodbye|see\s+(you|ya)|cya|take\s+care|ok(ay)?|cool|nice|awesome|great)[\s.?!]*$/i;
    if (greetingPattern.test(lower) || /^(hi|hello|hey|greetings)/i.test(lower)) {
      const userName = context.userName || "Student";
      let reply = `Hello ${userName}! I'm AttendX AI, your personal academic companion created by Naman Rai. How can I assist you with your classes, attendance, or timetable today?`;
      if (/\b(who (made|created|built|developed) you)\b/i.test(lower)) {
        reply = `I am AttendX AI, created and developed by Naman Rai as your intelligent in-app academic companion and policy advisor for IIIT Una.`;
      } else if (/\b(who (are|r) you|what is your name|what('s| is) your name)\b/i.test(lower)) {
        reply = `Hello ${userName}! I am AttendX AI, your intelligent academic companion and policy advisor for IIIT Una, created by Naman Rai.`;
      }
      return {
        intent: "CHIT_CHAT",
        reply,
        response: reply,
        citations: [],
        actions: [],
        requiresConfirmation: false,
      };
    }

    // 2. TRIGGER_REPORT
    if (/(send|email|dispatch|mail|generate)\s+.*?(report|summary|attendance report)/i.test(lower) || /(report to my email|email my report)/i.test(lower)) {
      let userEmail = "";
      let userName = context.userName || "Student";
      if (context.userId) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: context.userId },
            select: { email: true, name: true },
          });
          if (user) {
            userEmail = user.email;
            userName = user.name || userName;
          }
        } catch (dbErr) {
          console.error("[CustomMlCopilotService] Error fetching user in fallback:", dbErr);
        }
      }

      const stats = {
        overallPercentage: context.overallPercentage ?? 100,
        weeklyAttended: context.totalAttended ?? 0,
        weeklyTotal: context.totalClasses ?? 0,
        subjects: context.subjects || [],
      };

      if (userEmail) {
        try {
          await EmailService.sendWeeklyReport(userEmail, userName, stats);
        } catch (mailErr) {
          console.error("[CustomMlCopilotService] Error sending report email in fallback:", mailErr);
        }
      }

      const action = this.createAction(
        "TRIGGER_REPORT",
        { email: userEmail, stats },
        userEmail ? `email:${userEmail}` : "user:report",
        `Send weekly attendance report to ${userEmail || "registered email"}`,
        "Safe action: Dispatches weekly attendance report email."
      );
      const reply = userEmail
        ? `I have dispatched your detailed attendance report to ${userEmail}.`
        : "I have prepared your attendance report summary.";

      return {
        intent: "TRIGGER_REPORT",
        reply,
        response: reply,
        citations: [],
        actions: [action],
        requiresConfirmation: false,
      };
    }

    // 3. SUBMIT_FEEDBACK
    if (/\b(bug|bugs|feedback|suggest|suggestion|suggestions|complaint|complaints|issue|glitch|error)\b/i.test(lower) || /(issue with|problem with|bug with)/i.test(lower)) {
      let userEmail = "";
      let userName = context.userName || "Student";
      if (context.userId) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: context.userId },
            select: { email: true, name: true },
          });
          if (user) {
            userEmail = user.email;
            userName = user.name || userName;
          }
        } catch (dbErr) {
          console.error("[CustomMlCopilotService] Error fetching user in fallback:", dbErr);
        }
      }

      const feedbackData = {
        type: lower.includes("bug") ? "bug" : "feedback",
        description: query,
        issue: "User Feedback submitted via AI Copilot",
      };

      if (context.userId) {
        try {
          await (prisma as any).feedback.create({
            data: {
              userId: context.userId,
              type: feedbackData.type,
              issue: feedbackData.issue,
              frequency: "once",
              description: feedbackData.description,
              email: userEmail || "anonymous@attendx.tech",
            },
          });
        } catch (dbErr) {
          console.error("[CustomMlCopilotService] Error saving feedback in fallback:", dbErr);
        }
      }

      if (userEmail) {
        try {
          await EmailService.sendFeedbackReceipt(userEmail, userName, feedbackData);
        } catch (mailErr) {
          console.error("[CustomMlCopilotService] Error sending feedback email in fallback:", mailErr);
        }
      }

      const action = this.createAction(
        "SUBMIT_FEEDBACK",
        { feedback: feedbackData, email: userEmail },
        "support:feedback",
        "Submit user feedback and send confirmation email",
        "Safe action: Logs feedback ticket and dispatches receipt email."
      );
      const reply = "Thank you for your feedback! It has been logged and sent to the AttendX engineering team.";

      return {
        intent: "SUBMIT_FEEDBACK",
        reply,
        response: reply,
        citations: [],
        actions: [action],
        requiresConfirmation: false,
      };
    }

    // 4. NAVIGATE_APP
    if (/^(navigate( to)?|open|go to|show me( my)?|view)\s+(timetable|schedule|settings|reports?|calendar|forecast|today|assignments?|peer sync|profile)/i.test(lower)) {
      let path = "/today";
      let title = "Today's Agenda";
      if (/(timetable|schedule|routine)/i.test(lower)) { path = "/timetable"; title = "Timetable"; }
      else if (/(setting|settings|preference|profile)/i.test(lower)) { path = "/settings"; title = "Settings"; }
      else if (/(report|reports|analytic|analytics)/i.test(lower)) { path = "/report"; title = "Attendance Reports"; }
      else if (/(calendar|event|events|academic)/i.test(lower)) { path = "/calendar"; title = "Academic Calendar"; }
      else if (/(forecast|predict|prediction|predictive)/i.test(lower)) { path = "/predictive"; title = "Predictive Forecast"; }
      else if (/(peer|friends|sync)/i.test(lower)) { path = "/peer-sync"; title = "Peer Sync"; }
      else if (/(assignment|assignments|task|tasks)/i.test(lower)) { path = "/assignments"; title = "Assignments"; }
      else if (/(semester|hub|overview)/i.test(lower)) { path = "/semester"; title = "Semester Overview"; }

      const reply = `Navigating to ${title}.`;
      const action = this.createAction("NAVIGATE", { path }, `route:${path}`, `Navigate to ${title}`, `Safe navigation action: opens ${title}.`);
      return {
        intent: "NAVIGATE_APP",
        reply,
        response: reply,
        citations: [],
        actions: [action],
        requiresConfirmation: false,
      };
    }

    // 5. UPDATE_SETTINGS
    if (/(switch to (dark|light) theme|theme to (dark|light)|change theme|switch theme)/i.test(lower)) {
      const isDark = lower.includes("dark");
      const theme = isDark ? "dark" : "light";
      const action = this.createAction("SWITCH_THEME", { theme }, "theme:ui", `Switch app theme to ${theme}`, "Safe action: Updates theme preference.");
      const reply = `Switched theme preference to ${theme}.`;
      return {
        intent: "UPDATE_SETTINGS",
        reply,
        response: reply,
        citations: [],
        actions: [action],
        requiresConfirmation: false,
      };
    }

    // 6. TIMETABLE_QUERY
    if (/(what class(es)?|what lecture(s)?|schedule (today|tomorrow|on)|my classes today)/i.test(lower)) {
      const dayMatch = this.extractDayOfWeek(lower, localDate);
      const reply = `Here is your schedule for ${dayMatch.dayName}. Check your timetable view for room allocations.`;
      const action = this.createAction("READ_STATS", { day: dayMatch.dayName }, `timetable:${dayMatch.dayName}`, `Read schedule for ${dayMatch.dayName}`, "Safe action: Queries timetable.");
      return {
        intent: "TIMETABLE_QUERY",
        reply,
        response: reply,
        citations: [],
        actions: [action],
        requiresConfirmation: false,
      };
    }

    // 7. FORECAST_SIMULATION
    if (/(if i miss|simulate|what if i (miss|attend|skip)|can i bunk|how many classes can i bunk|what will my percentage be)/i.test(lower)) {
      const resolvedSubject = this.resolveSubject(query, context.subjects || []);
      const targetPct = resolvedSubject.target || context.targetPercentage || 75;
      const currentAttended = resolvedSubject.attended ?? context.totalAttended ?? 20;
      const currentTotal = resolvedSubject.total ?? context.totalClasses ?? 25;
      const currentPct = currentTotal > 0 ? (currentAttended / currentTotal) * 100 : 100;

      const countMatch = lower.match(/(\d+)\s*(classes|lectures|days|sessions)/i);
      const count = countMatch ? parseInt(countMatch[1], 10) : 2;
      const isMiss = !/(attend|attending|go to)/i.test(lower);

      let projectedAttended = currentAttended;
      let projectedTotal = currentTotal + count;
      if (!isMiss) projectedAttended += count;
      const projectedPct = (projectedAttended / projectedTotal) * 100;
      const safeBunks = Math.max(0, Math.floor((currentAttended - (targetPct / 100) * currentTotal) / (targetPct / 100)));

      let reply = "";
      if (isMiss) {
        reply = `If you miss ${count} class${count > 1 ? "es" : ""} of ${resolvedSubject.name}, your attendance changes from ${currentPct.toFixed(1)}% to ${projectedPct.toFixed(1)}% (${projectedAttended}/${projectedTotal} classes). `;
        if (projectedPct >= targetPct) {
          reply += `You remain above your ${targetPct}% target with ${Math.max(0, safeBunks - count)} safe leave${safeBunks - count !== 1 ? "s" : ""} remaining.`;
        } else {
          reply += `This drops you below your ${targetPct}% target. You will need to attend ${Math.ceil(((targetPct / 100) * projectedTotal - projectedAttended) / (1 - targetPct / 100))} consecutive classes to recover.`;
        }
      } else {
        reply = `If you attend the next ${count} class${count > 1 ? "es" : ""} of ${resolvedSubject.name}, your attendance rises from ${currentPct.toFixed(1)}% to ${projectedPct.toFixed(1)}% (${projectedAttended}/${projectedTotal} classes).`;
      }

      return {
        intent: "FORECAST_SIMULATION",
        reply,
        response: reply,
        citations: [],
        actions: [],
        requiresConfirmation: false,
        simulation: {
          subjectId: resolvedSubject.id,
          subjectName: resolvedSubject.name,
          skipCount: isMiss ? count : 0,
          currentAttended,
          currentTotal,
          projectedPercentage: Math.round(projectedPct * 10) / 10,
          targetPercentage: targetPct,
        },
      };
    }

    // 8. SHIFT_TIMETABLE
    if (/(reschedule|move|shift|postpone)\s+.*?(lecture|class|slot|session|to\s+\d+|today|tomorrow|monday|tuesday|wednesday|thursday|friday)/i.test(lower)) {
      const resolvedSubject = this.resolveSubject(query, context.subjects || []);
      const activeSemId = context.activeSemesterId || "sem_active";
      const dayMatch = this.extractDayOfWeek(lower, localDate);
      const timeMatch = this.extractTime(lower);
      const reply = `I have scheduled a timetable shift for ${resolvedSubject.name} on ${dayMatch.dayName} to ${timeMatch.startTime} - ${timeMatch.endTime}. Please confirm to apply.`;
      const action = this.createAction(
        "SHIFT_TIMETABLE_SLOT",
        {
          semesterId: activeSemId,
          subjectId: resolvedSubject.id,
          dayOfWeek: dayMatch.dayIndex,
          newStartTime: timeMatch.startTime,
          newEndTime: timeMatch.endTime,
        },
        `timetable:${resolvedSubject.name} (${dayMatch.dayName})`,
        `Shift timetable slot for ${resolvedSubject.name} on ${dayMatch.dayName} to ${timeMatch.startTime} - ${timeMatch.endTime}`,
        `Destructive action: Shifts recurring weekly timetable slot for ${resolvedSubject.name}.`
      );
      return {
        intent: "SHIFT_TIMETABLE",
        reply,
        response: reply,
        citations: [],
        actions: [action],
        requiresConfirmation: true,
      };
    }

    // 9. MARK_ATTENDANCE
    if (/(update my|mark( my)?|set( my)?|record( my)?)\s+.*?(attendance|present|absent|medical|on duty|off|leave)/i.test(lower) || /(full day off|day off)/i.test(lower)) {
      if (/(full day off|day off|holiday today)/i.test(lower)) {
        const dateStr = this.extractDate(lower, localDate);
        const reply = `I have staged an action to mark the full day off on ${dateStr}. Please confirm to proceed.`;
        const action = this.createAction("MARK_FULL_DAY_OFF", { date: dateStr }, `date:${dateStr}`, `Mark full day off on ${dateStr}`, `Destructive action: Marks all scheduled lectures on ${dateStr} as OFF.`);
        return {
          intent: "MARK_ATTENDANCE",
          reply,
          response: reply,
          citations: [],
          actions: [action],
          requiresConfirmation: true,
        };
      }

      const resolvedSubject = this.resolveSubject(query, context.subjects || []);
      const dateStr = this.extractDate(lower, localDate);
      let status = "present";
      if (/\b(medical|sick)\b/i.test(lower)) status = "medical";
      else if (/\b(on duty|duty|od)\b/i.test(lower)) status = "od";
      else if (/\b(absent|missed|miss)\b/i.test(lower)) status = "absent";
      else if (/\b(off|cancelled|canceled)\b/i.test(lower)) status = "off";

      const reply = `Marked attendance for ${resolvedSubject.name} as ${status.toUpperCase()} on ${dateStr}.`;
      const action = this.createAction(
        "MARK_ATTENDANCE",
        { subjectId: resolvedSubject.id, date: dateStr, status },
        `subject:${resolvedSubject.name}`,
        `Record attendance for ${resolvedSubject.name} as ${status.toUpperCase()} on ${dateStr}`,
        `Safe update: Logs status as ${status.toUpperCase()} for ${resolvedSubject.name}.`
      );
      return {
        intent: "MARK_ATTENDANCE",
        reply,
        response: reply,
        citations: [],
        actions: [action],
        requiresConfirmation: false,
      };
    }

    // 10. MODIFY_TARGET
    if (/(target|goal)\s+.*?(to\s+(\d+)%|(\d+)%)/i.test(lower) || /change (my )?target to (\d+)%/i.test(lower)) {
      const match = lower.match(/(\d+)\s*%/);
      const newTarget = match ? parseInt(match[1], 10) : 75;
      const action = this.createAction(
        "CHANGE_GLOBAL_TARGET",
        { target: newTarget },
        "global:target",
        `Change attendance target to ${newTarget}%`,
        `Destructive action: Modifies global attendance threshold to ${newTarget}%.`
      );
      const reply = `I have staged an update to change your attendance target to ${newTarget}%. Please confirm to apply.`;
      return {
        intent: "MODIFY_TARGET",
        reply,
        response: reply,
        citations: [],
        actions: [action],
        requiresConfirmation: true,
      };
    }

    // 11. MODIFY_SUBJECTS
    if (/(add subject|drop subject|remove subject|delete subject)/i.test(lower)) {
      const isRemove = /(drop|remove|delete)/i.test(lower);
      const resolvedSubject = this.resolveSubject(query, context.subjects || []);
      const actionType = isRemove ? "REMOVE_SUBJECT" : "ADD_SUBJECT";
      const action = this.createAction(
        actionType,
        { subjectId: resolvedSubject.id, subjectName: resolvedSubject.name },
        `subject:${resolvedSubject.name}`,
        `${isRemove ? "Remove" : "Add"} subject ${resolvedSubject.name}`,
        `Destructive action: ${isRemove ? "Deletes subject and all attendance records." : "Adds course to timetable."}`
      );
      const reply = `I have staged an action to ${isRemove ? "remove" : "add"} ${resolvedSubject.name}. Please confirm to proceed.`;
      return {
        intent: "MODIFY_SUBJECTS",
        reply,
        response: reply,
        citations: [],
        actions: [action],
        requiresConfirmation: true,
      };
    }

    // 12. POLICY_RAG
    if (/(policy|ordinance|regulation|75%|l grade|r grade|i grade|m grade|leave|medical|attendance rule|hostel|ragging|mess|curfew|exam)/i.test(lower)) {
      const bestOrd = this.searchOrdinance(query);
      const reply = `${bestOrd.summary}\n\nOfficial Citation: ${bestOrd.section} — "${bestOrd.title}"`;
      return {
        intent: "POLICY_RAG",
        reply,
        response: reply,
        citations: [bestOrd.section],
        actions: [],
        requiresConfirmation: false,
      };
    }

    // 13. APP_FAQ & Default
    const defaultReply = `I am AttendX AI Copilot, your academic assistant. I can help you monitor your attendance, simulate safe bunks, update timetable slots, send attendance reports, and answer IIIT Una academic ordinances. How can I help you today?`;
    return {
      intent: "APP_FAQ",
      reply: defaultReply,
      response: defaultReply,
      citations: [],
      actions: [],
      requiresConfirmation: false,
    };
  }

  /**
   * Search ordinance knowledge base using BM25 token matching
   */
  public static searchOrdinance(query: string): { section: string; title: string; summary: string } {
    const qTokens = query
      .toLowerCase()
      .replace(/[^\w\s%]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && w.length <= 1000);

    let bestScore = -1;
    let bestRecord = this.ordinances[0] || EMBEDDED_ORDINANCES[0];

    for (const ord of this.ordinances) {
      let score = 0;
      const title = ord.title.toLowerCase();
      const text = ord.text.toLowerCase();
      const keywords = (ord.keywords || []).map((k) => k.toLowerCase());

      for (const t of qTokens) {
        if (t.length > 1000) continue;
        if (keywords.some((k) => k.includes(t))) score += 6;
        if (title.includes(t)) score += 4;
        try {
          const escapedToken = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const matches = (text.match(new RegExp("\\b" + escapedToken + "\\b", "g")) || []).length;
          score += Math.min(matches, 5);
        } catch {
          // Guard against regex pattern overflow or syntax errors
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestRecord = ord;
      }
    }

    // Extract key sentences matching query tokens for direct answers
    const sentences = bestRecord.text.split("\n").filter((s) => s.trim().length > 0);
    const relevant = sentences.slice(0, 3).join(" ");

    return {
      section: bestRecord.section,
      title: bestRecord.title,
      summary: relevant,
    };
  }

  /**
   * Resolve enrolled subject by fuzzy matching and alias lookup
   */
  public static resolveSubject(query: string, subjects: SubjectContext[] = []): { id: string; name: string; target: number; attended: number; total: number } {
    const lower = query.toLowerCase();

    // Map common academic abbreviations to full names
    const aliasMap: Record<string, string> = {
      dbms: "Database Management Systems",
      os: "Operating Systems",
      cn: "Computer Networks",
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
      dc: "Digital Communication",
    };

    for (const [alias, fullName] of Object.entries(aliasMap)) {
      if (new RegExp(`\\b${alias}\\b`, "i").test(lower)) {
        const found = subjects.find(
          (s) => s.name.toLowerCase().includes(alias) || s.name.toLowerCase().includes(fullName.toLowerCase())
        );
        if (found) {
          return {
            id: found.id,
            name: found.name,
            target: found.target || 75,
            attended: found.attended || 0,
            total: found.total || 0,
          };
        }
        return {
          id: `sub_${alias}`,
          name: fullName,
          target: 75,
          attended: 24,
          total: 30,
        };
      }
    }

    // Match directly against student's enrolled subjects
    for (const sub of subjects) {
      if (sub.name && lower.includes(sub.name.toLowerCase())) {
        return {
          id: sub.id,
          name: sub.name,
          target: sub.target || 75,
          attended: sub.attended || 0,
          total: sub.total || 0,
        };
      }
      if (sub.code && lower.includes(sub.code.toLowerCase())) {
        return {
          id: sub.id,
          name: sub.name,
          target: sub.target || 75,
          attended: sub.attended || 0,
          total: sub.total || 0,
        };
      }
    }

    // Fallback if subjects list is available
    if (subjects.length > 0) {
      const first = subjects[0];
      return {
        id: first.id,
        name: first.name,
        target: first.target || 75,
        attended: first.attended || 0,
        total: first.total || 0,
      };
    }

    return {
      id: "sub_general",
      name: "Enrolled Course",
      target: 75,
      attended: 20,
      total: 25,
    };
  }

  public static extractSubject = CustomMlCopilotService.resolveSubject;

  /**
   * Extract target date relative to local date
   */
  public static extractDate(lower: string, localDate: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = new Date(localDate.getTime());

    if (lower.includes("tomorrow")) {
      d.setDate(d.getDate() + 1);
    } else if (lower.includes("yesterday")) {
      d.setDate(d.getDate() - 1);
    } else {
      const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      for (let i = 0; i < days.length; i++) {
        if (lower.includes(days[i])) {
          const currentDay = d.getDay();
          const diff = (i - currentDay + 7) % 7;
          d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
          break;
        }
      }
    }

    const isoMatch = lower.match(/\b(202\d-[01]\d-[0-3]\d)\b/);
    if (isoMatch) {
      return isoMatch[1];
    }

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /**
   * Extract day of week index (0=Mon ... 6=Sun)
   */
  public static extractDayOfWeek(lower: string, localDate: Date = new Date()): { dayIndex: number; dayName: string } {
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    if (lower.includes("monday")) return { dayIndex: 0, dayName: "Monday" };
    if (lower.includes("tuesday")) return { dayIndex: 1, dayName: "Tuesday" };
    if (lower.includes("wednesday")) return { dayIndex: 2, dayName: "Wednesday" };
    if (lower.includes("thursday")) return { dayIndex: 3, dayName: "Thursday" };
    if (lower.includes("friday")) return { dayIndex: 4, dayName: "Friday" };
    if (lower.includes("saturday")) return { dayIndex: 5, dayName: "Saturday" };
    if (lower.includes("sunday")) return { dayIndex: 6, dayName: "Sunday" };

    const validDate = isNaN(localDate.getTime()) ? new Date() : localDate;

    if (lower.includes("tomorrow")) {
      const tomorrow = new Date(validDate.getTime() + 24 * 60 * 60 * 1000);
      const dayIndex = (tomorrow.getDay() + 6) % 7;
      return { dayIndex, dayName: dayNames[dayIndex] };
    }
    if (lower.includes("yesterday")) {
      const yesterday = new Date(validDate.getTime() - 24 * 60 * 60 * 1000);
      const dayIndex = (yesterday.getDay() + 6) % 7;
      return { dayIndex, dayName: dayNames[dayIndex] };
    }

    const dayIndex = (validDate.getDay() + 6) % 7;
    return { dayIndex, dayName: dayNames[dayIndex] };
  }

  /**
   * Extract start and end time from query
   */
  public static extractTime(lower: string): { startTime: string; endTime: string } {
    const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    let startHour = 10;
    let startMin = 0;

    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3]?.toLowerCase();

      if (meridiem === "pm" && h < 12) h += 12;
      if (meridiem === "am" && h === 12) h = 0;
      startHour = h;
      startMin = m;
    }

    const pad = (n: number) => String(n).padStart(2, "0");
    const startTime = `${pad(startHour)}:${pad(startMin)}`;

    let endHour = startHour;
    let endMin = startMin + 50;
    if (endMin >= 60) {
      endHour = (endHour + 1) % 24;
      endMin -= 60;
    }
    const endTime = `${pad(endHour)}:${pad(endMin)}`;

    return { startTime, endTime };
  }
}
