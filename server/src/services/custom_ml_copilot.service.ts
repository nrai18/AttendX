import path from "path";
import fs from "fs";
import { AIManager } from "../utils/ai_manager";
import { EmailService } from "./email.service";
import { AttendanceService } from "./attendance.service";
import { prisma } from "../lib/prisma";

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
  | "ADD_EXTRA_CLASS"
  | "ADD_TIMETABLE_SLOT"
  | "REMOVE_TIMETABLE_SLOT"
  | "SWAP_TIMETABLE_DAYS"
  | "SHIFT_TIMETABLE_DAY"
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
  CHANGE_SUMMARY_TIME: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },
  CHANGE_CLASS_REMINDER_OFFSET: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },
  UPDATE_TIMETABLE_ALERTS: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },
  MARK_ATTENDANCE: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },
  TRIGGER_REPORT: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },
  SUBMIT_FEEDBACK: { category: "SAFE" as const, isDestructive: false, requiresConfirmation: false },

  // Destructive Actions (Tier 2)
  REMOVE_SUBJECT: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  UPDATE_SUBJECT: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  DROP_SUBJECT_FROM_TIMETABLE: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  REMOVE_ATTENDANCE: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  MARK_FULL_DAY_OFF: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  ADD_EXTRA_CLASS: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  ADD_TIMETABLE_SLOT: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  REMOVE_TIMETABLE_SLOT: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  SWAP_TIMETABLE_DAYS: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  SHIFT_TIMETABLE_DAY: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  SHIFT_TIMETABLE_SLOT: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  ADD_SUBJECT: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  CHANGE_TARGET: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  CHANGE_GLOBAL_TARGET: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  ADD_ASSIGNMENT: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  MARK_ASSIGNMENT_COMPLETED: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
  DELETE_ASSIGNMENT: { category: "DESTRUCTIVE" as const, isDestructive: true, requiresConfirmation: true },
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
  semesterProjection?: {
    skipCountPerSubject: number;
    endDate: string;
    subjects: {
      subjectId: string;
      subjectName: string;
      remainingClasses: number;
      projectedPercentage: number;
      targetPercentage: number;
    }[];
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
  remainingClasses?: number;
}

