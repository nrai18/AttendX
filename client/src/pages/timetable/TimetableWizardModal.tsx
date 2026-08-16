import React, { useState, useMemo } from "react";
import {
  Loader2,
  Wand2,
  BookOpen,
  FlaskConical,
  Sparkles,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Layers,
  Users,
  Calendar,
} from "lucide-react";
import {
  COURSE_CURRICULUM,
  resolveSubjectName,
  BRANCH_NAMES,
} from "../../utils/subjectDictionary";
import { formatTimeRange, normalizeTimeString } from "../../utils/timeUtils";

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (selections: any) => Promise<void>;
  setupPayload: any;
}

export interface WizardElectiveOption {
  code: string;
  title: string;
  category: string;
  credits: number;
}

export const TimetableWizardModal: React.FC<WizardProps> = ({
  isOpen,
  onClose,
  onGenerate,
  setupPayload,
}) => {
  const [step, setStep] = useState<number>(1);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [selectedSection, setSelectedSection] = useState<string>("Section A");
  const [selectedLabGroup, setSelectedLabGroup] = useState<string>("G1");
  const [selectedElectives, setSelectedElectives] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Term mode (Jul-Dec => odd semesters 1,3,5,7; Jan-Jun => even semesters 2,4,6,8)
  const isJulToDec = new Date().getMonth() >= 6;
  const [termType, setTermType] = useState<"odd" | "even">(
    isJulToDec ? "odd" : "even",
  );

  // Available branches & semesters from OCR setupPayload or defaults
  const detectedBranches: string[] = useMemo(
    () => setupPayload?.detectedBranches || ["CSE", "IT", "ECE", "CY", "DS"],
    [setupPayload],
  );
  const detectedSemesters: number[] = useMemo(
    () => setupPayload?.detectedSemesters || [1, 2, 3, 4, 5, 6, 7, 8],
    [setupPayload],
  );

  // Filter semesters by active termType (odd vs even)
  const filteredSemesters = useMemo(() => {
    if (termType === "odd") {
      const odds = detectedSemesters.filter((s) => s % 2 !== 0);
      return odds.length > 0 ? odds : [1, 3, 5, 7];
    } else {
      const evens = detectedSemesters.filter((s) => s % 2 === 0);
      return evens.length > 0 ? evens : [2, 4, 6, 8];
    }
  }, [detectedSemesters, termType]);

  // Keep selected semester in sync with filteredSemesters
  React.useEffect(() => {
    if (
      filteredSemesters.length > 0 &&
      !filteredSemesters.includes(selectedSemester)
    ) {
      setSelectedSemester(filteredSemesters[0]);
    }
  }, [termType, filteredSemesters]);

  // Set default selected branch & semester whenever setupPayload changes
  React.useEffect(() => {
    if (setupPayload) {
      const branches = setupPayload.detectedBranches || [
        "CSE",
        "IT",
        "ECE",
        "CY",
        "DS",
      ];
      const sems = setupPayload.detectedSemesters || [1, 2, 3, 4, 5, 6, 7, 8];
      if (branches.length > 0) {
        setSelectedBranch(branches[0]);
      }
      if (sems.length > 0) {
        setSelectedSemester(Number(sems[0]));
      }
      setStep(1);
    }
  }, [setupPayload]);

  // Get current schedule info for the chosen branch and semester
  const currentSchedule = useMemo(() => {
    if (!setupPayload?.schedules) return null;
    const branchKey = selectedBranch || detectedBranches[0];
    const semKey = selectedSemester || detectedSemesters[0];
    const branchData = setupPayload.schedules[branchKey];
    if (!branchData) return null;
    return branchData[semKey] || branchData[String(semKey)] || null;
  }, [
    setupPayload,
    selectedBranch,
    selectedSemester,
    detectedBranches,
    detectedSemesters,
  ]);

  // Extract ALL electives available for this branch & semester dynamically
  const allElectives = useMemo<WizardElectiveOption[]>(() => {
    const list: WizardElectiveOption[] = [];
    const seen = new Set<string>();

    const addOption = (
      code: string,
      rawTitle?: string,
      category = "Program Elective",
      credits = 4,
    ) => {
      const clean = (code || "").replace(/\s*\([LPT]\)/gi, "").trim();
      if (!clean || seen.has(clean.toUpperCase())) return;
      seen.add(clean.toUpperCase());
      const title = rawTitle || resolveSubjectName(clean) || clean;
      list.push({ code: clean, title, category, credits });
    };

    // 1. Check currentSchedule.electives list
    if (Array.isArray(currentSchedule?.electives)) {
      for (const el of currentSchedule.electives) {
        addOption(
          el.code,
          el.title,
          el.category || "Elective",
          el.credits || 4,
        );
      }
    }

    // 2. Check programElectives groups
    if (Array.isArray(currentSchedule?.programElectives)) {
      for (const grp of currentSchedule.programElectives) {
        const cat = grp.name || "Program Elective";
        if (Array.isArray(grp.options)) {
          for (const opt of grp.options) {
            addOption(opt.code, opt.title, cat, opt.credits || 4);
          }
        }
      }
    }

    // 3. Check minorElectives groups
    if (Array.isArray(currentSchedule?.minorElectives)) {
      for (const grp of currentSchedule.minorElectives) {
        const cat = grp.name || "Minor / Open Elective";
        if (Array.isArray(grp.options)) {
          for (const opt of grp.options) {
            addOption(opt.code, opt.title, cat, opt.credits || 3);
          }
        }
      }
    }

    // 4. Scan rawSlots for elective tags or parallel tracks
    const slots = currentSchedule?.rawSlots || setupPayload?.rawSlots || [];
    for (const slot of slots) {
      if (slot.isProgramElective) {
        addOption(slot.code, slot.name, "Program Elective", 4);
      } else if (slot.isMinorElective) {
        addOption(slot.code, slot.name, "Minor / Open Elective", 3);
      } else if (slot.isElective) {
        addOption(slot.code, slot.name, "Elective", 4);
      }
    }

    // 5. If nothing detected and semester >= 5, scan curriculum dictionary for electives in this branch
    if (list.length === 0 && selectedSemester >= 5) {
      const branchPrefix = selectedBranch
        ? selectedBranch.toUpperCase().slice(0, 2)
        : "CS";
      Object.keys(COURSE_CURRICULUM).forEach((code) => {
        if (
          code.startsWith(`${branchPrefix}SE3`) ||
          code.startsWith("SCMS3") ||
          code.startsWith("SEMS3")
        ) {
          const isMinor = code.startsWith("SCMS") || code.startsWith("SEMS");
          addOption(
            code,
            COURSE_CURRICULUM[code],
            isMinor ? "Minor / Open Elective" : "Program Elective",
            isMinor ? 3 : 4,
          );
        }
      });
    }

    return list;
  }, [currentSchedule, setupPayload, selectedBranch, selectedSemester]);

  // Check if current semester has electives
  const isElectiveSem =
    selectedSemester >= 5 ||
    allElectives.length > 0 ||
    Boolean(currentSchedule?.hasElectives);

  // Check if section or lab group exists for current branch/semester
  const hasSections =
    Boolean(currentSchedule?.hasSections) ||
    (currentSchedule?.sections && currentSchedule.sections.length > 0) ||
    selectedSemester <= 4;
  const sectionsList =
    currentSchedule?.sections && currentSchedule.sections.length > 0
      ? currentSchedule.sections
      : ["Section A", "Section B"];
  const labGroupsList =
    currentSchedule?.labGroups && currentSchedule.labGroups.length > 0
      ? currentSchedule.labGroups
      : ["G1", "G2"];

  // Initialize selections when schedule changes
  React.useEffect(() => {
    if (currentSchedule) {
      if (sectionsList.length > 0) setSelectedSection(sectionsList[0]);
      if (labGroupsList.length > 0) setSelectedLabGroup(labGroupsList[0]);
    }
    // Pre-select all detected electives by default so user can uncheck or keep all
    if (allElectives.length > 0) {
      setSelectedElectives(allElectives.map((e) => e.code));
    } else {
      setSelectedElectives([]);
    }
  }, [selectedBranch, selectedSemester, currentSchedule, allElectives]);

  // Helper: Match lab group accurately (G1, G2, G1/G2, BOTH, ALL)
  const isGroupMatch = (
    slotGroup: string | undefined,
    userGroup: string | undefined,
  ) => {
    if (!slotGroup || slotGroup === "ALL" || !userGroup || userGroup === "ALL")
      return true;
    const normSlot = String(slotGroup).toUpperCase().replace(/\s+/g, "");
    const normUser = String(userGroup).toUpperCase().replace(/\s+/g, "");

    // Both groups share this lab (e.g. G1/G2, G1,G2, G1&G2, BOTH, ALL)
    if (
      normSlot.includes("G1/G2") ||
      normSlot.includes("G1,G2") ||
      normSlot.includes("G1&G2") ||
      normSlot.includes("BOTH") ||
      normSlot === "ALL"
    ) {
      return true;
    }

    // Group G1 student: matches G1 (and excludes G2-only)
    if (normUser === "G1") {
      return normSlot.includes("G1") && !normSlot.includes("G2");
    }

    // Group G2 student: matches G2 (and excludes G1-only)
    if (normUser === "G2") {
      return normSlot.includes("G2") && !normSlot.includes("G1");
    }

    return normSlot.includes(normUser);
  };

  // Filter preview slots for step 4
  const previewSlots = useMemo(() => {
    const allSlots = currentSchedule?.rawSlots || setupPayload?.rawSlots || [];
    const electiveCodesSet = new Set(
      allElectives.map((e) => e.code.toUpperCase()),
    );
    for (const slot of allSlots) {
      if (slot.isProgramElective || slot.isMinorElective || slot.isElective) {
        electiveCodesSet.add(
          slot.code
            .replace(/\s*\([LPT]\)/gi, "")
            .trim()
            .toUpperCase(),
        );
      }
    }

    return allSlots.filter((slot: any) => {
      if (
        hasSections &&
        slot.section &&
        slot.section !== "ALL" &&
        selectedSection &&
        selectedSection !== "ALL" &&
        slot.section !== selectedSection
      ) {
        return false;
      }
      if (!isGroupMatch(slot.group, selectedLabGroup)) {
        return false;
      }

      const cleanCode = (slot.code || "")
        .replace(/\s*\([LPT]\)/gi, "")
        .trim()
        .toUpperCase();
      const isElective =
        slot.isProgramElective ||
        slot.isMinorElective ||
        slot.isElective ||
        electiveCodesSet.has(cleanCode);

      if (isElectiveSem && isElective && selectedElectives.length > 0) {
        if (
          !selectedElectives.map((c) => c.toUpperCase()).includes(cleanCode)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    currentSchedule,
    setupPayload,
    selectedSection,
    hasSections,
    selectedLabGroup,
    isElectiveSem,
    selectedElectives,
    allElectives,
  ]);

  // Elective Selection Toggles
  const handleToggleElective = (code: string) => {
    setSelectedElectives((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleSelectAllElectives = () => {
    setSelectedElectives(allElectives.map((e) => e.code));
  };

  const handleDeselectAllElectives = () => {
    setSelectedElectives([]);
  };

  // Group electives by category for clean UI organization
  const groupedElectives = useMemo(() => {
    const groups: Record<string, WizardElectiveOption[]> = {};
    for (const el of allElectives) {
      const cat = el.category || "Elective Courses";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(el);
    }
    return groups;
  }, [allElectives]);

  // Step Navigation Helpers
  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (isElectiveSem && allElectives.length > 0) {
        setStep(3);
      } else {
        setStep(4);
      }
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handlePrevStep = () => {
    if (step === 4) {
      if (isElectiveSem && allElectives.length > 0) {
        setStep(3);
      } else {
        setStep(2);
      }
    } else if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      setStep(1);
    }
  };

  const handleSubmit = async () => {
    setIsGenerating(true);
    try {
      if (selectedLabGroup) {
        localStorage.setItem("user_group", selectedLabGroup);
        localStorage.setItem("user_lab_group", selectedLabGroup);
        window.dispatchEvent(
          new CustomEvent("group-preference-updated", {
            detail: selectedLabGroup,
          }),
        );
      }

      // Find raw slots for this branch & semester
      const rawSlots =
        currentSchedule?.rawSlots || setupPayload?.rawSlots || [];

      await onGenerate({
        branch: selectedBranch,
        semester: selectedSemester,
        section: hasSections ? selectedSection : "ALL",
        labGroup: selectedLabGroup,
        selectedElectiveCodes: selectedElectives,
        selectedElectives: selectedElectives,
        programElectiveCode: selectedElectives[0] || "",
        minorElectiveCode: selectedElectives[1] || "",
        rawSlots,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen || !setupPayload) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header gradient bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

        {/* Top Header */}
        <div className="p-6 pb-4 border-b border-border/60 flex justify-between items-center bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-2xl border border-blue-500/20">
              <Wand2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Timetable Setup Wizard
              </h2>
              <p className="text-xs text-muted-foreground">
                Customize your schedule after timetable OCR upload
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Stepper Bar */}
        <div className="px-6 py-3 bg-muted/40 border-b border-border/40 flex items-center justify-between text-xs font-medium">
          <div
            className={`flex items-center gap-1.5 ${step >= 1 ? "text-blue-500 font-bold" : "text-muted-foreground"}`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center ${step >= 1 ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"}`}
            >
              1
            </span>
            <span>Branch & Semester</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />

          <div
            className={`flex items-center gap-1.5 ${step >= 2 ? "text-blue-500 font-bold" : "text-muted-foreground"}`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center ${step >= 2 ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"}`}
            >
              2
            </span>
            <span>Lab Group & Section</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />

          <div
            className={`flex items-center gap-1.5 ${step >= 3 ? "text-blue-500 font-bold" : "text-muted-foreground"} ${!isElectiveSem ? "opacity-50" : ""}`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center ${step >= 3 ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"}`}
            >
              3
            </span>
            <span>Electives {isElectiveSem ? "" : "(Sem 5+)"}</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />

          <div
            className={`flex items-center gap-1.5 ${step === 4 ? "text-blue-500 font-bold" : "text-muted-foreground"}`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center ${step === 4 ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"}`}
            >
              4
            </span>
            <span>Confirm</span>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
          {/* STEP 1: Branch & Semester Selection */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Term Mode Toggle */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-500" />
                    Academic Term Mode
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                    {termType === "odd"
                      ? "Odd Semesters Active"
                      : "Even Semesters Active"}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2 bg-muted/50 p-1.5 rounded-2xl border border-border/60">
                  <button
                    type="button"
                    onClick={() => setTermType("odd")}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      termType === "odd"
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>Jul – Dec (Odd: 1, 3, 5, 7)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTermType("even")}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      termType === "even"
                        ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>Jan – Jun (Even: 2, 4, 6, 8)</span>
                  </button>
                </div>
              </div>

              {/* Branch Selector */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-500" />
                  Select Your Branch / Department
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {detectedBranches.map((b: string) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setSelectedBranch(b)}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedBranch === b
                          ? "bg-blue-500/10 border-blue-500 text-foreground ring-2 ring-blue-500/20 shadow-sm"
                          : "bg-muted/30 border-border text-muted-foreground hover:border-border hover:bg-muted/60"
                      }`}
                    >
                      <div className="text-sm font-bold text-foreground">
                        {b}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {BRANCH_NAMES[b] || b}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Semester Selector */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-500" />
                  Select Your Semester (
                  {termType === "odd" ? "Odd Semesters" : "Even Semesters"})
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {filteredSemesters.map((sem: number) => {
                    const isElective = sem >= 5;
                    return (
                      <button
                        key={sem}
                        type="button"
                        onClick={() => setSelectedSemester(sem)}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer relative ${
                          selectedSemester === sem
                            ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400 font-bold shadow-sm"
                            : "bg-muted/30 border-border text-foreground hover:bg-muted/60"
                        }`}
                      >
                        <div className="text-base font-bold">Sem {sem}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {isElective ? "Has Electives" : "Core"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Elective Notice for Sem 5+ */}
              {selectedSemester >= 5 && (
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-xs text-purple-700 dark:text-purple-300">
                  ✨ <strong>Semester {selectedSemester} Electives:</strong>{" "}
                  Elective choices (Program Electives & Open Minor Electives)
                  are enabled for 5th semester onwards and will be configured in
                  Step 3.
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Section & Practical Group Selection */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Select Lab Group & Section
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose your practical batch (G1 vs G2) for{" "}
                  <strong>
                    {selectedBranch} — Semester {selectedSemester}
                  </strong>
                  . Shared slots (G1/G2) are automatically included for both
                  groups.
                </p>
              </div>

              {/* Practical Group Choice */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-emerald-500" />
                  Your Practical Lab Batch (Group)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {labGroupsList.map((grp: string) => {
                    const isG1 = grp.toUpperCase().includes("1");
                    return (
                      <button
                        key={grp}
                        type="button"
                        onClick={() => setSelectedLabGroup(grp)}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          selectedLabGroup === grp
                            ? "bg-emerald-500/10 border-emerald-500 text-foreground ring-2 ring-emerald-500/20 shadow-sm"
                            : "bg-muted/30 border-border text-foreground hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                            Group {grp}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              selectedLabGroup === grp
                                ? "bg-emerald-500 text-white"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {selectedLabGroup === grp ? "Selected" : "Select"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {isG1
                            ? "Attends Group 1 practicals + all shared (G1/G2) combined lab sessions."
                            : "Attends Group 2 practicals + all shared (G1/G2) combined lab sessions."}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section Choice (if available) */}
              {sectionsList.length > 1 && (
                <div className="space-y-3 pt-2">
                  <label className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    Lecture Section
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {sectionsList.map((sec: string) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setSelectedSection(sec)}
                        className={`p-3.5 rounded-2xl border text-center font-bold text-sm transition-all cursor-pointer ${
                          selectedSection === sec
                            ? "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/20"
                            : "bg-muted/30 border-border text-foreground hover:bg-muted/60"
                        }`}
                      >
                        {sec}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Electives Selection (Multi-Select, No Hardcoding) */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted/40 border border-border/60 rounded-2xl">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    Select Your Electives
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select 1, 2, 3, or all electives you are enrolled in for{" "}
                    <strong>
                      {selectedBranch} — Sem {selectedSemester}
                    </strong>
                    .
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllElectives}
                    className="px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Select All ({allElectives.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllElectives}
                    className="px-3 py-1.5 bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {allElectives.length === 0 ? (
                <div className="p-8 text-center bg-muted/20 border border-dashed border-border rounded-2xl text-xs text-muted-foreground">
                  No electives detected in timetable for this semester. All core
                  classes will be imported.
                </div>
              ) : (
                Object.entries(groupedElectives).map(
                  ([groupTitle, electives]) => (
                    <div key={groupTitle} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          {groupTitle} ({electives.length} Available)
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {
                            electives.filter((e) =>
                              selectedElectives.includes(e.code),
                            ).length
                          }{" "}
                          Selected
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {electives.map((opt) => {
                          const isSelected = selectedElectives.includes(
                            opt.code,
                          );
                          return (
                            <div
                              key={opt.code}
                              onClick={() => handleToggleElective(opt.code)}
                              className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between select-none ${
                                isSelected
                                  ? "bg-blue-500/10 border-blue-500 text-foreground ring-1 ring-blue-500/30 shadow-sm"
                                  : "bg-muted/30 border-border text-foreground hover:border-blue-500/40 hover:bg-muted/50"
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <span className="px-2 py-0.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-mono font-bold">
                                  {opt.code}
                                </span>
                                <div
                                  className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? "bg-blue-500 text-white"
                                      : "border border-muted-foreground/30 bg-muted/50"
                                  }`}
                                >
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  )}
                                </div>
                              </div>
                              <div className="text-sm font-bold text-foreground mt-2 line-clamp-2">
                                {opt.title}
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 pt-2 border-t border-border/40">
                                <span>{opt.credits} Credits</span>
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                                  {isSelected ? "Enrolled" : "Click to select"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ),
                )
              )}
            </div>
          )}

          {/* STEP 4: Live Schedule Confirmation */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="p-4 bg-muted/40 border border-border rounded-2xl space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Setup Summary
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-muted-foreground block">Branch:</span>
                    <span className="font-bold text-foreground">
                      {selectedBranch}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">
                      Semester:
                    </span>
                    <span className="font-bold text-foreground">
                      Semester {selectedSemester}
                    </span>
                  </div>
                  {hasSections && (
                    <div>
                      <span className="text-muted-foreground block">
                        Section / Group:
                      </span>
                      <span className="font-bold text-foreground">
                        {selectedSection} ({selectedLabGroup})
                      </span>
                    </div>
                  )}
                  {isElectiveSem && (
                    <div>
                      <span className="text-muted-foreground block">
                        Selected Electives:
                      </span>
                      <span className="font-bold text-blue-500">
                        {selectedElectives.length > 0
                          ? `${selectedElectives.length} Chosen (${selectedElectives.join(", ")})`
                          : "None"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Electives Pills */}
              {isElectiveSem && selectedElectives.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Included Electives ({selectedElectives.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedElectives.map((code) => {
                      const title = resolveSubjectName(code);
                      return (
                        <div
                          key={code}
                          className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-foreground rounded-xl text-xs flex items-center gap-2"
                        >
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {code}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="font-medium truncate max-w-[200px]">
                            {title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Classes Preview list */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                  <span>
                    Weekly Classes Preview ({previewSlots.length} Slots)
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {previewSlots.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No matching class slots found. Standard curriculum slots
                      will be generated.
                    </div>
                  ) : (
                    previewSlots.map((slot: any, idx: number) => {
                      const dayNames = [
                        "Mon",
                        "Tue",
                        "Wed",
                        "Thu",
                        "Fri",
                        "Sat",
                      ];
                      const title = resolveSubjectName(slot.code);
                      const timeRange = formatTimeRange(
                        slot.startTime,
                        slot.endTime,
                        "09:00 - 10:00",
                      );
                      return (
                        <div
                          key={idx}
                          className="p-3 bg-muted/30 border border-border/60 rounded-xl flex justify-between items-center text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-bold px-2 py-1 bg-blue-500/10 text-blue-500 rounded-lg">
                              {dayNames[slot.dayOfWeek] || "Day"}
                            </span>
                            <div>
                              <div className="font-bold text-foreground">
                                {title}
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                {slot.code} • {timeRange} • Room{" "}
                                {slot.room || "TBA"}
                              </div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground capitalize">
                            {slot.type}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-border bg-muted/30 flex justify-between items-center">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-5 py-2.5 rounded-xl font-medium text-sm text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Next Step
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isGenerating}
                className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 cursor-pointer"
              >
                {isGenerating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                Confirm & Sync Timetable
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
