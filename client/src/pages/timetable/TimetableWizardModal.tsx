import React, { useState, useRef } from "react";
import {
  Loader2, Wand2, BookOpen, FlaskConical, Sparkles, X,
  Upload, FileText, ChevronRight, GraduationCap, Building2, Users
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ElectiveOption {
  code: string;
  title: string;
}

interface ElectiveGroup {
  id: string;
  name: string;
  options: ElectiveOption[];
}

interface LabGroup {
  id: string;
  name: string;
  options: string[];
}

export interface OcrSetupPayload {
  status: string;
  programElectives: ElectiveGroup[];
  minorElectives: ElectiveGroup[];
  labGroups: LabGroup[];
  rawSlots: any[];
}

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after file is selected — triggers backend OCR */
  onOcrProcess: (
    file: File,
    semesterName: string,
    branch: string,
    section: string
  ) => Promise<OcrSetupPayload>;
  /** Called with final user selections to save timetable */
  onGenerate: (selections: {
    programElectiveCode?: string;
    minorElectiveCode?: string;
    labGroup: string;
    rawSlots: any[];
  }) => Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEMESTERS = [
  { label: "Semester 1", value: "Semester 1", year: 1 },
  { label: "Semester 2", value: "Semester 2", year: 1 },
  { label: "Semester 3", value: "Semester 3", year: 2 },
  { label: "Semester 4", value: "Semester 4", year: 2 },
  { label: "Semester 5", value: "Semester 5", year: 3 },
  { label: "Semester 6", value: "Semester 6", year: 3 },
  { label: "Semester 7", value: "Semester 7", year: 4 },
  { label: "Semester 8", value: "Semester 8", year: 4 },
];

const BRANCHES = [
  { code: "CSE", label: "Computer Science & Engineering", color: "blue" },
  { code: "IT",  label: "Information Technology",         color: "indigo" },
  { code: "ECE", label: "Electronics & Communication",    color: "purple" },
  { code: "DS",  label: "Data Science",                   color: "cyan" },
  { code: "CY",  label: "Cyber Security",                 color: "rose" },
];

const SECTIONS = ["A", "B"];

const STEP_LABELS = [
  "Semester",
  "Branch & Section",
  "Upload Timetable",
  "Lab Group",
  "Program Elective",
  "Minor Elective",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const semesterNumber = (name: string): number => {
  const m = name.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
};

// ─── Sub-Components ───────────────────────────────────────────────────────────

const CheckCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

interface StepperProps { current: number; total: number; labels: string[] }
const Stepper: React.FC<StepperProps> = ({ current, total, labels }) => (
  <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
    {Array.from({ length: total }).map((_, i) => {
      const done = i < current - 1;
      const active = i === current - 1;
      return (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${done   ? "bg-primary text-primary-foreground" :
                active ? "bg-primary/20 border-2 border-primary text-primary" :
                         "bg-white/5 border border-white/10 text-white/30"}`}>
              {done ? "✓" : i + 1}
            </div>
            <span className={`text-[10px] font-medium hidden sm:block ${active ? "text-white" : "text-white/30"}`}>
              {labels[i]}
            </span>
          </div>
          {i < total - 1 && (
            <div className={`flex-1 h-px min-w-4 transition-all mt-[-10px]
              ${done ? "bg-primary" : "bg-white/10"}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export const TimetableWizardModal: React.FC<WizardProps> = ({
  isOpen, onClose, onOcrProcess, onGenerate
}) => {
  // Step state: 1=semester, 2=branch, 3=upload, 4=lab, 5=prog elective, 6=minor elective
  const [step, setStep] = useState(1);

  // Pre-OCR selections
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedBranch,   setSelectedBranch]   = useState("");
  const [selectedSection,  setSelectedSection]   = useState("");

  // File upload
  const [file,        setFile]        = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<"pdf" | string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // OCR result
  const [ocrPayload,      setOcrPayload]      = useState<OcrSetupPayload | null>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrError,        setOcrError]        = useState<string | null>(null);

  // Post-OCR selections
  const [labGroup,          setLabGroup]          = useState("");
  const [programElective,   setProgramElective]   = useState("");
  const [minorElective,     setMinorElective]     = useState("");
  const [isGenerating,      setIsGenerating]      = useState(false);

  if (!isOpen) return null;

  // Derived state
  const semNum         = semesterNumber(selectedSemester);
  const hasElectives   = semNum >= 5;
  const totalSteps     = hasElectives ? 6 : 4;
  const stepLabels     = hasElectives ? STEP_LABELS : STEP_LABELS.filter((_, i) => i < 4);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setOcrError(null);
    if (f.type === "application/pdf") {
      setFilePreview("pdf");
    } else {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(f);
    }
  };

  const handleProcessFile = async () => {
    if (!file) return;
    setIsProcessingOcr(true);
    setOcrError(null);
    try {
      const payload = await onOcrProcess(file, selectedSemester, selectedBranch, selectedSection);
      setOcrPayload(payload);
      setStep(4); // move to lab group step
    } catch {
      setOcrError("Failed to extract timetable. Please try again or use a clearer file.");
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    await onGenerate({
      programElectiveCode: hasElectives ? programElective : undefined,
      minorElectiveCode:   hasElectives ? minorElective   : undefined,
      labGroup,
      rawSlots: ocrPayload?.rawSlots ?? [],
    });
    setIsGenerating(false);
  };

  const handleClose = () => {
    if (isProcessingOcr || isGenerating) return;
    // Reset state
    setStep(1); setSelectedSemester(""); setSelectedBranch(""); setSelectedSection("");
    setFile(null); setFilePreview(null); setOcrPayload(null); setOcrError(null);
    setLabGroup(""); setProgramElective(""); setMinorElective("");
    onClose();
  };

  // ─── Step readiness ──────────────────────────────────────────────────────────
  const canProceed: Record<number, boolean> = {
    1: selectedSemester !== "",
    2: selectedBranch !== "" && selectedSection !== "",
    3: file !== null && !isProcessingOcr,
    4: labGroup !== "",
    5: programElective !== "",
    6: minorElective !== "",
  };

  // ─── Step content ────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {

      // ── Step 1: Semester ──────────────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-primary/20 text-primary rounded-xl">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Which semester are you in?</h2>
                <p className="text-sm text-muted-foreground">We'll look at the right page of your timetable PDF.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SEMESTERS.map(sem => (
                <button
                  key={sem.value}
                  onClick={() => setSelectedSemester(sem.value)}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all
                    ${selectedSemester === sem.value
                      ? "bg-primary/15 border-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)]"
                      : "bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/5"}`}
                >
                  <span className={`text-2xl font-black mb-1 ${selectedSemester === sem.value ? "text-primary" : "text-white"}`}>
                    {sem.value.replace("Semester ", "S")}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">Year {sem.year}</span>
                </button>
              ))}
            </div>
          </div>
        );

      // ── Step 2: Branch + Section ─────────────────────────────────────────
      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Which branch and section?</h2>
                <p className="text-sm text-muted-foreground">Semester {semNum} — select your branch and section.</p>
              </div>
            </div>

            {/* Branch selection */}
            <div>
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Branch</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {BRANCHES.map(b => (
                  <button
                    key={b.code}
                    onClick={() => setSelectedBranch(b.code)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all
                      ${selectedBranch === b.code
                        ? "bg-white/10 border-white/30"
                        : "bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/5"}`}
                  >
                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black shrink-0
                      ${selectedBranch === b.code ? "bg-white text-black" : "bg-white/10 text-white"}`}>
                      {b.code}
                    </span>
                    <span className="text-sm font-medium text-white leading-tight">{b.label}</span>
                    {selectedBranch === b.code && (
                      <span className="ml-auto text-white shrink-0"><CheckCircle /></span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Section selection */}
            <div>
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Section</p>
              <div className="flex gap-3">
                {SECTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedSection(s)}
                    className={`w-16 h-16 rounded-xl border text-xl font-black transition-all
                      ${selectedSection === s
                        ? "bg-white text-black border-white"
                        : "bg-white/[0.02] border-white/10 text-white hover:border-white/30"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      // ── Step 3: File Upload ────────────────────────────────────────────────
      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Upload your timetable</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedBranch} {selectedSection} · {selectedSemester} · We'll extract only your section.
                </p>
              </div>
            </div>

            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
                ${filePreview
                  ? "border-primary/50 bg-primary/5"
                  : "border-white/15 hover:border-white/40 hover:bg-white/3"}`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
              {filePreview ? (
                <div className="space-y-4">
                  {filePreview === "pdf" ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-rose-400" />
                      </div>
                      <p className="text-sm font-semibold text-white">{file?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {file ? (file.size / 1024 / 1024).toFixed(2) : "0.00"} MB · PDF
                      </p>
                    </div>
                  ) : (
                    <img src={filePreview} alt="Preview" className="max-h-48 mx-auto rounded-xl object-contain" />
                  )}
                  <p className="text-sm text-primary font-medium">Click to change file</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">Drop your timetable here</p>
                    <p className="text-sm text-muted-foreground mt-1">PNG, JPG or PDF — up to 10MB</p>
                  </div>
                </div>
              )}
            </div>

            {ocrError && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
                {ocrError}
              </div>
            )}
          </div>
        );

      // ── Step 4: Lab Group ──────────────────────────────────────────────────
      case 4:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <FlaskConical className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Which practical group are you in?</h2>
                <p className="text-sm text-muted-foreground">We'll filter out the other group's lab slots.</p>
              </div>
            </div>

            {ocrPayload?.labGroups.map(group => (
              <div key={group.id}>
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">{group.name}</p>
                <div className="flex gap-4">
                  {group.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setLabGroup(opt)}
                      className={`w-24 h-24 rounded-2xl border text-2xl font-black transition-all
                        ${labGroup === opt
                          ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                          : "bg-white/[0.02] border-white/10 text-white hover:border-white/30 hover:bg-white/5"}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Fallback if OCR didn't detect lab groups */}
            {(!ocrPayload?.labGroups || ocrPayload.labGroups.length === 0) && (
              <div>
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Practical Group</p>
                <div className="flex gap-4">
                  {["G1", "G2"].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setLabGroup(opt)}
                      className={`w-24 h-24 rounded-2xl border text-2xl font-black transition-all
                        ${labGroup === opt
                          ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                          : "bg-white/[0.02] border-white/10 text-white hover:border-white/30 hover:bg-white/5"}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      // ── Step 5: Program Elective (Sem 5+ only) ────────────────────────────
      case 5:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-primary/20 text-primary rounded-xl">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Select your Program Elective</h2>
                <p className="text-sm text-muted-foreground">Only slots for your chosen elective will be added.</p>
              </div>
            </div>

            {ocrPayload?.programElectives.map(group => (
              <div key={group.id} className="space-y-3">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">{group.name}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.options.map((opt: ElectiveOption) => (
                    <label
                      key={opt.code}
                      className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border transition-all
                        ${programElective === opt.code
                          ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]"
                          : "bg-white/[0.02] border-white/5 hover:border-white/20"}`}
                    >
                      <input
                        type="radio" name="programElective" value={opt.code}
                        checked={programElective === opt.code}
                        onChange={e => setProgramElective(e.target.value)}
                        className="sr-only"
                      />
                      <span className="text-xs font-mono text-primary mb-1">{opt.code}</span>
                      <span className="text-sm font-semibold text-white leading-snug">{opt.title || opt.code}</span>
                      {programElective === opt.code && (
                        <div className="absolute top-4 right-4 text-primary"><CheckCircle /></div>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {/* Fallback */}
            {(!ocrPayload?.programElectives || ocrPayload.programElectives.length === 0) && (
              <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center">
                <p className="text-sm text-muted-foreground">No program electives detected in the timetable.</p>
                <p className="text-xs text-muted-foreground mt-1">You can skip this step.</p>
              </div>
            )}
          </div>
        );

      // ── Step 6: Minor Elective (Sem 5+ only) ─────────────────────────────
      case 6:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Select your Minor / Open Elective</h2>
                <p className="text-sm text-muted-foreground">Choose the open elective you registered for.</p>
              </div>
            </div>

            {ocrPayload?.minorElectives.map(group => (
              <div key={group.id} className="space-y-3">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">{group.name}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {group.options.map((opt: ElectiveOption) => (
                    <label
                      key={opt.code}
                      className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border transition-all
                        ${minorElective === opt.code
                          ? "bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                          : "bg-white/[0.02] border-white/5 hover:border-white/20"}`}
                    >
                      <input
                        type="radio" name="minorElective" value={opt.code}
                        checked={minorElective === opt.code}
                        onChange={e => setMinorElective(e.target.value)}
                        className="sr-only"
                      />
                      <span className="text-xs font-mono text-blue-400 mb-1">{opt.code}</span>
                      <span className="text-sm font-semibold text-white leading-snug">{opt.title || opt.code}</span>
                      {minorElective === opt.code && (
                        <div className="absolute top-4 right-4 text-blue-400"><CheckCircle /></div>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {/* Fallback */}
            {(!ocrPayload?.minorElectives || ocrPayload.minorElectives.length === 0) && (
              <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center">
                <p className="text-sm text-muted-foreground">No minor electives detected in the timetable.</p>
                <p className="text-xs text-muted-foreground mt-1">You can skip this step.</p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Footer actions ───────────────────────────────────────────────────────
  const isLastStep = step === totalSteps;
  const isUploadStep = step === 3;

  const handleNext = () => {
    if (isUploadStep) {
      handleProcessFile();
    } else if (isLastStep) {
      handleGenerate();
    } else {
      setStep(s => s + 1);
    }
  };

  const getNextLabel = () => {
    if (isUploadStep) return isProcessingOcr ? "Analyzing..." : "Extract Schedule";
    if (isLastStep)   return isGenerating   ? "Generating..."  : "Generate My Timetable";
    return "Continue";
  };

  const canGoNext = isUploadStep
    ? (file !== null && !isProcessingOcr)
    : isLastStep
      ? !isGenerating && (
          hasElectives
            ? (labGroup !== "" && programElective !== "" && minorElective !== "")
            : labGroup !== ""
        )
      : canProceed[step] ?? true;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-[#0c0d12] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Top accent bar */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-primary via-blue-500 to-purple-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 text-primary rounded-xl">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Timetable Import Wizard</h1>
              <p className="text-xs text-muted-foreground">Step {step} of {totalSteps}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessingOcr || isGenerating}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <Stepper current={step} total={totalSteps} labels={stepLabels} />
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex justify-between gap-3 shrink-0">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : handleClose()}
            disabled={isProcessingOcr || isGenerating}
            className="px-5 py-2.5 rounded-xl font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors text-sm"
          >
            {step === 1 ? "Cancel" : "← Back"}
          </button>

          <button
            onClick={handleNext}
            disabled={!canGoNext}
            className="flex items-center gap-2 px-7 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {(isProcessingOcr || isGenerating) && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLastStep && !isGenerating && <Sparkles className="w-4 h-4" />}
            {getNextLabel()}
            {!isLastStep && !isUploadStep && !isProcessingOcr && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