export interface CopilotContext {
  userId?: string;
  userName?: string;
  userEmail?: string;
  userBirthday?: string;
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
  timetable_slots?: any[];
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
   * Pre-computes a compact, O(1) General Context digest from the raw CopilotContext
   */
  public static buildGeneralContext(context: CopilotContext) {
    const now = context.localTime ? new Date(context.localTime) : new Date();
    const validNow = isNaN(now.getTime()) ? new Date() : now;
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayIso = `${validNow.getFullYear()}-${pad(validNow.getMonth() + 1)}-${pad(validNow.getDate())}`;
    const todayDayIndex = (validNow.getDay() + 6) % 7; // 0=Mon ... 6=Sun
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    const globalTarget = Number(context.targetPercentage ?? 75);
    const totalAttended = Number(context.totalAttended ?? 0);
    const totalClasses = Number(context.totalClasses ?? 0);
    const overallPct =
      context.overallPercentage !== undefined
        ? Number(context.overallPercentage)
        : totalClasses > 0
        ? (totalAttended / totalClasses) * 100
        : 100;

    const pGlobal = globalTarget / 100;
    const overallSafeBunks =
      totalClasses > 0 && pGlobal > 0
        ? Math.max(0, Math.floor((totalAttended - pGlobal * totalClasses) / pGlobal))
        : 0;
    const overallNeeded =
      totalClasses > 0 && pGlobal < 1
        ? Math.max(0, Math.ceil((pGlobal * totalClasses - totalAttended) / (1 - pGlobal)))
        : 0;

    const subjectsDigest = (context.subjects || []).map((s: any) => {
      const att = Number(s.attended || 0);
      const tot = Number(s.total || 0);
      const tgt = Number(s.target ?? globalTarget);
      const pct = s.percentage !== undefined ? Number(s.percentage) : tot > 0 ? (att / tot) * 100 : 100;
      const p = tgt / 100;
      const safeBunksLeft = tot > 0 && p > 0 ? Math.max(0, Math.floor((att - p * tot) / p)) : 0;
      const classesNeededForTarget = tot > 0 && p < 1 ? Math.max(0, Math.ceil((p * tot - att) / (1 - p))) : 0;
      return {

        id: s.id,
        name: s.name,
        code: s.code || "",
        attended: att,
        total: tot,
        pct,
        target: tgt,
        safeBunksLeft,
        classesNeededForTarget,
        remainingClasses: Number(s.remainingClasses || 0),
      };
    });

    const subjectNameById: Record<string, string> = {};
    for (const s of subjectsDigest) {
      subjectNameById[s.id] = s.name;
    }

    const weekdaySubjectMatrix: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    const slots = Array.isArray(context.timetable_slots) ? context.timetable_slots : [];
    for (const slot of slots) {
      const dIdx = Number(slot.dayOfWeek);
      if (dIdx >= 0 && dIdx <= 6 && slot.subjectId) {
        weekdaySubjectMatrix[dIdx].push(slot.subjectId);
      }
    }

    const todayClasses = slots
      .filter((slot: any) => Number(slot.dayOfWeek) === todayDayIndex)
      .sort((a: any, b: any) => String(a.startTime || "").localeCompare(String(b.startTime || "")))
      .map((slot: any) => ({
        startTime: slot.startTime || "09:00",
        endTime: slot.endTime || "09:50",
        subjectId: slot.subjectId,
        subjectName: slot.subject?.name || subjectNameById[slot.subjectId] || "Scheduled Class",
        room: slot.room || "TBD",
        slotType: slot.type || slot.slotType || "Lecture",
      }));

    const currentHHMM = `${pad(validNow.getHours())}:${pad(validNow.getMinutes())}`;
    let nextUpcomingClass: { subjectName: string; dayName: string; startTime: string; endTime: string; room: string } | null = null;

    const remainingToday = todayClasses.filter((c) => c.startTime >= currentHHMM);
    if (remainingToday.length > 0) {
      const next = remainingToday[0];
      nextUpcomingClass = {
        subjectName: next.subjectName,
        dayName: "Today",
        startTime: next.startTime,
        endTime: next.endTime,
        room: next.room,
      };
    } else {
      for (let offset = 1; offset <= 7; offset++) {
        const checkDay = (todayDayIndex + offset) % 7;
        const daySlots = slots
          .filter((slot: any) => Number(slot.dayOfWeek) === checkDay)
          .sort((a: any, b: any) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
        if (daySlots.length > 0) {
          const first = daySlots[0];
          nextUpcomingClass = {
            subjectName: first.subject?.name || subjectNameById[first.subjectId] || "Scheduled Class",
            dayName: offset === 1 ? `Tomorrow (${dayNames[checkDay]})` : dayNames[checkDay],
            startTime: first.startTime || "09:00",
            endTime: first.endTime || "09:50",
            room: first.room || "TBD",
          };
          break;
        }
      }
    }

    const todayMidnight = new Date(validNow.getFullYear(), validNow.getMonth(), validNow.getDate()).getTime();
    const nextUpcomingEvents = (Array.isArray(context.calendarEvents) ? context.calendarEvents : [])
      .map((e: any) => {
        const rawStart = e.date || e.startDate;
        const rawEnd = e.endDate || rawStart;
        const dStr = rawStart ? String(rawStart).split("T")[0] : "";
        const endStr = rawEnd ? String(rawEnd).split("T")[0] : dStr;
        const startObj = dStr ? new Date(`${dStr}T00:00:00`) : new Date(NaN);
        const endObj = endStr ? new Date(`${endStr}T23:59:59`) : startObj;
        const daysUntil = !isNaN(startObj.getTime())
          ? Math.max(0, Math.round((startObj.getTime() - todayMidnight) / (1000 * 60 * 60 * 24)))
          : 999;
        return {

          title: e.title || e.name || e.eventName || "Academic Event",
          date: dStr,
          endDate: endStr !== dStr ? endStr : undefined,
          daysUntil,
          endMs: !isNaN(endObj.getTime()) ? endObj.getTime() : 0,
          eventType: String(e.eventType || e.event_type || "other").toLowerCase(),
        };
      })
      .filter((e) => e.date && e.endMs >= todayMidnight)
      .sort((a, b) => a.date.localeCompare(b.date));

    return {

      todayIso,
      todayDayName: dayNames[todayDayIndex],
      userName: context.userName || "Student",
      userEmail: context.userEmail || "",
      overall: {
        attended: totalAttended,
        total: totalClasses,
        percentage: overallPct,
        target: globalTarget,
        safeBunksLeft: overallSafeBunks,
        classesNeededForTarget: overallNeeded,
        status: overallPct >= globalTarget ? "Safe" : overallPct >= globalTarget - 5 ? "Warning" : "Danger",
      },
      subjects: subjectsDigest,
      todayClasses,
      nextUpcomingClass,
      nextUpcomingEvents,
      weekdaySubjectMatrix,
    };
  }

  /**
   * Fast batch attendance report builder + background email dispatcher (< 80ms)
   * Eliminates the 30-day sequential getTodayAgenda DB loop!
   */
  public static async dispatchFastReport(
    reportType: string,
    reportTitle: string,
    context: CopilotContext,
    customStartDate?: string,
    customEndDate?: string
  ): Promise<{ reply: string; action: ActionPayload }> {
    let userEmail = context.userEmail || "";
    let userName = context.userName || "Student";
    let classesAttended = 0;
    let classesMissed = 0;
    let classesOff = 0;
    let totalClasses = 0;
    const dailySummaries: { date: string; summary: string; remarks?: string[]; events?: string[]; eventObjects?: any[] }[] = [];

    const endDate = customEndDate ? new Date(customEndDate) : new Date();
    const startDate = customStartDate ? new Date(customStartDate) : new Date();
    if (!customStartDate) {
      if (reportType === "monthly") startDate.setDate(startDate.getDate() - 30);
      else if (reportType === "semester" && context.startDate) startDate.setTime(new Date(context.startDate).getTime());
      else if (reportType === "custom") startDate.setDate(startDate.getDate() - 30);
      else startDate.setDate(startDate.getDate() - 7);
    }

    const formattedStartDate = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const formattedEndDate = endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    if (context.userId) {
      try {
        const [user, recentLogs] = await Promise.all([
          !userEmail
            ? prisma.user.findUnique({ where: { id: context.userId }, select: { email: true, name: true } })
            : Promise.resolve({ email: userEmail, name: userName }),
          prisma.attendance.findMany({
            where: {
              userId: context.userId,
              date: { gte: startDate, lte: endDate },
              ...(context.activeSemesterId ? { subject: { semesterId: context.activeSemesterId } } : {}),
            },
            include: { subject: { select: { name: true } } },
            orderBy: { date: "asc" },
          }),
        ]);

        if (user) {
          userEmail = user.email || userEmail;
          userName = user.name || userName;
        }

        classesAttended = recentLogs.filter((l) => ["present", "medical", "od"].includes(l.status)).length;
        classesMissed = recentLogs.filter((l) => l.status === "absent").length;
        classesOff = recentLogs.filter((l) => ["off", "cancelled"].includes(l.status)).length;
        totalClasses = classesAttended + classesMissed;

        // Group logs by YYYY-MM-DD in O(N) memory instead of 30 sequential DB calls
        const logsByDate = new Map<string, any[]>();
        for (const log of recentLogs) {
          const dIso = log.date instanceof Date ? log.date.toISOString().split("T")[0] : String(log.date).split("T")[0];
          const list = logsByDate.get(dIso) || [];
          list.push(log);
          logsByDate.set(dIso, list);
        }

        const currDate = new Date(startDate);
        currDate.setHours(0, 0, 0, 0);
        const endObj = new Date(endDate);
        endObj.setHours(23, 59, 59, 999);
        const pad = (n: number) => String(n).padStart(2, "0");

        while (currDate <= endObj) {
          const dateIso = `${currDate.getFullYear()}-${pad(currDate.getMonth() + 1)}-${pad(currDate.getDate())}`;
          const dayLogs = logsByDate.get(dateIso) || [];
          const activeEvents = (context.calendarEvents || []).filter((e: any) => {
            const rawStart = e.startDate || e.date;
            if (!rawStart) return false;
            const eStart = new Date(rawStart);
            if (isNaN(eStart.getTime())) return false;
            eStart.setHours(0, 0, 0, 0);
            const eEnd = e.endDate ? new Date(e.endDate) : new Date(eStart);
            eEnd.setHours(23, 59, 59, 999);
            return currDate >= eStart && currDate <= eEnd;
          });

          if (dayLogs.length > 0 || activeEvents.length > 0) {
            let present = 0;
            let absent = 0;
            let off = 0;
            const remarksSet = new Set<string>();
            const eventsSet = new Set<string>();
            const eventObjects: { title: string; eventType: string }[] = [];
            const absentSubjects: string[] = [];

            for (const item of dayLogs) {
              const s = item.status;
              if (["present", "medical", "od"].includes(s)) present++;
              else if (s === "absent") {
                absent++;
                if (item.subject?.name) absentSubjects.push(item.subject.name);
              } else if (["off", "cancelled"].includes(s)) off++;

              if (item.remarks && item.remarks.trim() && item.remarks !== "Previous Timetable / Extra Class") {
                remarksSet.add(item.remarks.trim());
              }
            }

            for (const e of activeEvents) {
              const title = e.title || e.name || "Event";
              eventsSet.add(title);
              eventObjects.push({ title, eventType: e.eventType || e.event_type || "other" });
            }

            const parts: string[] = [];
            if (present > 0) parts.push(`${present} present`);
            if (absent > 0) parts.push(`${absent} absent${absentSubjects.length > 0 ? ` (${absentSubjects.join(", ")})` : ""}`);
            if (off > 0) parts.push(`${off} off`);

            const summary = parts.length > 0 ? parts.join(", ") : eventObjects.length > 0 ? "No classes" : "No activity";
            const dateStr = currDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            dailySummaries.push({
              date: dateStr,
              summary,
              remarks: Array.from(remarksSet),
              events: Array.from(eventsSet),
              eventObjects,
            });
          }
          currDate.setDate(currDate.getDate() + 1);
        }
      } catch (dbErr) {
        console.error("[CustomMlCopilotService] Fast report batch query failed:", dbErr);
      }
    }

    const stats = {
      overallPercentage: context.overallPercentage ?? 100,
      attended: classesAttended,
      missed: classesMissed,
      off: classesOff,
      total: totalClasses,
      dailySummaries,
      dateRange: `${formattedStartDate} - ${formattedEndDate}`,
      subjects: context.subjects || [],
    };

    let reply = "";
    if (!userEmail) {
      reply = `I've prepared your ${reportType} attendance summary (${formattedStartDate} – ${formattedEndDate}), but no email address is linked to your profile. Please add your email in Settings > Edit Profile!`;
    } else {
      reply = `Generating and emailing your ${reportType} attendance report (${formattedStartDate} – ${formattedEndDate}) to ${userEmail} right now! Check your inbox in a few moments.`;
      // Non-blocking background email dispatch so the user gets an instant (< 80ms) response
      Promise.resolve()
        .then(async () => {
          if (reportType === "monthly") {
            return await EmailService.sendMonthlyReport(userEmail, userName, stats);
          } else if (reportType === "weekly") {
            return await EmailService.sendWeeklyReport(userEmail, userName, stats);
          } else {
            return await EmailService.sendCustomReport(userEmail, userName, stats, reportTitle);
          }
        })
        .then((mailRes) => {
          console.info(`[AIChat:FastReport] Background email dispatch to "${userEmail}":`, {
            success: mailRes?.success,
            id: mailRes?.data?.id,
          });
        })
        .catch((err) => {
          console.error(`[AIChat:FastReport] Background email error for "${userEmail}":`, err?.message || err);
        });
    }

    const action = this.createAction(
      "TRIGGER_REPORT",
      { email: userEmail, stats, type: reportType },
      userEmail ? `email:${userEmail}` : "user:report",
      `Send ${reportType} attendance report to ${userEmail || "registered email"}`,
      `Safe action: Dispatches ${reportType} attendance report email.`
    );

    return {
 reply, action };
  }

  /**
   * Tier 1 & Tier 2 Fast-Path Router (< 15ms deterministic local execution, 0 Gemini tokens)
   * Returns null if the query requires Tier 3 (Gemini 3.7/3.8 Flash).
   */
  public static async tryFastPath(
    query: string,
    context: CopilotContext,
    generalCtx: ReturnType<typeof CustomMlCopilotService.buildGeneralContext>
  ): Promise<CopilotResponse | null> {
    const trimmed = query.trim();
    const lower = trimmed.toLowerCase().replace(/[?!.]+$/g, "").trim();
    const localDate = context.localTime ? new Date(context.localTime) : new Date();

    // 1. GREETINGS & SMALL TALK
    // Updated greeting pattern to allow repeated greetings (e.g., "hello hello") and capture small‑talk variations.
    const greetingPattern =
      /^(?:\s*(hi+|he+y+|hello+|hey|heya|howdy|sup|yo|namaste|greetings|good\s+(morning|afternoon|evening|day|night))\s*){1,3}$/i;

    if (greetingPattern.test(lower)) {
      const { userName, overall, nextUpcomingClass } = generalCtx;
      let reply = `Hey ${userName}! Your overall attendance is **${overall.percentage.toFixed(1)}%** (${overall.attended}/${overall.total} classes — **${overall.status}** vs your ${overall.target}% target).`;
      if (nextUpcomingClass) {
        reply += ` Your next class is **${nextUpcomingClass.subjectName}** (${nextUpcomingClass.dayName} at ${nextUpcomingClass.startTime}).`;
      }
      reply += ` How can I help you today?`;

      if (/\b(who (made|created|built|developed) (you|u))\b/i.test(lower)) {
        reply = `I am AttendX AI Copilot, created and engineered by **Naman Rai** as your intelligent academic companion and policy advisor for IIIT Una.`;
      } else if (/\b(what can you do|help)\b/i.test(lower)) {
        reply = `I can instantly check your attendance & safe bunks, simulate leaves, switch light/dark themes, navigate across the app, tell you your next class or upcoming holiday, swap timetable slots, and email your weekly or monthly attendance reports!`;
      } else if (/^(thank|thx)/i.test(lower)) {
        reply = `You're welcome, ${userName}! Let me know anytime you need help with your attendance or schedule.`;
      } else if (/^(bye|goodbye|see)/i.test(lower)) {
        reply = `See you later, ${userName}! Stay on top of your ${overall.target}% attendance goal!`;
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

    // 1b. SMALL‑TALK (how are you, what's up, etc.)
    const smallTalkPattern = /\b(how\s+are\s+you|what('?s)?\s+up|whats\s+up)\b/i;
    if (smallTalkPattern.test(lower)) {
      const { userName } = generalCtx;
      const reply = `I'm doing well, ${userName}! How can I help you with your attendance, timetable, or anything else?`;
      return {

        intent: "CHIT_CHAT",
        reply,
        response: reply,
        citations: [],
        actions: [],
        requiresConfirmation: false,
      };
    }
    // 2. THEME SWITCHING (Light / Dark / System Mode)
    const themeMatch = lower.match(
      /^(?:please\s+)?(?:switch|change|set|turn|enable|toggle|go|use)?\s*(?:to\s+|on\s+)?(dark|light|system)\s*(?:mode|theme)?$/i
    ) || lower.match(/\b(?:switch|change|set|turn)\s+(?:the\s+)?(?:app\s+)?(?:theme|mode)\s+to\s+(dark|light|system)\b/i);
    if (themeMatch) {
      const theme = themeMatch[1].toLowerCase() as "dark" | "light" | "system";
      const action = this.createAction(
        "SWITCH_THEME",
        { theme },
        "theme:ui",
        `Switch app theme to ${theme} mode`,
        "Safe action: Updates visual theme immediately."
      );
      const reply = `Switched your app appearance to **${theme} mode**.`;
      return {

        intent: "UPDATE_SETTINGS",
        reply,
        response: reply,
        citations: [],
        actions: [action],
        requiresConfirmation: false,
      };
    }

    // 3. APP NAVIGATION (Direct Screen Jumps)
    const navMatch = lower.match(
      /^(?:please\s+)?(?:navigate(?:\s+to)?|open(?:\s+up)?|go\s+to|take\s+me\s+to|show(?:\s+me)?(?:\s+my)?|view(?:\s+my)?)\s+(?:the\s+)?(timetable|schedule|routine|settings|preferences|reports?|analytics|calendar|forecast|predictive|prediction|today(?:'s\s+agenda)?|agenda|dashboard|subjects?|courses?|assignments?|tasks?|semester(?:\s+overview|\s+hub)?|overview|timeline|holidays?|countdowns?|events?|profile|edit\s+profile|linked\s+devices|devices|sessions|peer\s+sync|changelog|update\s+history|feedback|contact(?:\s+us)?|faq|classrooms?)(?:\s+page|\s+screen|\s+tab|\s+view)?$/i
    );
    if (navMatch) {
      const targetKey = navMatch[1].toLowerCase();
      let path = "/today";
      let title = "Today's Agenda";

      if (/(timetable|schedule|routine)/.test(targetKey)) { path = "/timetable"; title = "Timetable"; }
      else if (/(edit\s+profile|profile)/.test(targetKey)) { path = "/settings/profile"; title = "Edit Profile"; }
      else if (/(device|devices|sessions)/.test(targetKey)) { path = "/settings/devices"; title = "Linked Devices"; }
      else if (/(peer\s+sync)/.test(targetKey)) { path = "/settings/peer-sync"; title = "Peer Sync"; }
      else if (/(contact)/.test(targetKey)) { path = "/settings/contact"; title = "Contact Us"; }
      else if (/(feedback)/.test(targetKey)) { path = "/settings/feedback"; title = "Send Feedback"; }
      else if (/(changelog|update\s+history)/.test(targetKey)) { path = "/settings/changelog"; title = "Update History"; }
      else if (/(faq)/.test(targetKey)) { path = "/settings/faq"; title = "FAQ"; }
      else if (/(setting|preferences)/.test(targetKey)) { path = "/settings"; title = "Settings"; }
      else if (/(report|analytics)/.test(targetKey)) { path = "/report"; title = "Analytics Reports"; }
      else if (/(forecast|predictive|prediction)/.test(targetKey)) { path = "/predictive"; title = "Forecast Engine"; }
      else if (/(holiday)/.test(targetKey)) { path = "/semester/holidays"; title = "Semester Holidays"; }
      else if (/(countdown)/.test(targetKey)) { path = "/semester/countdowns"; title = "Semester Countdowns"; }
      else if (/^events?$/.test(targetKey)) { path = "/semester/events"; title = "Semester Events"; }
      else if (/(semester|overview|timeline)/.test(targetKey)) { path = "/semester"; title = "Semester Overview"; }
      else if (/(calendar)/.test(targetKey)) { path = "/calendar"; title = "Calendar"; }
      else if (/(subject|course)/.test(targetKey)) { path = "/subjects"; title = "Subjects"; }
      else if (/(assignment|task)/.test(targetKey)) { path = "/assignments"; title = "Assignments"; }
      else if (/(classroom)/.test(targetKey)) { path = "/classrooms"; title = "Classrooms"; }

      const reply = `Opening **${title}**.`;
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

    // 4. WEEKLY / MONTHLY / SEMESTER ATTENDANCE REPORTS (Tier 2 Fast Batch)
    //    One deterministic rule for every phrasing ("send me weekly reports", "email my monthly report", "send me report"):
    //    - time/day given ("in 5 minutes", "at 9am on friday", "every monday")  -> schedule it, open Settings
    //    - nothing given                                                          -> email one now, never touch Settings
    const wallNow = this.toWallClock(context.localTime);
    const hasReportWord = /\b(reports?|summar(?:y|ies)|digests?|attendance\s+records?)\b/i.test(lower);
    const hasStrongVerb = /\b(send|email|mail|dispatch|generate|forward)\b/i.test(lower);
    const hasWeakVerb = /\b(schedule|set|remind|notify|give|get|want|need|enable|start|turn on)\b/i.test(lower);
    const hasPeriod = /\b(daily|weekly|monthly|semester|attendance)\b/i.test(lower);
    const hasRecurringPeriod = /\b(daily|weekly|monthly)\b/i.test(lower);
    if (
      (hasStrongVerb && (hasReportWord || /\b(attendance|report)\b/i.test(lower))) ||
      (hasReportWord && hasPeriod) ||
      (hasReportWord && hasWeakVerb && hasRecurringPeriod) ||
      /\b(weekly|monthly|semester)\s+attendance\s+(report|records?|email)\b/i.test(lower) ||
      /\b(email|mail)\s+(me\s+)?(my\s+)?(weekly|monthly|attendance)\b/i.test(lower)
    ) {
      const schedule = this.parseReportSchedule(lower, wallNow);
      if (schedule) {
        return {
          intent: "UPDATE_SETTINGS",
          reply: schedule.reply,
          response: schedule.reply,
          citations: [],
          actions: schedule.actions,
          requiresConfirmation: false,
        };
      }

      let reportType = "weekly";
      if (/\b(monthly|month)\b/i.test(lower)) reportType = "monthly";
      else if (/\b(semester|term)\b/i.test(lower)) reportType = "semester";
      const reportTitle = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Attendance Report`;

      const { reply, action } = await this.dispatchFastReport(reportType, reportTitle, context);
      const tip =
        reportType === "semester"
          ? ""
          : `\n\nWant this automatically? Tell me when, e.g. "send me the ${reportType} report every ${reportType === "monthly" ? "month on the 1st at 9 am" : "Monday at 9 am"}" or "in 5 minutes".`;
      return {
        intent: "TRIGGER_REPORT",
        reply: reply + tip,
        response: reply + tip,
        citations: [],
        actions: [action],
        requiresConfirmation: false,
      };
    }

    // 5. NEXT UPCOMING EVENT / HOLIDAY / EXAM / NEXT CLASS / TODAY'S SCHEDULE
    if (
      /^(what('s|\s+is)\s+(my\s+)?)?(next|upcoming)\s+(event|events|holiday|vacation|break|exam|midsem|endsem|milestone|festival|fest)s?$/i.test(lower) ||
      /\b(when\s+is\s+(the\s+)?next\s+(event|holiday|exam|break|vacation)|tell\s+me\s+(the\s+)?next\s+upcoming\s+event|upcoming\s+events?|next\s+holiday)\b/i.test(lower)
    ) {
      const wantsHoliday = /\b(holiday|vacation|break)\b/i.test(lower);
      const wantsExam = /\b(exam|midsem|endsem|ct|quiz|test)\b/i.test(lower);
      const filtered = generalCtx.nextUpcomingEvents.filter((e) => {
        if (wantsHoliday) return e.eventType.includes("holiday") || e.eventType.includes("vacation") || /holiday|vacation|jayanti|diwali|holi/i.test(e.title);
        if (wantsExam) return e.eventType.includes("exam") || e.eventType.includes("sem") || e.eventType.includes("ct") || /exam|mid|end|test|quiz/i.test(e.title);
        return true;
      });
      const list = filtered.length > 0 ? filtered : generalCtx.nextUpcomingEvents;

      if (list.length === 0) {
        const reply = `You don't have any upcoming events or holidays recorded in your active semester calendar yet.`;
        return {

          intent: "TIMETABLE_QUERY",
          reply,
          response: reply,
          citations: [],
          actions: [],
          requiresConfirmation: false,
        };
      }

      const top = list[0];
      const countdownText = top.daysUntil === 0 ? "today" : top.daysUntil === 1 ? "tomorrow (in 1 day)" : `in **${top.daysUntil} days**`;
      const moreList = list
        .slice(1, 4)
        .map((e) => `• **${e.title}** — ${e.date}${e.endDate ? ` to ${e.endDate}` : ""} (${e.daysUntil === 0 ? "Today" : `in ${e.daysUntil}d`})`)
        .join("\n");

      const reply = `Your next upcoming ${wantsHoliday ? "holiday" : wantsExam ? "exam" : "event"} is **${top.title}** on **${top.date}${top.endDate ? ` – ${top.endDate}` : ""}** (${countdownText}).${moreList ? `\n\n**Following up:**\n${moreList}` : ""}`;
      return {

        intent: "TIMETABLE_QUERY",
        reply,
        response: reply,
        citations: [],
        actions: [],
        requiresConfirmation: false,
      };
    }

    if (
      /^(what('s|\s+is)\s+(my\s+)?)?(next\s+(class|lecture|lab)|classes\s+today|my\s+(classes|schedule|timetable)\s+today|today('s)?\s+(classes|schedule|timetable|agenda))$/i.test(lower)
    ) {
      const { todayClasses, nextUpcomingClass, todayDayName } = generalCtx;
      let reply = "";
      if (/next\s+(class|lecture|lab)/i.test(lower)) {
        if (nextUpcomingClass) {
          reply = `Your next class is **${nextUpcomingClass.subjectName}** (${nextUpcomingClass.dayName}, **${nextUpcomingClass.startTime} – ${nextUpcomingClass.endTime}**${nextUpcomingClass.room && nextUpcomingClass.room !== "TBD" ? `, Room ${nextUpcomingClass.room}` : ""}).`;
        } else {
          reply = `You have no upcoming classes found in your weekly timetable.`;
        }
      } else {
        if (todayClasses.length === 0) {
          reply = `You have **no classes scheduled today (${todayDayName})**!${nextUpcomingClass ? ` Your next class is **${nextUpcomingClass.subjectName}** on ${nextUpcomingClass.dayName} at ${nextUpcomingClass.startTime}.` : ""}`;
        } else {
          const formatted = todayClasses
            .map((c) => `• **${c.startTime} – ${c.endTime}**: ${c.subjectName} (${c.slotType}${c.room && c.room !== "TBD" ? `, ${c.room}` : ""})`)
            .join("\n");
          reply = `Here is your schedule for **today (${todayDayName})** (${todayClasses.length} session${todayClasses.length !== 1 ? "s" : ""}):\n${formatted}`;
        }
      }
      return {

        intent: "TIMETABLE_QUERY",
        reply,
        response: reply,
        citations: [],
        actions: [],
        requiresConfirmation: false,
      };
    }

    // 6. CURRENT ATTENDANCE & SAFE BUNKS QUERY
    const isDirectAttendanceQuery =
      /^(what('s|\s+is)\s+(my\s+)?)?(current\s+|overall\s+|total\s+)?attendance(\s+status|\s+percentage|\s+right\s+now|\s+summary)?$/i.test(lower) ||
      /^(show(\s+me)?\s+(my\s+)?|check(\s+my)?\s+|tell(\s+me)?\s+(my\s+)?)?(current\s+|overall\s+)?attendance(\s+in\s+.+)?$/i.test(lower) ||
      /^(am\s+i\s+safe|how\s+many\s+(classes|lectures|bunks)\s+(can\s+i\s+(bunk|miss|skip)|do\s+i\s+need(\s+to\s+attend)?))(\s+in\s+.+)?$/i.test(lower);

    if (isDirectAttendanceQuery && !/\b(if\s+i|next\s+week|from\s+|between\s+|tomorrow|monday|tuesday|wednesday|thursday|friday)\b/i.test(lower)) {
      const matchedSub = generalCtx.subjects.find(
        (s) =>
          (s.name && lower.includes(s.name.toLowerCase())) ||
          (s.code && s.code.length >= 2 && new RegExp(`\\b${s.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower))
      );

      if (matchedSub) {
        const bufferMsg =
          matchedSub.pct >= matchedSub.target
            ? matchedSub.safeBunksLeft > 0
              ? `You can safely miss **${matchedSub.safeBunksLeft}** consecutive class${matchedSub.safeBunksLeft !== 1 ? "es" : ""} and stay above ${matchedSub.target}%.`
              : `You are right on the edge of ${matchedSub.target}% — missing the next class will drop you below target.`
            : `You need to attend the next **${matchedSub.classesNeededForTarget}** consecutive class${matchedSub.classesNeededForTarget !== 1 ? "es" : ""} to reach ${matchedSub.target}%.`;

        const reply = `In **${matchedSub.name}${matchedSub.code ? ` (${matchedSub.code})` : ""}**, your current attendance is **${matchedSub.pct.toFixed(1)}%** (${matchedSub.attended}/${matchedSub.total} classes, Target: ${matchedSub.target}%). ${bufferMsg}`;
        const skipCount = matchedSub.pct >= matchedSub.target ? Math.max(1, matchedSub.safeBunksLeft) : -matchedSub.classesNeededForTarget;
        const projTot = matchedSub.total + Math.abs(skipCount);
        const projAtt = skipCount < 0 ? matchedSub.attended + Math.abs(skipCount) : matchedSub.attended;
        return {

          intent: "FORECAST_SIMULATION",
          reply,
          response: reply,
          citations: [],
          actions: [],
          requiresConfirmation: false,
          simulation: {
            subjectId: matchedSub.id,
            subjectName: matchedSub.name,
            skipCount,
            currentAttended: matchedSub.attended,
            currentTotal: matchedSub.total,
            projectedPercentage: projTot > 0 ? Math.round((projAtt / projTot) * 1000) / 10 : 100,
            targetPercentage: matchedSub.target,
          },
        };
      }

      const { overall, subjects } = generalCtx;
      const overallBuffer =
        overall.percentage >= overall.target
          ? `You are **Safe** (+${(overall.percentage - overall.target).toFixed(1)}% above ${overall.target}%) with an overall buffer of **${overall.safeBunksLeft}** class${overall.safeBunksLeft !== 1 ? "es" : ""}.`
          : `You are below your ${overall.target}% target and need **${overall.classesNeededForTarget}** consecutive classes overall.`;

      const subjectLines = subjects
        .map((s) => {
          const tag =
            s.pct >= s.target
              ? s.safeBunksLeft > 0
                ? `Safe: can miss ${s.safeBunksLeft}`
                : `On edge (0 bunks)`
              : `Attend next ${s.classesNeededForTarget}`;
          return `• **${s.name}**: **${s.pct.toFixed(1)}%** (${s.attended}/${s.total}) — *${tag}*`;
        })
        .join("\n");

      const reply = `Your overall attendance is **${overall.percentage.toFixed(1)}%** (${overall.attended}/${overall.total} classes). ${overallBuffer}${subjectLines ? `\n\n**Subject Breakdown:**\n${subjectLines}` : ""}`;
      return {

        intent: "TIMETABLE_QUERY",
        reply,
        response: reply,
        citations: [],
        actions: [],
        requiresConfirmation: false,
      };
    }

    // 7. EXPLICIT SINGLE-SUBJECT SIMULATION ("what if I miss 2 classes of DBMS", "if I attend next 3 OS classes")
    const singleSimMatch = lower.match(
      /^(?:what\s+if\s+i|if\s+i|simulate)\s+(miss|skip|bunk|attend|attending)\s+(?:the\s+)?(?:next\s+)?(\d+)\s+(?:classes|lectures|sessions|labs)?\s*(?:of|in|for)?\s+(.+)$/i
    );
    if (singleSimMatch && !/\b(week|month|semester|days|monday|tuesday|wednesday|thursday|friday)\b/i.test(singleSimMatch[3])) {
      const actionVerb = singleSimMatch[1].toLowerCase();
      const count = Math.max(1, parseInt(singleSimMatch[2], 10));
      const subjectQuery = singleSimMatch[3].trim();
      const isMiss = /miss|skip|bunk/.test(actionVerb);

      const resolved = this.resolveSubject(subjectQuery, context.subjects || []);
      const subDigest = generalCtx.subjects.find((s) => s.id === resolved.id) || {
        id: resolved.id,
        name: resolved.name,
        attended: resolved.attended,
        total: resolved.total,
        pct: resolved.total > 0 ? (resolved.attended / resolved.total) * 100 : 100,
        target: resolved.target,
        safeBunksLeft: 0,
        classesNeededForTarget: 0,
      };

      const projectedTotal = subDigest.total + count;
      const projectedAttended = isMiss ? subDigest.attended : subDigest.attended + count;
      const projectedPct = projectedTotal > 0 ? (projectedAttended / projectedTotal) * 100 : 100;
      const p = subDigest.target / 100;

      let reply = "";
      if (isMiss) {
        reply = `If you miss **${count}** class${count !== 1 ? "es" : ""} of **${subDigest.name}**, your attendance moves from **${subDigest.pct.toFixed(1)}%** to **${projectedPct.toFixed(1)}%** (${projectedAttended}/${projectedTotal} classes). `;
        if (projectedPct >= subDigest.target) {
          const bunksAfter = Math.max(0, Math.floor((projectedAttended - p * projectedTotal) / p));
          reply += `You remain **safe** above your ${subDigest.target}% target with **${bunksAfter}** safe bunk${bunksAfter !== 1 ? "s" : ""} remaining.`;
        } else {
          const recoverNeeded = p < 1 ? Math.max(0, Math.ceil((p * projectedTotal - projectedAttended) / (1 - p))) : 0;
          reply += `Warning: This drops you **below your ${subDigest.target}% target**! You would need to attend **${recoverNeeded}** consecutive classes to recover.`;
        }
      } else {
        reply = `If you attend the next **${count}** class${count !== 1 ? "es" : ""} of **${subDigest.name}**, your attendance rises from **${subDigest.pct.toFixed(1)}%** to **${projectedPct.toFixed(1)}%** (${projectedAttended}/${projectedTotal} classes).`;
      }

      return {

        intent: "FORECAST_SIMULATION",
        reply,
        response: reply,
        citations: [],
        actions: [],
        requiresConfirmation: false,
        simulation: {
          subjectId: subDigest.id,
          subjectName: subDigest.name,
          skipCount: isMiss ? count : -count,
          currentAttended: subDigest.attended,
          currentTotal: subDigest.total,
          projectedPercentage: Math.round(projectedPct * 10) / 10,
          targetPercentage: subDigest.target,
        },
      };
    }

    // 8. EXPLICIT SHIFT / SWAP TIMETABLE COMMANDS (Tier 2 Deterministic Executor)
    const swapDaysMatch = lower.match(
      /\b(?:swap|exchange|switch)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:'s)?\s+(?:and|with)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:'s)?(?:\s+timetable|\s+schedule|\s+classes)?\b/i
    );
    if (swapDaysMatch) {
      const dayMap: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
      const dayAName = swapDaysMatch[1].charAt(0).toUpperCase() + swapDaysMatch[1].slice(1).toLowerCase();
      const dayBName = swapDaysMatch[2].charAt(0).toUpperCase() + swapDaysMatch[2].slice(1).toLowerCase();
      const dayA = dayMap[swapDaysMatch[1].toLowerCase()];
      const dayB = dayMap[swapDaysMatch[2].toLowerCase()];

      const action = this.createAction(
        "SWAP_TIMETABLE_DAYS",
        { dayA, dayB },
        `timetable:${dayAName}<->${dayBName}`,
        `Swap ${dayAName} and ${dayBName} timetable schedules`,
        `Destructive action: Swaps all recurring weekly classes between ${dayAName} and ${dayBName}.`
      );
      const reply = `I have staged a timetable swap between **${dayAName}** and **${dayBName}**. Please confirm to apply.`;
      return {
        intent: "SWAP_TIMETABLE_DAYS",
        reply,
        response: reply,
        citations: [],
        actions: [action],
        requiresConfirmation: true,
      };
    }

    // 9. ATTENDANCE MARKING WITH REMARKS & RELATIVE DATES
    const isMarkAttendance =
      /\b(?:mark|record|log|set)\s+(?:my\s+)?(?:attendance|me\s+)?(?:as\s+)?(present|absent|medical|on\s*duty|od|off|leave)\b/i.test(lower) ||
      /\b(?:mark|record|log|set)\s+.+?\s+(?:as\s+)?(present|absent|medical|on\s*duty|od|off|leave)\b/i.test(lower) ||
      /\b(?:i\s*am\s+(?:bunking|not\s+going|taking\s+a\s+leave)|full\s+day\s+off|taking\s+(?:a\s+)?day\s+off)\b/i.test(lower);

    if (isMarkAttendance) {
      let status = "present";
      if (/\b(medical|sick|doctor)\b/i.test(lower)) status = "medical";
      else if (/\b(on\s*duty|od|duty)\b/i.test(lower)) status = "od";
      else if (/\b(absent|missed|miss|not\s+going|bunking|bunk|skip)\b/i.test(lower)) status = "absent";
      else if (/\b(off|cancelled|canceled|holiday)\b/i.test(lower)) status = "off";

      const relDate = this.resolveRelativeDate(lower, wallNow);
      let dateStr = relDate.dateStr;
      let friendlyDate = relDate.friendly;

      // Bare weekday modifier handling: if user said "Wednesday" without "next", prefer the most recent on/before today
      const hasFutureModifier = /\b(next|coming|upcoming|tomorrow)\b/i.test(lower);
      if (relDate.kind === "weekday" && !hasFutureModifier) {
        const todayStr = this.resolveRelativeDate("today", wallNow).dateStr;
        if (dateStr > todayStr) {
          const [y, m, d] = dateStr.split("-").map(Number);
          const back = new Date(Date.UTC(y, m - 1, d - 7));
          dateStr = `${back.getUTCFullYear()}-${String(back.getUTCMonth() + 1).padStart(2, "0")}-${String(back.getUTCDate()).padStart(2, "0")}`;
          const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
          const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const dayIdx = (back.getUTCDay() + 6) % 7;
          friendlyDate = `${dayNames[dayIdx]}, ${back.getUTCDate()} ${monthShort[back.getUTCMonth()]} ${back.getUTCFullYear()}`;
        }
      }

      // Remark extraction (e.g. "with remark 'Sub faculty took lecture'", "remark: fever", "reason: hospital")
      const remarkMatch =
        query.match(/(?:with\s+)?(?:remark|reason|note|comment)s?[:\s]+["']?([^"'\n\r]+)["']?/i) ||
        query.match(/(?:because|due\s+to)\s+([^,.\n\r]+)/i);
      const remarks = remarkMatch ? remarkMatch[1].trim().slice(0, 200) : undefined;

      const isFullDay = /\b(full\s+day\s+off|all\s+classes\s+off|day\s+off|holiday\s+today)\b/i.test(lower);
      if (isFullDay) {
        const action = this.createAction(
          "MARK_FULL_DAY_OFF",
          { date: dateStr, ...(remarks ? { remarks } : {}) },
          `date:${dateStr}`,
          `Mark full day off on ${friendlyDate}`,
          `Destructive action: Marks all classes on ${friendlyDate} as OFF${remarks ? ` with remark "${remarks}"` : ""}.`
        );
        const reply = `I have staged an action to mark your entire day as **OFF** on **${friendlyDate}**${remarks ? ` (Remark: "${remarks}")` : ""}. Please confirm to proceed.`;
        return {
          intent: "MARK_ATTENDANCE",
          reply,
          response: reply,
          citations: [],
          actions: [action],
          requiresConfirmation: true,
        };
      }

      const resolvedSub = this.resolveSubject(query, context.subjects || []);
      if (resolvedSub && resolvedSub.id) {
        const isDestructive = status === "absent" || status === "off";
        const action = this.createAction(
          "MARK_ATTENDANCE",
          { subjectId: resolvedSub.id, date: dateStr, status, ...(remarks ? { remarks } : {}) },
          `subject:${resolvedSub.name}`,
          `Mark ${resolvedSub.name} as ${status.toUpperCase()} on ${friendlyDate}`,
          `${isDestructive ? "Destructive" : "Safe"} action: Logs ${status.toUpperCase()} for ${resolvedSub.name}${remarks ? ` (Remark: "${remarks}")` : ""}.`
        );
        const reply = `Marked **${resolvedSub.name}** as **${status.toUpperCase()}** on **${friendlyDate}**${remarks ? ` (Remark: "${remarks}")` : ""}.`;
        return {
          intent: "MARK_ATTENDANCE",
          reply,
          response: reply,
          citations: [],
          actions: [action],
          requiresConfirmation: isDestructive,
        };
      }
    }

    // 10. USER COMPLAINTS & BUG REPORTS (SUBMIT_FEEDBACK)
    const isFeedback =
      /\b(bug|glitch|crash(?:ed|ing|es)?|broken|defect|not\s+working|not\s+updating|not\s+syncing|not\s+sending|not\s+showing|problem\s+with|issue\s+with|complaint|app\s+failed|error\s+in|froze|frozen|freeze|stuck|hang(?:ing|s)?|something\s+(?:is\s+)?wrong|disappeared|stopped\s+working)\b/i.test(lower) &&
      !/\b(how\s+do\s+i|can\s+i|what\s+is|when\s+is|ordinance|regulation|75%|policy)\b/i.test(lower);
    const isExplicitFeedback = /\b(submit\s+(?:a\s+)?(?:bug|feedback|complaint)|report\s+(?:a\s+)?(?:bug|issue|problem)|send\s+feedback|i\s+have\s+a\s+complaint|i\s+want\s+to\s+complain)\b/i.test(lower);

    if (isFeedback || isExplicitFeedback) {
      const issueSummary = query.trim().slice(0, 100);
      const userEmail = context.userEmail;
      const userName = context.userName || "Student";
      const feedbackData = {
        type: "bug",
        issue: issueSummary,
        description: query.trim(),
      };

      // 1. Non-blocking ticket creation in DB
      if (context.userId) {
        (prisma as any).feedback.create({
          data: {
            userId: context.userId,
            type: feedbackData.type,
            issue: feedbackData.issue,
            frequency: "once",
            description: feedbackData.description,
            email: userEmail || "anonymous@attendx.tech",
          },
        }).catch((dbErr: any) => console.error("[CustomMlCopilotService] Failed to store fast-path feedback in DB:", dbErr));
      }

      // 2. Non-blocking confirmation receipt email dispatch (Resend)
      if (userEmail) {
        EmailService.sendFeedbackReceipt(userEmail, userName, feedbackData).catch((mailErr: any) =>
          console.error("[CustomMlCopilotService] Failed to send feedback receipt email:", mailErr)
        );
      }

      const action = this.createAction(
        "SUBMIT_FEEDBACK",
        { feedback: feedbackData, email: userEmail },
        "feedback:user",
        "Submit bug feedback to development team",
        "Safe action: Logs diagnostic feedback for AttendX developers and dispatches receipt email."
      );

      // Only navigate if the user specifically asked to open/show the feedback form/modal or attach files/screenshots
      const wantsOpenForm =
        /\b(?:open|show|launch|take\s+me\s+to|bring\s+up|go\s+to)\b.*\b(?:feedback|form|modal|screen)\b/i.test(lower) ||
        /\b(?:attach|upload)\s+(?:a\s+)?(?:screenshot|image|pic|photo|log|diagnostics?)\b/i.test(lower);

      if (wantsOpenForm) {
        const queryParams = new URLSearchParams({
          issue: issueSummary,
          description: query.trim(),
        }).toString();
        const navAction = this.createAction(
          "NAVIGATE",
          { path: `/settings/feedback?${queryParams}` },
          "route:/settings/feedback",
          "Open Feedback Form",
          "Safe navigation action: opens Feedback modal with pre-filled details."
        );
        const reply = `I've opened the feedback form for you with your report pre-filled. You can attach a screenshot or review device diagnostics before submitting.`;
        return {
          intent: "SUBMIT_FEEDBACK",
          reply,
          response: reply,
          citations: [],
          actions: [action, navAction],
          requiresConfirmation: false,
        };
      }

      const reply = userEmail
        ? `I'm sorry you're facing this issue! I've logged your report: **"${issueSummary}"** and dispatched a confirmation receipt to **${userEmail}**. Our engineering team has received it! (If you need to attach screenshots or diagnostic logs, you can open **Settings > Send Feedback** anytime.)`
        : `I'm sorry you're facing this issue! I've logged your report: **"${issueSummary}"**. Our engineering team has received it! (If you need to attach screenshots or diagnostic logs, you can open **Settings > Send Feedback** anytime.)`;
      return {
        intent: "SUBMIT_FEEDBACK",
        reply,
        response: reply,
        citations: [],
        actions: [action],
        requiresConfirmation: false,
      };
    }

    // 11. BIRTHDAY KNOWLEDGE & BIRTHDAY UPDATES
    if (/\b(birthdays?|b'day|dob)\b/i.test(lower)) {
      // 11a. Setting or updating birthday
      const setMatch = lower.match(/(?:set|update|add|change)\s+(?:my\s+)?birthday(?:\s+to|\s+on|\s+for\s+\w+\s+on)?\s+([a-z0-9\s,-]+)/i);
      if (setMatch) {
        const rawDateStr = setMatch[1].trim();
        const parsed = this.resolveRelativeDate(rawDateStr, wallNow);
        if (parsed.matched) {
          if (context.userId) {
            prisma.user.update({
              where: { id: context.userId },
              data: { birthday: new Date(`${parsed.dateStr}T00:00:00.000Z`) },
            }).catch((err) => console.error("[AIChat:BirthdayUpdate] Error updating user birthday:", err));
          }
          const navAction = this.createAction("NAVIGATE", { path: "/settings/profile" }, "route:/settings/profile", "Open Profile", "Safe navigation action: opens Profile.");
          const reply = `I've updated your birthday to **${parsed.friendly}**! 🎂 You will receive an automated morning birthday greeting and push notification on your special day.`;
          return {
            intent: "CHIT_CHAT",
            reply,
            response: reply,
            citations: [],
            actions: [navAction],
            requiresConfirmation: false,
          };
        }
      }

      // 11b. Asking about user's own birthday
      if (/\b(when|what|is)\s+(?:is\s+)?(?:my\s+birthday|my\s+dob|do\s+you\s+know\s+my\s+birthday)\b/i.test(lower)) {
        if (context.userBirthday) {
          const bDate = new Date(context.userBirthday);
          const bFormatted = bDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
          const reply = `Your birthday on record is **${bFormatted}**! 🎂 Let me know if you need to update it.`;
          return {
            intent: "CHIT_CHAT",
            reply,
            response: reply,
            citations: [],
            actions: [],
            requiresConfirmation: false,
          };
        } else {
          const navAction = this.createAction("NAVIGATE", { path: "/settings/profile" }, "route:/settings/profile", "Open Profile", "Safe navigation action: opens Profile.");
          const reply = `You don't have a birthday saved in your profile yet! You can set it in **Settings > Edit Profile**, or just tell me here (e.g. "Set my birthday to October 14")!`;
          return {
            intent: "CHIT_CHAT",
            reply,
            response: reply,
            citations: [],
            actions: [navAction],
            requiresConfirmation: false,
          };
        }
      }

      // 11c. Asking whose birthday is today
      if (/\b(whose|who\s+has|anybody('s)?|anyone('s)?)\s+birthday\s+(?:is\s+)?today\b/i.test(lower)) {
        const todayMonth = wallNow.getUTCMonth() + 1;
        const todayDay = wallNow.getUTCDate();
        let isUserBirthday = false;
        if (context.userBirthday) {
          const b = new Date(context.userBirthday);
          if (b.getUTCMonth() + 1 === todayMonth && b.getUTCDate() === todayDay) {
            isUserBirthday = true;
          }
        }

        if (isUserBirthday) {
          const reply = `Today is **YOUR birthday**, ${context.userName || "Student"}! 🎉🎂 Wishing you a wonderful birthday filled with joy and academic success from the entire AttendX team!`;
          return {
            intent: "CHIT_CHAT",
            reply,
            response: reply,
            citations: [],
            actions: [],
            requiresConfirmation: false,
          };
        } else {
          const reply = `There are no peer birthdays scheduled for today. Your birthday on record is ${context.userBirthday ? `**${new Date(context.userBirthday).toLocaleDateString("en-US", { month: "long", day: "numeric" })}**` : "not set yet (you can set it in Settings > Edit Profile)"}.`;
          return {
            intent: "CHIT_CHAT",
            reply,
            response: reply,
            citations: [],
            actions: [],
            requiresConfirmation: false,
          };
        }
      }
    }

    // 12. UPCOMING EVENTS & FULL ACADEMIC CALENDAR OVERVIEW
    if (
      /\b(what\s+events|upcoming\s+events|list\s+(?:all\s+)?(?:holidays|events)|all\s+holidays|exam\s+schedule|campus\s+events?|festival\s+schedule|academic\s+calendar)\b/i.test(lower)
    ) {
      const wantsHolidays = /\b(holidays?|vacation|break)\b/i.test(lower);
      const wantsExams = /\b(exams?|tests?|midsem|endsem)\b/i.test(lower);
      const filtered = generalCtx.nextUpcomingEvents.filter((e) => {
        if (wantsHolidays) return e.eventType.includes("holiday") || e.eventType.includes("vacation") || /holiday|vacation|jayanti|diwali|holi/i.test(e.title);
        if (wantsExams) return e.eventType.includes("exam") || e.eventType.includes("sem") || e.eventType.includes("ct") || /exam|mid|end|test|quiz/i.test(e.title);
        return true;
      });
      const list = filtered.length > 0 ? filtered : generalCtx.nextUpcomingEvents;

      if (list.length > 0) {
        const top5 = list.slice(0, 5).map((e) => `• **${e.title}** (${e.date}${e.endDate ? ` – ${e.endDate}` : ""}): ${e.daysUntil === 0 ? "Today" : `in ${e.daysUntil} days`}`).join("\n");
        const navPath = wantsHolidays ? "/semester/holidays" : "/semester/events";
        const action = this.createAction("NAVIGATE", { path: navPath }, `route:${navPath}`, `Open ${wantsHolidays ? "Holidays" : "Events"}`, "Safe navigation action.");
        const reply = `Here are the upcoming ${wantsHolidays ? "holidays" : wantsExams ? "exams" : "academic events"}:\n\n${top5}\n\nOpening the calendar view for complete details.`;
        return {
          intent: "TIMETABLE_QUERY",
          reply,
          response: reply,
          citations: [],
          actions: [action],
          requiresConfirmation: false,
        };
      }
    }

    // 13. PREDICTIVE TAB & REMAINING CLASSES SIMULATION (HOLIDAY & LAST TEACHING DAY AWARE)
    if (
      /\b(simulation|remaining\s+classes|classes\s+(?:left|remaining)|how\s+many\s+lectures\s+left|last\s+(?:day\s+of\s+teaching|teaching\s+day|working\s+day)|end\s+of\s+(?:teaching|semester)|when\s+does\s+(?:the\s+)?semester\s+end)\b/i.test(lower)
    ) {
      const lastTeachingDayStr = context.lastWorkingDay || context.endDate;
      const isJustLastDayQuery = /\b(last\s+(?:day\s+of\s+teaching|teaching\s+day|working\s+day)|when\s+does\s+(?:the\s+)?semester\s+end|end\s+of\s+semester)\b/i.test(lower);

      if (isJustLastDayQuery && lastTeachingDayStr) {
        const endRel = this.resolveRelativeDate(lastTeachingDayStr, wallNow);
        const endObj = new Date(lastTeachingDayStr);
        const todayMidnight = new Date(Date.UTC(wallNow.getUTCFullYear(), wallNow.getUTCMonth(), wallNow.getUTCDate())).getTime();
        const daysLeft = Math.max(0, Math.round((endObj.getTime() - todayMidnight) / (1000 * 60 * 60 * 24)));
        const navAction = this.createAction("NAVIGATE", { path: "/predictive" }, "route:/predictive", "Open Predictive Tab", "Safe navigation action: opens Forecast.");
        const reply = `The **Last Day of Teaching** for ${context.semesterName || "this semester"} is **${endRel.friendly}** (**${daysLeft} days remaining**). After this date, preparation leaves and end-term examinations begin. Opening the **Predictive** engine.`;
        return {
          intent: "FORECAST_SIMULATION",
          reply,
          response: reply,
          citations: [],
          actions: [navAction],
          requiresConfirmation: false,
        };
      }

      // Remaining classes simulation across enrolled subjects
      if (generalCtx.subjects.length > 0) {
        const holidayDates = new Set<string>();
        (context.calendarEvents || []).forEach((e: any) => {
          const type = String(e.eventType || e.event_type || "").toLowerCase();
          const title = String(e.title || e.name || "").toLowerCase();
          if (type.includes("holiday") || type.includes("vacation") || /holiday|break|diwali|holi|jayanti/i.test(title)) {
            const startD = e.date || e.startDate;
            const endD = e.endDate || startD;
            if (startD) {
              const cur = new Date(startD);
              const end = endD ? new Date(endD) : cur;
              while (cur <= end) {
                holidayDates.add(cur.toISOString().split("T")[0]);
                cur.setDate(cur.getDate() + 1);
              }
            }
          }
        });

        const simulationLines = generalCtx.subjects.map((s) => {
          const rem = s.remainingClasses ?? Math.max(1, Math.round(s.total * 0.35));
          return `• **${s.name}**: ~**${rem}** remaining classes (holidays excluded). Current: ${s.attended}/${s.total} (${s.pct.toFixed(1)}%, Target: ${s.target}%). Safe bunks: **${s.safeBunksLeft}**.`;
        }).join("\n");

        const navAction = this.createAction("NAVIGATE", { path: "/predictive" }, "route:/predictive", "Open Predictive Tab", "Safe navigation action: opens Forecast.");
        const reply = `Here is your remaining class simulation${lastTeachingDayStr ? ` through the last teaching day (**${lastTeachingDayStr}**)` : ""}, taking into account all upcoming semester holidays:\n\n${simulationLines}\n\nOpening the **Predictive** tab for deep interactive projections.`;
        return {
          intent: "FORECAST_SIMULATION",
          reply,
          response: reply,
          citations: [],
          actions: [navAction],
          requiresConfirmation: false,
        };
      }
    }

    // 14. TIMETABLE ALERTS & NOTIFICATION CONFIG (Class Reminders, Show Location, Next Class Heads-up, End of Day Summary)
    const alertUpdates: {
      classReminderOffset?: number;
      showLocation?: boolean;
      notifyNextClassOnEnd?: boolean;
      endOfDaySummary?: boolean;
    } = {};
    const alertNotes: string[] = [];

    // A. Class Reminder Lead Time: 5, 10, 15 min or Off / Never (-1)
    const reminderLeadMatch =
      lower.match(/\b(?:switch|set|change|turn|make)?\s*(?:the\s+)?(?:class\s+reminders?|lecture\s+alerts?|reminder\s+offset|time\s+before\s+class)\s*(?:to\s+|as\s+)?(5|10|15|off|never|none|disable)\s*(?:min(?:ute)?s?)?\b/i) ||
      lower.match(/\b(?:switch|change)\s+(?:from\s+)?\d+\s*(?:min(?:ute)?s?)?\s+(?:to\s+|into\s+)(5|10|15|off|never|none)\s*(?:min(?:ute)?s?)?\b/i) ||
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

    // B. Show Location (Include room in notifications)
    if (
      /\b(?:don'?t|do\s+not|stop|hide|remove|disable|turn\s+off|no|without|not)\s+(?:include|including|show|showing|display|displaying)?\s*(?:the\s+)?(?:room|location|classroom)\b/i.test(lower) ||
      /\b(?:hide|remove|disable)\s+(?:room|location)\s+(?:in\s+notifications?|in\s+alerts?)?\b/i.test(lower)
    ) {
      alertUpdates.showLocation = false;
      alertNotes.push("configured notifications to **hide room location**");
    } else if (
      /\b(?:include|including|show|showing|display|displaying|add|adding|enable|turn\s+on|with)\s+(?:the\s+)?(?:room|location|classroom)\s+(?:in|on)\s+(?:the\s+)?(?:notifications?|alerts?)\b/i.test(lower) ||
      /\b(?:turn\s+on\s+show\s+location|show\s+room|include\s+location)\b/i.test(lower)
    ) {
      alertUpdates.showLocation = true;
      alertNotes.push("configured notifications to **include room location**");
    }

    // C. Next Class Heads-up (Notify when current class ends)
    if (
      /\b(?:don'?t|do\s+not|stop|disable|turn\s+off|no|i\s+do\s+not\s+want|without)\s+(?:want\s+)?(?:the\s+)?(?:next\s+class\s+)?heads[\s-]*up\b/i.test(lower) ||
      /\b(?:don'?t|do\s+not|stop)\s+notify(?:ing)?\s+(?:me\s+)?when\s+(?:current\s+)?class\s+ends\b/i.test(lower)
    ) {
      alertUpdates.notifyNextClassOnEnd = false;
      alertNotes.push("turned **OFF** the Next Class Heads-up alert");
    } else if (
      /\b(?:enable|turn\s+on|activate|start|i\s+want)\s+(?:the\s+)?(?:next\s+class\s+)?heads[\s-]*up\b/i.test(lower) ||
      /\bnotify\s+(?:me\s+)?when\s+(?:current\s+)?class\s+ends\b/i.test(lower)
    ) {
      alertUpdates.notifyNextClassOnEnd = true;
      alertNotes.push("turned **ON** the Next Class Heads-up alert (notifying when classes end)");
    }

    // D. End of Day Summary ('Done for the day' alert)
    if (
      /\b(?:don'?t|do\s+not|stop|disable|turn\s+off|no|i\s+do\s+not\s+want|without)\s+(?:the\s+)?(?:end\s+of\s+day\s+summary|done\s+for\s+the\s+day\s+alert|daily\s+completion\s+alert)\b/i.test(lower)
    ) {
      alertUpdates.endOfDaySummary = false;
      alertNotes.push("turned **OFF** the End of Day Summary alert");
    } else if (
      /\b(?:enable|turn\s+on|activate|start|i\s+want)\s+(?:the\s+)?(?:end\s+of\s+day\s+summary|done\s+for\s+the\s+day\s+alert)\b/i.test(lower)
    ) {
      alertUpdates.endOfDaySummary = true;
      alertNotes.push("turned **ON** the End of Day Summary alert ('Done for the day')");
    }

    if (Object.keys(alertUpdates).length > 0) {
      const actions: ActionPayload[] = [];
      if (alertUpdates.classReminderOffset !== undefined && Object.keys(alertUpdates).length === 1) {
        actions.push(
          this.createAction(
            "CHANGE_CLASS_REMINDER_OFFSET",
            { offsetMinutes: alertUpdates.classReminderOffset },
            "settings:timetable-alerts",
            `Set class reminder offset to ${alertUpdates.classReminderOffset === -1 ? 'Off' : `${alertUpdates.classReminderOffset} min`}`,
            "Safe action: Updates lecture notification lead time."
          )
        );
      } else {
        actions.push(
          this.createAction(
            "UPDATE_TIMETABLE_ALERTS",
            alertUpdates,
            "settings:timetable-alerts",
            "Update timetable alert preferences",
            "Safe action: Customizes notification lead times, room display, and heads-up alerts."
          )
        );
      }
      const reply = `Done! I have ${alertNotes.join(" and ")}. Your alarms and local notifications have been rescheduled immediately.`;
      return {
        intent: "UPDATE_SETTINGS",
        reply,
        response: reply,
        citations: [],
        actions,
        requiresConfirmation: false,
      };
    }

    return null;
  }

  /**
   * Pre-computes a compact multi-day simulation summary for Tier 3 Gemini calls
   * when the user asks about missing N days/weeks or a date range.
   */
  private static computeMultiDaySimulationBlock(
    query: string,
    generalCtx: ReturnType<typeof CustomMlCopilotService.buildGeneralContext>
  ): string {
    const lower = query.toLowerCase();
    if (!/\b(if i|what if|miss|skip|bunk|leave|trip|vacation|absent for|next \d+ days|next week)\b/i.test(lower)) {
      return "";
    }

    let daysCount = 0;
    const daysMatch = lower.match(/(\d+)\s*days?/i);
    const weeksMatch = lower.match(/(\d+)\s*weeks?/i);
    if (daysMatch) daysCount = Math.min(30, Math.max(1, parseInt(daysMatch[1], 10)));
    else if (weeksMatch) daysCount = Math.min(30, Math.max(1, parseInt(weeksMatch[1], 10) * 7));
    else if (/\bnext week\b/i.test(lower)) daysCount = 7;

    if (daysCount <= 0 || generalCtx.subjects.length === 0) return "";

    const start = new Date(`${generalCtx.todayIso}T00:00:00`);
    const missedPerSub: Record<string, number> = {};
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dayIdx = (d.getDay() + 6) % 7;
      const subIds = generalCtx.weekdaySubjectMatrix[dayIdx] || [];
      for (const id of subIds) {
        missedPerSub[id] = (missedPerSub[id] || 0) + 1;
      }
    }

    const lines = generalCtx.subjects
      .filter((s) => (missedPerSub[s.id] || 0) > 0)
      .map((s) => {
        const miss = missedPerSub[s.id];
        const newTot = s.total + miss;
        const newPct = newTot > 0 ? (s.attended / newTot) * 100 : 100;
        return `- ${s.name}: misses ${miss} class(es) -> ${s.attended}/${newTot} (${newPct.toFixed(1)}%, Target: ${s.target}%, ${newPct >= s.target ? "SAFE" : "DROPS BELOW TARGET"})`;
      });

    if (lines.length === 0) return "";
    return `[PRECOMPUTED_${daysCount}_DAY_LEAVE_SIMULATION]\n${lines.join("\n")}`;
  }

  /**
   * Main entrypoint for processing user queries using 3-Tier Fast-Path + Gemini 3.7/3.8-Flash router
   */
  public static async process(
    query: string,
    context: CopilotContext = {},
    masterPrompt?: string
  ): Promise<CopilotResponse> {
    if (!this.isWarmedUp) {
      this.warmup();
    }

    // Preserve toxic guardrail (0ms)
    const TOXIC_PATTERN =
      /\b(fuck|fucking|fucker|shit|bullshit|bitch|bitching|asshole|dick|dickhead|cunt|slut|whore|bastard|motherfucker|stfu|dumbass|idiot|retard|fag|nigger|nigga|madarchod|mc|behenchod|bhenchod|bc|bhosdike|bhosdiwale|bhosda|chutiya|chutiye|gaand|gandu|gandwe|lavde|laude|lodu|lode|lund|jhantu|harami|kamina|kamine|saala|saale|randi|raand|tatte|jhaat|bakchod|bakchodi|gaandmara|gandmara)\b|[\u0900-\u097F]*(?:चूतिया|मादरचोद|बहनचोद|भोसड़ीके|भोसड़ीवाले|गांडू|गांड|लौड़े|लवड़े|लंड|हरामी|कमीना|रंडी|झांट|बकचोद|चूत|गाली)[\u0900-\u097F]*/i;
    if (TOXIC_PATTERN.test(query)) {
      const reply =
        "I'm here to help you manage your attendance, timetable, assignments, and academic queries for AttendX. Please keep our conversation respectful so I can assist you effectively.";
      return {
        intent: "CHIT_CHAT",
        reply,
        response: reply,
        citations: [],
        actions: [],
        requiresConfirmation: false,
      };
    }

    // Tier 0: Build Pre-Computed General Context Snapshot (< 1ms)
    const generalCtx = this.buildGeneralContext(context);

    // Tier 1 & Tier 2: Deterministic Fast-Path Router (< 15ms-80ms, 0 Gemini API latency)
    const fastResult = await this.tryFastPath(query, context, generalCtx);
    if (fastResult) {
      console.info(`[AIChat:FastPath] Resolved "${query}" via deterministic fast-path (${fastResult.intent})`);
      return fastResult;
    }

    let parsed: any = null;

    if (process.env.GEMINI_API_KEY) {
      try {
        const needsOrdinance = /\b(policy|ordinance|regulation|rule|75%|55%|l grade|r grade|i grade|m grade|grade|cgpa|sgpa|credit|minor|honors|leave|medical|on-duty|od|hostel|ragging|mess|rebate|curfew|in-timing|10:00|9:30|malpractice|supplementary|exam|scholarship|debar)\b/i.test(query);
        const relevantOrd = needsOrdinance ? this.searchOrdinance(query) : null;
        const ordContext = relevantOrd ? `[RELEVANT ORDINANCE]\nSection: ${relevantOrd.section}\nTitle: ${relevantOrd.title}\nText: ${relevantOrd.summary}` : "";
        const precomputedSimBlock = this.computeMultiDaySimulationBlock(query, generalCtx);

        const systemPrompt = `You are AttendX AI Copilot, the intelligent academic advisor and intent router for AttendX (created by Naman Rai).
Analyze the student's query and app context, classify their intent into exactly ONE of the 12 supported intents, formulate a helpful, concise, friendly reply, and stage any corresponding actions.

CRITICAL: Return ONLY a valid JSON object matching the schema below. No markdown wrapping or backticks.

App UI Structure Rules:
- Subjects are managed at \`/subjects\`. Use this screen to view overall semester attendance, check all attendance logs, history, and subject-specific details.
- Timetable slots are managed at \`/timetable\`.
- Semesters are managed at \`/semester\`. Use this screen to view the academic calendar timeline, upcoming events, countdowns, and holidays (both fixed and restricted).
- Calendar Color Codes: Dots indicate attendance status (Green dot = Attended/Present, Red dot = Missed/Absent, Purple dot = Mixed, Yellow dot = Off/Cancelled, Gray dot = Not marked/future). Colored rings/borders around a date indicate academic events (e.g., Red/Orange for exams, Teal/Cyan for holidays, Fuchsia for fests).

Supported Intents:
1. CHIT_CHAT: Greetings, conversational pleasantries, small talk, questions about creator (Naman Rai), assistant identity, or the user's personal profile (like their name or birthday provided in the context).
2. APP_FAQ: Questions about AttendX features (peer sync, backups, import/export, notifications, offline mode, settings).
3. POLICY_RAG: Questions regarding college academic regulations, IIIT Una ordinances, 75% attendance rule, shortage grades (L grade: 55-75%, R grade: <55%), leave rules (9-day medical leave), 5% relaxation, on-duty (OD) rules, hostel in-timing (10:00 PM), mess rebate (N-2 days), anti-ragging, exams (rules), or grading (rules). DO NOT use this for asking WHEN an exam is; use TIMETABLE_QUERY for dates.
4. SUBMIT_FEEDBACK: Bug reports, user feedback, complaints, or feature requests.
5. NAVIGATE_APP: Requests to navigate to specific app screens (timetable, settings, reports, calendar, forecast/predictive, today/agenda, assignments, peer-sync, semester, subjects).
6. UPDATE_SETTINGS: Requests to change app settings (switch theme to dark/light, change reminder frequency).
7. TIMETABLE_QUERY: Queries about scheduled lectures, classes today/tomorrow, timetable lookup, holidays, exam dates, or important academic dates (ALWAYS read from "Upcoming Events" in the Master Context).
8. FORECAST_SIMULATION: Explicit hypothetical questions (e.g., "what if I miss", "can I bunk", "how many classes do I need"). DO NOT use for definitive statements like "I am not going". (For multi-day vacations, your text reply MUST breakdown exactly how many classes of each specific subject will be missed, and warn if any individual subject drops below its target!)
9. TRIGGER_REPORT: Requests to email or send attendance report, summary, or analytics to the student. (IMPORTANT: You MUST state in your reply that you are generating and emailing the report to them).
10. MARK_ATTENDANCE: Explicitly recording attendance. If the user says "I am not going" or "I am bunking today", stage a MARK_ATTENDANCE action with status="absent" (omit subjectId to mark all classes). Use MARK_FULL_DAY_OFF ONLY when classes are officially cancelled/holiday, not when skipping.
11. SHIFT_TIMETABLE: Rescheduling, postponing, or shifting a SINGLE timetable slot to another time or day.
17. SWAP_TIMETABLE_DAYS: Swapping the entire timetable of one day with another (e.g. swap Monday and Friday).
18. SHIFT_TIMETABLE_DAY: Moving an entire day's timetable to another day (e.g. move tomorrow's timetable to Friday).
15. ADD_TIMETABLE_SLOT: Adding a new recurring weekly slot to the timetable.
16. REMOVE_TIMETABLE_SLOT: Removing a specific recurring weekly slot from the timetable.
14. ADD_EXTRA_CLASS: Scheduling a makeup class, extra lecture, or additional lab session on a specific date and time.
12. MODIFY_SUBJECTS: Adding a new subject, updating its name/color, or removing/dropping a subject from the timetable/enrollment.
13. MODIFY_TARGET: Changing individual subject target or global attendance target percentage.
19. MANAGE_ASSIGNMENTS: Adding, marking completed, updating, or deleting academic assignments and deadlines.

Action Types & Payloads:
- Safe Actions (executed immediately):
  * NAVIGATE: { "path": string } (e.g. "/report", "/timetable", "/settings/profile", "/settings/devices", "/settings/peer-sync", "/settings/contact", "/settings/app-info", "/settings/feedback", "/settings/changelog", "/settings/backup", "/semester/timeline", "/semester/events", "/semester/holidays", "/predictive", "/today")
  * READ_STATS: {}
  * FILTER_VIEW: { "filter": string }
  * SET_SIMULATION_PREVIEW: { "subjectId": string, "skipCount": number }
  * SWITCH_THEME: { "theme": "dark" | "light" | "system" }
  * SHARE_APP: {}
  * CHANGE_REMINDER_FREQUENCY: { "frequency": "Never"|"Daily"|"Weekly"|"Monthly"|"Yearly", "subValue"?: string }
      - For Weekly: subValue = day abbreviation e.g. "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
      - For Monthly: subValue = day-of-month as string e.g. "1", "15", "28"
      - For Yearly: subValue = month abbreviation e.g. "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  * CHANGE_SUMMARY_TIME: { "time": "HH:MM", "bracket"?: "Daily"|"Weekly"|"Monthly"|"Yearly" } (e.g. "20:00" for 8 PM; bracket = which frequency tier this time applies to; if not specified, defaults to current active frequency)
  * CHANGE_CLASS_REMINDER_OFFSET: { "offsetMinutes": number } (-1 for off/never, 5, 10, or 15)
  * UPDATE_TIMETABLE_ALERTS: { "classReminderOffset"?: number (-1 for off, 5, 10, 15), "showLocation"?: boolean, "notifyNextClassOnEnd"?: boolean, "endOfDaySummary"?: boolean }
  * MARK_ATTENDANCE: { "subjectId": string, "date": "YYYY-MM-DD", "status": "present" | "absent" | "medical" | "od" | "off" } (For relative days like 'Wednesday', default to the most recent occurrence on or before today unless the user says next/upcoming/tomorrow. ALWAYS take dates from the [DATE REFERENCE] table; never compute them yourself.).
  * TRIGGER_REPORT: { "type": "weekly" | "monthly" | "semester" | "custom", "title"?: "string", "startDate"?: "YYYY-MM-DD", "endDate"?: "YYYY-MM-DD" }
  * SUBMIT_FEEDBACK: { "type": string, "description": string, "issue": string }
- Destructive Actions (flagged as requiresConfirmation=true):
  * REMOVE_SUBJECT: { "subjectId": string }
  * DROP_SUBJECT_FROM_TIMETABLE: { "slotId": string, "subjectId": string }
  * REMOVE_ATTENDANCE: { "subjectId": string, "date": "YYYY-MM-DD" } (Default to most recent past occurrence if relative day is used; take dates from the [DATE REFERENCE] table.)
  * MARK_FULL_DAY_OFF: { "date": "YYYY-MM-DD" }
  * ADD_EXTRA_CLASS: { "subjectId": string, "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM", "reason": "string" } (If only a start time is provided, assume duration is 50 mins for lectures or 100 mins for labs. Use 24-hour format).
  * SHIFT_TIMETABLE_SLOT: { "subjectId": string, "dayOfWeek": number (0=Monday, ..., 6=Sunday), "newDayOfWeek"?: number (0=Monday, ..., 6=Sunday), "newStartTime": string, "newEndTime": string }
  * ADD_TIMETABLE_SLOT: { "subjectId": string, "dayOfWeek": number (0=Monday, ..., 6=Sunday), "startTime": "HH:MM", "endTime": "HH:MM", "room"?: "string", "slotType"?: "lecture"|"practical" }
  * REMOVE_TIMETABLE_SLOT: { "subjectId": string, "dayOfWeek": number (0=Monday, ..., 6=Sunday), "startTime": "HH:MM" }
  * SWAP_TIMETABLE_DAYS: { "dayA": number (0=Mon), "dayB": number (0=Mon) }
  * SHIFT_TIMETABLE_DAY: { "sourceDay": number (0=Mon), "targetDay": number (0=Mon) }
  * ADD_SUBJECT: { "name": string, "code": string, "target": number }
  * UPDATE_SUBJECT: { "subjectId": string, "updates": { "name"?: string, "colorHex"?: string, "code"?: string, "faculty"?: string, "credits"?: number } }
  * CHANGE_TARGET: { "subjectId": string, "target": number }
  * CHANGE_GLOBAL_TARGET: { "target": number }
  * ADD_ASSIGNMENT: { "title": string, "deadline": "YYYY-MM-DDTHH:MM:SSZ", "subjectId"?: string, "description"?: string, "priority"?: "low"|"medium"|"high" }
  * MARK_ASSIGNMENT_COMPLETED: { "assignmentId"?: string, "title"?: string }
  * DELETE_ASSIGNMENT: { "assignmentId"?: string, "title"?: string }

Response JSON Schema:
{
  "intent": "CHIT_CHAT" | "APP_FAQ" | "POLICY_RAG" | "SUBMIT_FEEDBACK" | "NAVIGATE_APP" | "UPDATE_SETTINGS" | "TIMETABLE_QUERY" | "FORECAST_SIMULATION" | "TRIGGER_REPORT" | "MARK_ATTENDANCE" | "SHIFT_TIMETABLE" | "MODIFY_SUBJECTS" | "MODIFY_TARGET" | "ADD_EXTRA_CLASS" | "ADD_TIMETABLE_SLOT" | "REMOVE_TIMETABLE_SLOT" | "SWAP_TIMETABLE_DAYS" | "SHIFT_TIMETABLE_DAY",
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

        const subMap = (context.subjects || []).reduce((acc: any, s: any) => {
          acc[s.id] = s.name;
          return acc;
        }, {});
        
        const timetableSummary = (context.timetable_slots || [])
          .map((slot) => {
             const dayName = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][parseInt(slot.dayOfWeek) || 0] || slot.dayOfWeek;
             return `  * ${dayName} ${slot.startTime}-${slot.endTime}: ${subMap[slot.subjectId] || slot.subjectId} (${slot.type || 'Class'})`;
          })
          .join("\n") || "  No timetable slots found";

        const extraClassesSummary = (context.historyLogs || [])
          .filter((log: any) => log.isExtra && log.status === "not_marked")
          .map((log: any) => `  * ${log.date} ${log.startTime || ''}: ${subMap[log.subjectId] || log.subjectName || log.subjectId} (Extra Class)`)
          .join("\n");

        const userPrompt = `User Query: "${query}"
Context:
- User Name: ${context.userName || "Student"}
- Birthday: ${context.userBirthday || "Not provided"}
- Current Route: ${context.currentRoute || "/today"}
- Local Time: ${context.localTime || new Date().toISOString()}
- Overall Attendance: ${context.overallPercentage ?? 100}% (${context.totalAttended ?? 0}/${context.totalClasses ?? 0} classes)
- Target Attendance: ${context.targetPercentage ?? 75}%
- Enrolled Subjects:
${subjectsSummary}
- Weekly Timetable:
${timetableSummary}
${extraClassesSummary ? `- Upcoming Extra Classes:\n${extraClassesSummary}` : ""}

${ordContext}`;

        // Master context consolidated without duplication
        const dateReferenceBlock = this.buildDateReferenceBlock(query, context.localTime);
        const extraBlocks = [ordContext, precomputedSimBlock, dateReferenceBlock].filter(Boolean).join("\n\n");
        const fullPrompt = masterPrompt
          ? `${extraBlocks ? extraBlocks + "\n\n" : ""}${masterPrompt}`
          : `${userPrompt}\n\n${[precomputedSimBlock, dateReferenceBlock].filter(Boolean).join("\n\n")}`;

        const response = await AIManager.generateContent({
          model: "gemini-3.8-flash",
          contents: fullPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            temperature: 0.1,
            thinkingConfig: { thinkingBudget: 0 },
          },
        });

        const responseText = response.text || "{}";
        console.info(`[AIChat:GeminiRaw] Response received (${responseText.length} chars):`, responseText.length > 500 ? responseText.slice(0, 500) + "..." : responseText);
        const match = responseText.match(/\{[\s\S]*\}/);
        const cleaned = match ? match[0] : "{}";
        parsed = JSON.parse(cleaned);
      } catch (err: any) {
        console.warn("[CustomMlCopilotService] Gemini router failed or threw error:", err?.message || err);
        
        // If it's a JSON parse error, try to fallback gracefully to APP_FAQ rather than completely failing
        if (err instanceof SyntaxError) {
           return {

             intent: "APP_FAQ",
             reply: "I understood your question, but I had trouble formatting my response. Could you rephrase it?",
             response: "JSON parsing error on Gemini response",
             citations: [],
             actions: [],
             requiresConfirmation: false
           };
        }
        
        // Explicitly handle Rate Limit / Quota Exceeded (429) errors so users know what happened
        if (err?.message?.includes("429") || err?.status === 429 || err?.message?.includes("quota") || err?.message?.includes("exhausted")) {
          return {

            intent: "APP_FAQ",
            reply: "I am receiving too many requests right now and hit my API limit. Please wait a few seconds and try asking again.",
            response: "I am receiving too many requests right now and hit my API limit. Please wait a few seconds and try asking again.",
            citations: [],
            actions: [],
            requiresConfirmation: false,
          };
        }

        // CATCH-ALL FOR ANY OTHER ERROR (Network, 500, 503, Blocked by safety)
        console.warn("[CustomMlCopilotService] Returning generic AI connection error to user.");
        return {

           intent: "APP_FAQ",
           reply: "I'm having trouble connecting to my AI brain right now. Please check your internet or try again in a moment.",
           response: "Offline engine error.",
           citations: [],
           actions: [],
           requiresConfirmation: false
        };
      }
    } else {
      console.warn("[CustomMlCopilotService] GEMINI_API_KEY is not configured, using fallback intent router.");
    }

    if (!parsed) {
      return await this.fallbackProcess(query, context);
    }

    let intent: IntentType = parsed.intent || "CHIT_CHAT";
    let reply: string = parsed.reply || "I have processed your request.";
    const citations: string[] = Array.isArray(parsed.citations) ? parsed.citations : [];
    const simulation = parsed.simulation;

    // Map actions through ActionPolicyMatrix
    const rawActions: any[] = Array.isArray(parsed.actions) ? parsed.actions : [];
    const validatedActions: ActionPayload[] = [];
    let requiresConfirmation = false;

    for (const raw of rawActions) {
      if (!raw || !raw.type) continue;
      
      // Strict Path Validation for NAVIGATE actions to prevent external redirects / XSS
      if (raw.type === "NAVIGATE" && raw.payload?.path) {
        const allowedPaths = ["/today", "/calendar", "/timetable", "/subjects", "/semester", "/predictive", "/report", "/reports", "/settings", "/assignments", "/peer-sync", "/classrooms"];
        if (raw.payload.path === "/reports") raw.payload.path = "/report";
        const isAllowed = allowedPaths.some(p => raw.payload.path === p || raw.payload.path.startsWith(`${p}/`));
        if (!isAllowed) {
           console.warn(`[CustomMlCopilotService] Blocked unauthorized NAVIGATE path: ${raw.payload.path}`);
           continue; // Drop the action
        }
      }

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
    // 1. TRIGGER_REPORT (Fast Single-Batch Query & Non-Blocking Dispatch)
    const reportAction = validatedActions.find((a) => a.type === "TRIGGER_REPORT");
    if (intent === "TRIGGER_REPORT" || reportAction) {
      const reportType = reportAction?.payload?.type || "weekly";
      const reportTitle =
        reportAction?.payload?.title ||
        `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Attendance Report`;

      const { reply: fastReply, action: generatedAction } = await this.dispatchFastReport(
        reportType,
        reportTitle,
        context,
        reportAction?.payload?.startDate,
        reportAction?.payload?.endDate
      );
      reply = fastReply;
      if (!reportAction) {
        validatedActions.push(generatedAction);
      }
    }

    // 2. SUBMIT_FEEDBACK
    if (intent === "SUBMIT_FEEDBACK" || validatedActions.some((a) => a.type === "SUBMIT_FEEDBACK")) {
      let userEmail = context.userEmail || "";
      let userName = context.userName || "Student";
      if (context.userId) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: context.userId },
            select: { email: true, name: true },
          });
          if (user) {
            userEmail = user.email || userEmail;
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
          EmailService.sendFeedbackReceipt(userEmail, userName, feedbackData).catch(console.error);
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

    // 3. MARK_ATTENDANCE Validation (Check if class exists on timetable)
    const attendanceActions = validatedActions.filter(a => a.type === "MARK_ATTENDANCE");
    const missingSubjects: string[] = [];
    let targetDateForPrompt = "";

    for (let i = attendanceActions.length - 1; i >= 0; i--) {
      const action = attendanceActions[i];
      if (!action.payload?.subjectId && action.payload?.date && context.userId) {
        // Bulk mark request for the entire day
        const targetDateStr = action.payload.date;
        targetDateForPrompt = targetDateStr;
        const agenda = await AttendanceService.getTodayAgenda(context.userId, targetDateStr);
        
        const origIndex = validatedActions.indexOf(action);
        if (origIndex > -1) {
          validatedActions.splice(origIndex, 1);
        }

        if (agenda.length === 0) {
           const friendlyDate = new Date(targetDateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
           reply = `You don't have any classes scheduled on ${friendlyDate}!`;
           intent = "TIMETABLE_QUERY" as IntentType;
        } else {
           agenda.forEach(item => {
              if (item.type !== 'manual') {
                 validatedActions.push({
                   id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                   type: "MARK_ATTENDANCE",
                   category: "SAFE",
                   isDestructive: false,
                   requiresConfirmation: false,
                   target: `date:${targetDateStr}`,
                   description: `Mark ${item.subject.name} as ${action.payload.status}`,
                   impact: "Safe update",
                   payload: {
                      subjectId: item.subject.id,
                      date: targetDateStr,
                      status: action.payload.status,
                      timetableSlotId: item.id,
                      remarks: "Marked by AttendX Copilot"
                   }
                 });
              }
           });
        }
      } else if (action.payload?.subjectId && action.payload?.date && context.userId) {
        const targetDateStr = action.payload.date;
        targetDateForPrompt = targetDateStr;
        const agenda = await AttendanceService.getTodayAgenda(context.userId, targetDateStr);
        
        const existsOnAgenda = agenda.some(item => 
          item.subject.id === action.payload.subjectId && 
          item.type !== "manual"
        );

        if (!existsOnAgenda) {
          const subject = context.subjects?.find(s => s.id === action.payload.subjectId);
          const subjectName = subject?.name || "the class";
          missingSubjects.push(subjectName);
          
          action.type = "ADD_EXTRA_CLASS";
          action.requiresConfirmation = true;
          action.isDestructive = true;
          
          action.payload = {
             subjectId: action.payload.subjectId,
             date: targetDateStr,
             startTime: "00:00",
             endTime: "00:00",
             reason: "AI auto-generated Extra Class",
             markStatus: action.payload.status,
             remarks: "Marked by AttendX Copilot"
          };
        }
      }
    }

    if (missingSubjects.length > 0) {
      const friendlyDate = new Date(targetDateForPrompt).toLocaleDateString('en-US', { weekday: 'long' });
      reply = `There are no classes scheduled for ${missingSubjects.join(", ")} on ${friendlyDate}. Would you like me to add them as Extra Classes and mark them?`;
    }

    // 4. MARK_FULL_DAY_OFF Validation (Check if any classes exist on that day)
    const fullDayOffActions = validatedActions.filter(a => a.type === "MARK_FULL_DAY_OFF");
    let noClassesDayStr = "";
    
    for (let i = fullDayOffActions.length - 1; i >= 0; i--) {
      const action = fullDayOffActions[i];
      if (action.payload?.date && context.userId) {
        const targetDateStr = action.payload.date;
        const agenda = await AttendanceService.getTodayAgenda(context.userId, targetDateStr);
        
        if (agenda.length === 0) {
          noClassesDayStr = targetDateStr;
          const index = validatedActions.indexOf(action);
          if (index > -1) {
            validatedActions.splice(index, 1);
          }
        }
      }
    }

    if (noClassesDayStr) {
      const friendlyDate = new Date(noClassesDayStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      reply = `You don't have any classes scheduled on ${friendlyDate}, so there is no need to mark a full day off!`;
      intent = "TIMETABLE_QUERY" as IntentType;
    }

    // 5. REMOVE_ATTENDANCE Validation (Check if the attendance log actually exists)
    const removeActions = validatedActions.filter(a => a.type === "REMOVE_ATTENDANCE");
    let missingLogSubject = "";
    let missingLogDate = "";

    for (let i = removeActions.length - 1; i >= 0; i--) {
      const action = removeActions[i];
      if (action.payload?.subjectId && action.payload?.date && context.userId) {
        const targetDateStr = action.payload.date;
        const subjectId = action.payload.subjectId;
        const agenda = await AttendanceService.getTodayAgenda(context.userId, targetDateStr);
        
        const hasLog = agenda.some(item => 
           item.subject.id === subjectId && 
           item.status !== "not_marked" && 
           item.status !== null
        );

        if (!hasLog) {
          missingLogDate = targetDateStr;
          const subject = context.subjects?.find(s => s.id === subjectId);
          missingLogSubject = subject?.name || "that class";
          
          const index = validatedActions.indexOf(action);
          if (index > -1) {
            validatedActions.splice(index, 1);
          }
        }
      }
    }

    if (missingLogSubject && missingLogDate) {
      const friendlyDate = new Date(missingLogDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      reply = `You don't have any attendance marked for ${missingLogSubject} on ${friendlyDate}!`;
      intent = "TIMETABLE_QUERY" as IntentType;
    }

    let semesterProjection = undefined;
    if (intent === "FORECAST_SIMULATION" && /(rest of semester|last working day|till the end|remaining classes|all remaining)/i.test(query)) {
      const isAttend = /(attend|attending|go to)/i.test(query);
      const subjectsWithRemaining = (context.subjects || []).filter((s: any) => s.remainingClasses && s.remainingClasses > 0);
      
      if (subjectsWithRemaining.length > 0) {
        semesterProjection = {
          skipCountPerSubject: isAttend ? 0 : -1, // We map this in UI. 0 means attend all remaining, -1 means miss all remaining.
          endDate: context.endDate || new Date().toISOString().split('T')[0],
          subjects: subjectsWithRemaining.map((s: any) => {
            const currentAtt = s.attended || 0;
            const currentTot = s.total || 0;
            const projectedTotal = currentTot + s.remainingClasses!;
            const projectedAttended = isAttend ? currentAtt + s.remainingClasses! : currentAtt;
            const projectedPercentage = projectedTotal > 0 ? (projectedAttended / projectedTotal) * 100 : 100;
            return {

              subjectId: s.id,
              subjectName: s.name,
              remainingClasses: s.remainingClasses!,
              projectedPercentage,
              targetPercentage: s.target || context.targetPercentage || 75
            };
          })
        };
        
        reply = `I have projected your attendance until the end of the semester. Assuming you ${isAttend ? "attend" : "miss"} all remaining classes, here is your forecast.`;
      }
    }

    if (intent === "FORECAST_SIMULATION" && simulation && /(every week|per week|a week|from now on|till the end|rest of semester)/i.test(query)) {
      if (!context.endDate) {
        reply = "I don't have your semester's end date configured. Please tell me your last working day so I can calculate this correctly.";
        // Clear simulation so it doesn't render incorrectly
        for (const key in simulation) delete simulation[key];
      } else {
        const start = new Date(context.localTime || new Date());
        const end = new Date(context.endDate);
        const diffTime = Math.max(0, end.getTime() - start.getTime());
        const diffWeeks = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7)));
        
        let perWeek = simulation.skipCount || 1; 
        const isAttend = /(attend|attending|go to)/i.test(query) && !/(miss|skip|bunk)/i.test(query);
        if (isAttend && perWeek > 0) perWeek = -perWeek;
        
        simulation.skipCount = perWeek * diffWeeks;
        
        const currentTot = simulation.currentTotal || 0;
        const currentAtt = simulation.currentAttended || 0;
        
        const projectedTotal = currentTot + Math.abs(simulation.skipCount);
        const projectedAttended = simulation.skipCount < 0 
          ? currentAtt + Math.abs(simulation.skipCount) 
          : currentAtt;
          
        simulation.projectedPercentage = projectedTotal > 0 ? (projectedAttended / projectedTotal) * 100 : 100;
        
        reply = `Assuming there are about ${diffWeeks} weeks left until ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${isAttend ? 'attending' : 'missing'} ${Math.abs(perWeek)} class(es) per week means you will ${isAttend ? 'attend' : 'miss'} a total of ${Math.abs(simulation.skipCount)} classes. Here is your preview!`;
      }
    }

    if (intent === "FORECAST_SIMULATION" && simulation && /(how many|how much).*?(need|require|reach|get to|can i miss|can i skip|afford to miss)/i.test(query)) {
      const match = query.match(/(\d+)\s*%/);
      const targetPct = match ? parseInt(match[1]) : (simulation.targetPercentage || 75);
      
      const subject = (context.subjects || []).find((s: any) => 
        s.id === simulation.subjectId || 
        (simulation.subjectName && s.name.toLowerCase() === simulation.subjectName.toLowerCase())
      ) || { remainingClasses: 0 };
      
      const currentAtt = simulation.currentAttended || 0;
      const currentTot = simulation.currentTotal || 0;
      const remaining = subject.remainingClasses || 0;
      const currentPct = currentTot > 0 ? (currentAtt / currentTot) * 100 : 100;
      
      // Helper to append date warning
      const appendDateWarning = (msg: string) => {
        if (!context.endDate || remaining === 0) {
          return msg + ` (Note: I couldn't verify your remaining classes. Please ensure your 'Last Teaching Day' is set in the Forecast tab!)`;
        }
        return msg;
      };

      if (targetPct >= 100 && currentAtt < currentTot) {
        reply = `It's mathematically impossible to reach exactly 100% since you have already missed classes.`;
        for (const key in simulation) delete simulation[key];
      } else {
        const requiredClasses = Math.ceil(((targetPct / 100) * currentTot - currentAtt) / (1 - (targetPct / 100)));
        
        if (requiredClasses <= 0) {
          // User is above target, so calculate how many they can miss
          const safeToMiss = Math.floor((currentAtt - (targetPct / 100) * currentTot) / (targetPct / 100));
          
          if (safeToMiss > 0) {
            reply = appendDateWarning(`In ${simulation.subjectName}, you currently have ${currentAtt} attended out of ${currentTot} classes (${currentPct.toFixed(2)}%). You can safely miss ${safeToMiss} consecutive class(es) and still stay at or above ${targetPct}%.`);
            simulation.skipCount = safeToMiss; // positive means miss
            const finalTot = currentTot + safeToMiss;
            simulation.projectedPercentage = finalTot > 0 ? (currentAtt / finalTot) * 100 : 100;
          } else {
            reply = appendDateWarning(`You are exactly at ${targetPct}% in ${simulation.subjectName || 'this subject'}. If you miss any more classes, you will drop below your target.`);
            simulation.skipCount = 1;
            simulation.projectedPercentage = ((currentAtt) / (currentTot + 1)) * 100;
          }
        } else if (remaining > 0 && requiredClasses > remaining) {
          reply = `In ${simulation.subjectName}, you need ${requiredClasses} consecutive classes to reach ${targetPct}%. However, there are only ${remaining} classes left in the semester, making it mathematically impossible to reach this target.`;
          simulation.skipCount = -remaining;
          const finalAtt = currentAtt + remaining;
          const finalTot = currentTot + remaining;
          simulation.projectedPercentage = finalTot > 0 ? (finalAtt / finalTot) * 100 : 100;
        } else {
          reply = appendDateWarning(`In ${simulation.subjectName}, you currently have ${currentAtt} attended out of ${currentTot} classes (${currentPct.toFixed(2)}%). To reach ${targetPct}% attendance, you need to attend the next ${requiredClasses} consecutive classes.`);
          simulation.skipCount = -requiredClasses; // negative means attend
          const finalAtt = currentAtt + requiredClasses;
          const finalTot = currentTot + requiredClasses;
          simulation.projectedPercentage = finalTot > 0 ? (finalAtt / finalTot) * 100 : 100;
        }
      }
    }

    // Return the final payload
    let finalSimulation = undefined;
    if (!semesterProjection && simulation && Object.keys(simulation).length > 0) {
      finalSimulation = simulation;
    }

    return {

      intent,
      reply,
      response: reply,
      citations,
      actions: validatedActions,
      requiresConfirmation,
      simulation: finalSimulation,
      semesterProjection,
    };
  }

  /**
   * Graceful fallback intent router when Gemini API is unavailable or offline
   */
  private static async fallbackProcess(query: string, context: CopilotContext): Promise<CopilotResponse> {
    const lower = query.toLowerCase();
    // Wall-clock Date (UTC fields = user's local fields) so relative dates are timezone-safe
    const localDate = this.toWallClock(context.localTime);

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
      let reportType = "weekly";
      if (/\b(semester|term)\b/i.test(lower)) reportType = "semester";
      else if (/\b(monthly|month)\b/i.test(lower)) reportType = "monthly";
      let reportTitle = reportType.charAt(0).toUpperCase() + reportType.slice(1) + " Attendance Report";
      let userEmail = context.userEmail || "";
      let userName = context.userName || "Student";
      if (context.userId) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: context.userId },
            select: { email: true, name: true },
          });
          if (user) {
            userEmail = user.email || userEmail;
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

      let reply = `I have prepared your ${reportType} attendance report summary.`;
      if (userEmail) {
        try {
          let mailRes: { success: boolean; data?: any; error?: any };
          if (reportType === "monthly") {
             mailRes = await EmailService.sendMonthlyReport(userEmail, userName, stats);
          } else if (reportType === "weekly") {
             mailRes = await EmailService.sendWeeklyReport(userEmail, userName, stats);
          } else {
             mailRes = await EmailService.sendCustomReport(userEmail, userName, stats, reportTitle);
          }
          if (mailRes?.success) {
            reply = `I have dispatched your detailed ${reportType} attendance report to ${userEmail}.`;
          } else {
            reply = `I prepared your ${reportType} report, but email delivery to ${userEmail} failed (${mailRes?.error?.message || 'Delivery error'}).`;
          }
        } catch (mailErr: any) {
          console.error("[CustomMlCopilotService] Error sending report email in fallback:", mailErr);
          reply = `I prepared your ${reportType} report, but an error occurred while emailing it.`;
        }
      } else {
        reply = `I prepared your ${reportType} attendance report, but no email address is linked to your account.`;
      }

      const action = this.createAction(
        "TRIGGER_REPORT",
        { email: userEmail, stats, type: reportType },
        userEmail ? `email:${userEmail}` : "user:report",
        `Send ${reportType} attendance report to ${userEmail || "registered email"}`,
        `Safe action: Dispatches ${reportType} attendance report email.`
      );

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
      let userEmail = context.userEmail || "";
      let userName = context.userName || "Student";
      if (context.userId) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: context.userId },
            select: { email: true, name: true },
          });
          if (user) {
            userEmail = user.email || userEmail;
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
          EmailService.sendFeedbackReceipt(userEmail, userName, feedbackData).catch(console.error);
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
    if (/^(navigate( to)?|open|go to|show me( my)?|view)\s+(timetable|schedule|settings|reports?|calendar|forecast|today|assignments?|peer sync|profile|devices|timeline|changelog|feedback|contact)/i.test(lower)) {
      let path = "/today";
      let title = "Today's Agenda";
      if (/(timetable|schedule|routine)/i.test(lower)) { path = "/timetable"; title = "Timetable"; }
      else if (/(profile|account)/i.test(lower)) { path = "/settings/profile"; title = "Profile Settings"; }
        else if (/(device|devices|sessions)/i.test(lower)) { path = "/settings/devices"; title = "Linked Devices"; }
        else if (/(peer|friends|sync)/i.test(lower)) { path = "/settings/peer-sync"; title = "Peer Sync Settings"; }
        else if (/(contact|help|support)/i.test(lower)) { path = "/settings/contact"; title = "Contact Us"; }
        else if (/(feedback|issue|bug)/i.test(lower)) {
          const extraDesc = query.replace(/^(navigate( to)?|open|go to|show me( my)?|view)\s+(?:the\s+)?(?:feedback|issue|bug)(?:\s+(?:screen|form|modal|page|tab))?(?:\s*(?:about|regarding|for|:)\s*)?/i, "").trim();
          if (extraDesc.length > 2) {
            path = `/settings/feedback?issue=${encodeURIComponent(extraDesc.slice(0, 60))}&description=${encodeURIComponent(extraDesc)}`;
          } else {
            path = "/settings/feedback";
          }
          title = "Feedback";
        }
        else if (/(changelog|update|history)/i.test(lower)) { path = "/settings/changelog"; title = "Update History"; }
        else if (/(timeline)/i.test(lower)) { path = "/semester/timeline"; title = "Timeline"; }
        else if (/(setting|settings|preference)/i.test(lower)) { path = "/settings"; title = "Settings"; }
      else if (/(report|reports|analytic|analytics)/i.test(lower)) { path = "/report"; title = "Attendance Reports"; }
      else if (/(calendar|event|events|academic)/i.test(lower)) { path = "/calendar"; title = "Academic Calendar"; }
      else if (/(predict|prediction|predictive)/i.test(lower)) { path = "/predictive"; title = "Predictive Forecast"; }
      
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
    if (/(what|how many)\s+(class|classes|lecture|lectures)/i.test(lower) || /(schedule|timetable)( today| tomorrow| on)?/i.test(lower) || /(my classes today|my classes tomorrow)/i.test(lower)) {
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
    if (/(swap|shift|move)\s+.*?(entire day|monday and|tuesday and|timetable)/i.test(lower) && !query.match(/lecture|class|slot/i)) {
      return {

        intent: "SHIFT_TIMETABLE",
        reply: "I cannot bulk-shift or swap entire days of the timetable at once. Please use the drag-and-drop Timetable UI for bulk changes, or ask me to move a specific subject's slot.",
        response: "I cannot bulk-shift or swap entire days of the timetable at once. Please use the drag-and-drop Timetable UI for bulk changes, or ask me to move a specific subject's slot.",
        citations: [],
        actions: [],
        requiresConfirmation: false,
      };
    }

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
    if (/(update my|mark( my)?|set( my)?|record( my)?)\s+.*?(attendance|present|absent|medical|on duty|off|leave)/i.test(lower) || /(full day off|day off|not going|bunking)/i.test(lower)) {
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
      let dateStr = this.extractDate(lower, localDate);
      {
        // A bare weekday ("mark me absent wednesday") means the most recent one on/before today.
        const rel = this.resolveRelativeDate(lower, localDate);
        const hasModifier = /\b(next|coming|upcoming|this|current|last|previous|prev)\b/.test(lower);
        if (rel.kind === "weekday" && !hasModifier) {
          const todayStr = this.resolveRelativeDate("today", localDate).dateStr;
          if (rel.dateStr > todayStr) {
            const [y, m, d] = rel.dateStr.split("-").map(Number);
            const back = new Date(Date.UTC(y, m - 1, d - 7));
            dateStr = `${back.getUTCFullYear()}-${String(back.getUTCMonth() + 1).padStart(2, "0")}-${String(back.getUTCDate()).padStart(2, "0")}`;
          }
        }
      }
      let status = "present";
      if (/\b(medical|sick)\b/i.test(lower)) status = "medical";
      else if (/\b(on duty|duty|od)\b/i.test(lower)) status = "od";
      else if (/\b(absent|missed|miss|not going|bunking)\b/i.test(lower)) status = "absent";
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

    // 11. ADD_EXTRA_CLASS
    if (/(add|schedule|create)\s+.*?(makeup|extra|additional)\s+(class|lecture|lab|practical)/i.test(lower)) {
      const resolvedSubject = this.resolveSubject(query, context.subjects || []);
      const dateStr = this.extractDate(lower, localDate);
      const timeMatch = this.extractTime(lower);
      
      let startTime = timeMatch.startTime !== "00:00" ? timeMatch.startTime : "10:00";
      let endTime = timeMatch.endTime !== "00:00" ? timeMatch.endTime : "10:50"; // Default 50 mins
      
      if (/(lab|practical)/i.test(lower) && timeMatch.endTime === "00:00") {
         // Default 100 mins for lab
         let [h, m] = startTime.split(':').map(Number);
         m += 100;
         h += Math.floor(m / 60);
         m = m % 60;
         endTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }

      const reply = `I've staged the addition of the makeup class for ${resolvedSubject.name} on ${dateStr} at ${startTime}. Please confirm.`;
      const action = this.createAction(
        "ADD_EXTRA_CLASS",
        { subjectId: resolvedSubject.id, date: dateStr, startTime, endTime, reason: "Makeup Class" },
        `subject:${resolvedSubject.name}`,
        `Add makeup class for ${resolvedSubject.name} on ${dateStr} from ${startTime} to ${endTime}`,
        `Destructive action: Adds a new class to your schedule.`
      );
      return {

        intent: "ADD_EXTRA_CLASS",
        reply,
        response: reply,
        citations: [],
        actions: [action],
        requiresConfirmation: true,
      };
    }


    // 15. ADD_TIMETABLE_SLOT
    if (/(add|schedule|create)\s+.*?(slot|class|lecture)\s+.*?(on monday|on tuesday|on wednesday|on thursday|on friday)/i.test(lower)) {
      const resolvedSubject = this.resolveSubject(query, context.subjects || []);
      const dayMatch = this.extractDayOfWeek(lower, localDate);
      const timeMatch = this.extractTime(lower);
      
      let startTime = timeMatch.startTime !== "00:00" ? timeMatch.startTime : "10:00";
      let endTime = timeMatch.endTime !== "00:00" ? timeMatch.endTime : "10:50"; // Default 50 mins
      
      const reply = `I've staged the addition of a new ${resolvedSubject.name} slot on ${dayMatch.dayName} at ${startTime}. Please confirm.`;
      const action = this.createAction(
        "ADD_TIMETABLE_SLOT",
        { subjectId: resolvedSubject.id, dayOfWeek: dayMatch.dayIndex, startTime, endTime, slotType: "lecture" },
        `subject:${resolvedSubject.name}`,
        `Add slot for ${resolvedSubject.name} on ${dayMatch.dayName} at ${startTime}`,
        `Destructive action: Adds a new recurring weekly slot.`
      );
      return {

        intent: "ADD_TIMETABLE_SLOT",
        reply,
        response: reply,
        citations: [],
        actions: [action],
        requiresConfirmation: true,
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
    if (subjects && subjects.length > 0) {
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

      id: "unknown_subject", // AI-H03 FIX: Clear string ID instead of null
      name: "Enrolled Course",
      target: 75,
      attended: 20,
      total: 25,
    };
  }

  public static extractSubject = CustomMlCopilotService.resolveSubject;

  /**
   * Convert the client's `localTime` string into a "wall-clock" Date: a Date whose UTC fields
   * (getUTCFullYear/getUTCDate/getUTCHours...) equal the user's local calendar fields.
   * This keeps "today / tomorrow / next Wednesday" correct no matter which timezone the server runs in
   * (e.g. 12:30 AM IST is still the previous day on a UTC server).
   */
  public static toWallClock(localTime?: string | Date): Date {
    const instant = localTime ? new Date(localTime as any) : new Date();
    if (isNaN(instant.getTime())) return this.toWallClock();
    let offsetMin: number | null = null;
    if (typeof localTime === "string") {
      const m = localTime.match(/GMT([+-])(\d{2}):?(\d{2})/i) || localTime.match(/([+-])(\d{2}):?(\d{2})\s*$/);
      if (m) offsetMin = (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
      else if (/Z\s*$/i.test(localTime)) offsetMin = 0;
    }
    if (offsetMin === null) offsetMin = -instant.getTimezoneOffset();
    return new Date(instant.getTime() + offsetMin * 60000);
  }

  /**
   * Resolve relative / absolute date phrases against a wall-clock "now".
   * Supports: today, tonight, tomorrow, yesterday, day after tomorrow, day before yesterday,
   * in N days/weeks, N days/weeks ago, this/current/next/last/previous <weekday>,
   * <weekday> next/last/this week, next week, last week, "27 oct", "oct 27th", YYYY-MM-DD,
   * and a bare <weekday> (nearest upcoming, today counts).
   * Week semantics are Monday-Sunday calendar weeks: "next Wednesday" = Wednesday of next week,
   * "last Wednesday" = Wednesday of last week, "this/current Wednesday" = Wednesday of this week.
   */
  public static resolveRelativeDate(
    lower: string,
    wall: Date = new Date(),
    weekdayFirst = false
  ): { dateStr: string; dayIndex: number; dayName: string; friendly: string; matched: boolean; kind: string } {
    const pad = (n: number) => String(n).padStart(2, "0");
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const base = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()));
    const shift = (days: number) => {
      const x = new Date(base.getTime());
      x.setUTCDate(x.getUTCDate() + days);
      return x;
    };
    const todayIdx = (base.getUTCDay() + 6) % 7;
    const wd = "(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|wed|thu(?:rs?)?|fri)";
    const dayIdxOf = (w: string): number => ({ mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 } as Record<string, number>)[w.slice(0, 3)];
    const numWords: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };
    const toNum = (s: string) => (/^\d+$/.test(s) ? parseInt(s, 10) : numWords[s] ?? 1);
    const monthRe = "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)";
    const monthIdxOf = (m: string): number => ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m.slice(0, 3));

    let result: Date | null = null;
    let kind = "none";

    const iso = lower.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (iso) {
      result = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
      kind = "iso";
    }
    if (!result) {
      const dm = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthRe}\\b`));
      const md = lower.match(new RegExp(`\\b${monthRe}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
      if (dm) {
        result = new Date(Date.UTC(base.getUTCFullYear(), monthIdxOf(dm[2]), +dm[1]));
        kind = "monthday";
      } else if (md) {
        result = new Date(Date.UTC(base.getUTCFullYear(), monthIdxOf(md[1]), +md[2]));
        kind = "monthday";
      }
    }
    if (!result && /\b(day after tomorrow|overmorrow|parso)\b/.test(lower)) { result = shift(2); kind = "relative"; }
    if (!result && /\bday before yesterday\b/.test(lower)) { result = shift(-2); kind = "relative"; }
    if (!result) {
      const inN = lower.match(/\bin\s+(\d+|an?|one|two|three|four|five|six|seven|ten)\s+(day|days|week|weeks)\b/);
      const agoN = lower.match(/\b(\d+|an?|one|two|three|four|five|six|seven|ten)\s+(day|days|week|weeks)\s+ago\b/);
      if (inN) { result = shift(toNum(inN[1]) * (inN[2].startsWith("week") ? 7 : 1)); kind = "relative"; }
      else if (agoN) { result = shift(-toNum(agoN[1]) * (agoN[2].startsWith("week") ? 7 : 1)); kind = "relative"; }
    }

    const weekdayModifier = (): Date | null => {
      const m1 = lower.match(new RegExp(`\\b(next|last|previous|prev|this|current|coming|upcoming)\\s+(?:week(?:'s)?\\s+)?${wd}\\b`));
      const m2 = lower.match(new RegExp(`\\b${wd}\\s+(?:of\\s+)?(next|last|previous|this|current)\\s+week\\b`));
      let mod: string | null = null;
      let idx = -1;
      if (m1) { mod = m1[1]; idx = dayIdxOf(m1[2]); }
      else if (m2) { mod = m2[2]; idx = dayIdxOf(m2[1]); }
      if (!mod || idx < 0) return null;
      if (mod === "coming" || mod === "upcoming") return shift(((idx - todayIdx + 7) % 7) || 7);
      const weekOffset = mod === "next" ? 1 : /^(last|previous|prev)$/.test(mod) ? -1 : 0;
      return shift(-todayIdx + weekOffset * 7 + idx);
    };
    const bareWeekday = (): Date | null => {
      const m = lower.match(new RegExp(`\\b${wd}\\b`));
      if (!m) return null;
      return shift((dayIdxOf(m[1]) - todayIdx + 7) % 7);
    };

    if (!result) {
      const r = weekdayModifier();
      if (r) { result = r; kind = "weekday"; }
    }
    if (!result && weekdayFirst) {
      const r = bareWeekday();
      if (r) { result = r; kind = "weekday"; }
    }
    if (!result) {
      if (/\b(tomorrow|tmrw|tmr|tomorow)\b/.test(lower)) { result = shift(1); kind = "relative"; }
      else if (/\b(yesterday|yday)\b/.test(lower)) { result = shift(-1); kind = "relative"; }
      else if (/\b(today|tonight|aaj)\b/.test(lower)) { result = shift(0); kind = "relative"; }
    }
    if (!result) {
      const r = bareWeekday();
      if (r) { result = r; kind = "weekday"; }
    }
    if (!result) {
      if (/\bnext week\b/.test(lower)) { result = shift(7); kind = "week"; }
      else if (/\b(last|previous) week\b/.test(lower)) { result = shift(-7); kind = "week"; }
    }

    const matched = result !== null;
    const finalDate = result || base;
    const dayIndex = (finalDate.getUTCDay() + 6) % 7;
    return {
      dateStr: `${finalDate.getUTCFullYear()}-${pad(finalDate.getUTCMonth() + 1)}-${pad(finalDate.getUTCDate())}`,
      dayIndex,
      dayName: dayNames[dayIndex],
      friendly: `${dayNames[dayIndex]}, ${finalDate.getUTCDate()} ${monthShort[finalDate.getUTCMonth()]} ${finalDate.getUTCFullYear()}`,
      matched,
      kind,
    };
  }

  /**
   * Parse a clock time such as "9am", "9:30 pm", "18:45", "at 7", "noon", "midnight".
   */
  public static parseClockTime(lower: string): { hour: number; minute: number } | null {
    if (/\bnoon\b/.test(lower)) return { hour: 12, minute: 0 };
    if (/\bmidnight\b/.test(lower)) return { hour: 0, minute: 0 };
    const withMin = lower.match(/\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?/);
    const withMeridiem = lower.match(/\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/);
    const bareAt = lower.match(/\bat\s+(\d{1,2})\b(?!\s*(?:minutes?|mins?|hours?|hrs?|days?|weeks?|%|st|nd|rd|th))/);
    let h: number;
    let m = 0;
    let mer: string | undefined;
    if (withMin) { h = +withMin[1]; m = +withMin[2]; mer = withMin[3]; }
    else if (withMeridiem) { h = +withMeridiem[1]; mer = withMeridiem[2]; }
    else if (bareAt) { h = +bareAt[1]; }
    else return null;
    if (mer) {
      const isPm = mer.toLowerCase().startsWith("p");
      if (isPm && h < 12) h += 12;
      if (!isPm && h === 12) h = 0;
    }
    if (h > 23 || m > 59) return null;
    return { hour: h, minute: m };
  }

  /**
   * Parse "in 5 minutes", "in 2 hours", "after 30 mins" into minutes from now.
   */
  public static parseOffsetMinutes(lower: string): number | null {
    const numWords: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10, fifteen: 15, twenty: 20, thirty: 30 };
    const m = lower.match(/\b(?:in|after)\s+(\d+|an?|one|two|three|four|five|six|ten|fifteen|twenty|thirty)\s*(minutes?|mins?|hours?|hrs?)\b/);
    if (!m) return null;
    const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : numWords[m[1]];
    return m[2].startsWith("h") ? n * 60 : n;
  }

  /**
   * Detects a recurring summary schedule inside a report request.
   * Returns null when the user gave no time/day (so nothing in Settings is changed behind their back).
   * Maps to the client's existing SAFE actions: CHANGE_REMINDER_FREQUENCY + CHANGE_SUMMARY_TIME + NAVIGATE.
   */
  public static parseReportSchedule(
    lower: string,
    wall: Date
  ): null | {
    frequency: "Daily" | "Weekly" | "Monthly";
    subValue?: string;
    time?: string;
    actions: ActionPayload[];
    reply: string;
  } {
    let frequency: "Daily" | "Weekly" | "Monthly" | null = null;
    if (/\b(monthly|month)\b/.test(lower) && !/\b(last|previous|past|this)\s+month\b/.test(lower)) frequency = "Monthly";
    else if (/\b(daily|every\s*day|each\s*day)\b/.test(lower)) frequency = "Daily";
    else if (/\b(weekly|week)\b/.test(lower) && !/\b(last|previous|past|this)\s+week\b/.test(lower)) frequency = "Weekly";
    if (!frequency) return null;

    const offset = this.parseOffsetMinutes(lower);
    const clock = this.parseClockTime(lower);
    const rel = this.resolveRelativeDate(lower, wall, true);
    const everyDay = lower.match(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    const domMatch = frequency === "Monthly" ? lower.match(/\b([0-3]?\d)(?:st|nd|rd|th)\b/) : null;
    const hasDateSpec = (rel.matched && rel.kind !== "week") || (domMatch !== null && +domMatch[1] >= 1 && +domMatch[1] <= 31);
    if (offset === null && !clock && !hasDateSpec && !everyDay) return null;

    const pad = (n: number) => String(n).padStart(2, "0");
    const dayAbbr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const to12hLabel = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
    };

    // Only a clock time was given (no day/date/offset): change the time, leave the saved day alone.
    if (offset === null && !hasDateSpec && !everyDay && clock) {
      const onlyTime = `${pad(clock.hour)}:${pad(clock.minute)}`;
      const timeActions: ActionPayload[] = [
        this.createAction(
          "CHANGE_SUMMARY_TIME",
          { time: onlyTime, bracket: frequency },
          "settings:summary-time",
          `Set ${frequency.toLowerCase()} summary time to ${to12hLabel(onlyTime)}`,
          "Safe action: Updates your summary time."
        ),
        this.createAction("NAVIGATE", { path: "/settings" }, "route:/settings", "Open Settings", "Safe navigation action: opens Settings."),
      ];
      const timeReply = `Done. Your ${frequency.toLowerCase()} attendance summary time is now **${to12hLabel(onlyTime)}**${
        frequency === "Daily"
          ? ""
          : frequency === "Monthly"
            ? " (the day of the month is unchanged; tell me one like \"on the 15th\" to change it)"
            : " (the day is unchanged; tell me a day like \"every Friday\" to change it)"
      }. Opening Settings so you can check it.`;
      return { frequency, time: onlyTime, actions: timeActions, reply: timeReply };
    }

    let target: Date; // wall-clock Date (UTC fields = local fields)
    let timeStr: string | undefined;
    if (offset !== null) {
      target = new Date(wall.getTime() + offset * 60000);
      timeStr = `${pad(target.getUTCHours())}:${pad(target.getUTCMinutes())}`;
    } else {
      const dayPart = everyDay ? this.resolveRelativeDate(everyDay[0], wall, true) : rel;
      let [yy, mm, dd] = dayPart.dateStr.split("-").map(Number);
      if (domMatch && !rel.matched) {
        // "on the 15th" for a monthly schedule: day-of-month only
        yy = wall.getUTCFullYear();
        mm = wall.getUTCMonth() + 1;
        dd = +domMatch[1];
      }
      target = new Date(Date.UTC(yy, mm - 1, dd, clock ? clock.hour : 0, clock ? clock.minute : 0));
      if (clock) timeStr = `${pad(clock.hour)}:${pad(clock.minute)}`;
    }

    const targetDayIdx = (target.getUTCDay() + 6) % 7;
    const to12h = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      const suffix = h >= 12 ? "PM" : "AM";
      return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${suffix}`;
    };
    const ordinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const dateLabel = `${dayNames[targetDayIdx]}, ${target.getUTCDate()} ${monthShort[target.getUTCMonth()]} ${target.getUTCFullYear()}`;

    let subValue: string | undefined;
    let cadence: string;
    if (frequency === "Weekly") {
      subValue = dayAbbr[target.getUTCDay()];
      cadence = `every ${dayNames[targetDayIdx]}`;
    } else if (frequency === "Monthly") {
      subValue = String(target.getUTCDate());
      cadence = `on the ${ordinal(target.getUTCDate())} of every month`;
    } else {
      cadence = "every day";
    }

    const actions: ActionPayload[] = [
      this.createAction(
        "CHANGE_REMINDER_FREQUENCY",
        { frequency, ...(subValue ? { subValue } : {}) },
        "settings:reminder-frequency",
        `Set ${frequency.toLowerCase()} summary${subValue ? ` (${subValue})` : ""}`,
        "Safe action: Updates your summary frequency."
      ),
    ];
    if (timeStr) {
      actions.push(
        this.createAction(
          "CHANGE_SUMMARY_TIME",
          { time: timeStr, bracket: frequency },
          "settings:summary-time",
          `Set ${frequency.toLowerCase()} summary time to ${to12h(timeStr)}`,
          "Safe action: Updates your summary time."
        )
      );
    }
    actions.push(this.createAction("NAVIGATE", { path: "/settings" }, "route:/settings", "Open Settings", "Safe navigation action: opens Settings."));

    const whenText =
      frequency === "Monthly"
        ? timeStr
          ? `**the ${ordinal(target.getUTCDate())} of every month at ${to12h(timeStr)}**`
          : `**the ${ordinal(target.getUTCDate())} of every month**`
        : timeStr
          ? `**${dateLabel} at ${to12h(timeStr)}**`
          : `**${dateLabel}**`;
    const reply =
      frequency === "Monthly"
        ? `Done. Your monthly attendance summary is now scheduled for ${whenText}${timeStr ? "" : " at your saved summary time"}. Opening Settings so you can check it.`
        : `Done. Your ${frequency.toLowerCase()} attendance summary is now scheduled for ${whenText}, repeating ${cadence}${
            timeStr ? "" : " at your saved summary time"
          }. Opening Settings so you can check it.`;

    return { frequency, subValue, time: timeStr, actions, reply };
  }

  /**
   * Builds a deterministic date lookup table for the LLM so relative phrases are never guessed.
   */
  public static buildDateReferenceBlock(query: string, localTime?: string): string {
    const wall = this.toWallClock(localTime);
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const at = (phrase: string) => this.resolveRelativeDate(phrase, wall);
    const fmt = (r: { dateStr: string; dayName: string }) => `${r.dateStr} (${r.dayName})`;
    const lines: string[] = [
      "[DATE REFERENCE - authoritative, resolve every relative date from this table, never guess]",
      `Today: ${fmt(at("today"))}`,
      `Tomorrow: ${fmt(at("tomorrow"))}`,
      `Yesterday: ${fmt(at("yesterday"))}`,
      `Day after tomorrow: ${fmt(at("day after tomorrow"))}`,
      `Day before yesterday: ${fmt(at("day before yesterday"))}`,
      `Next week (same weekday): ${fmt(at("next week"))}`,
      `Last week (same weekday): ${fmt(at("last week"))}`,
    ];
    for (const d of dayNames) {
      const n = d.toLowerCase();
      const upcoming = at(n);
      const past = at(`this ${n}`);
      lines.push(`${d}: this week=${past.dateStr}, last week=${at(`last ${n}`).dateStr}, next week=${at(`next ${n}`).dateStr}, nearest upcoming (today counts)=${upcoming.dateStr}`);
    }
    lines.push("Week = Monday-Sunday. 'this/current <day>' = this week's; 'next <day>' = next week's; 'last/previous <day>' = last week's; 'coming/upcoming <day>' = this week's if that day is still ahead, or next week's if today is that day or already past it.");
    lines.push("A bare weekday with no modifier for marking/removing attendance = the most recent occurrence on or before today.");
    const resolved = this.resolveRelativeDate(query.toLowerCase(), wall, true);
    if (resolved.matched) {
      lines.push(`Date phrase detected in the user's message resolves to: ${resolved.dateStr} (${resolved.friendly})`);
    }
    const offset = this.parseOffsetMinutes(query.toLowerCase());
    if (offset !== null) {
      const t = new Date(wall.getTime() + offset * 60000);
      const pad = (n: number) => String(n).padStart(2, "0");
      lines.push(`"in ${offset} minutes" resolves to: ${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())} (local time)`);
    }
    return lines.join("\n");
  }

  /**
   * Extract target date (YYYY-MM-DD). `localDate` must be a wall-clock Date from toWallClock().
   */
  public static extractDate(lower: string, localDate: Date = this.toWallClock()): string {
    return this.resolveRelativeDate(lower, localDate).dateStr;
  }

  /**
   * Extract day of week index (0=Mon ... 6=Sun)
   */
  public static extractDayOfWeek(lower: string, localDate: Date = this.toWallClock()): { dayIndex: number; dayName: string } {
    // weekdayFirst: for recurring slots an explicit weekday name wins over "today/tomorrow"
    const r = this.resolveRelativeDate(lower, localDate, true);
    return { dayIndex: r.dayIndex, dayName: r.dayName };
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

    return {
 startTime, endTime };
  }
}


