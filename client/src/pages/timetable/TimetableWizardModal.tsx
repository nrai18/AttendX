import React, { useState, useRef } from "react";
import {
  Loader2,
  Wand2,
  BookOpen,
  FlaskConical,
  Sparkles,
  X,
  Upload,
  ChevronRight,
  Users,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchMeta {
  code: string;
  label: string;
  department: string;
}

interface SemesterMeta {
  value: string; // e.g. "Semester 5"
  number: number; // e.g. 5
  term: "odd" | "even";
}

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
  sections: string[]; // e.g. ["A","B"] or []
  rawSlots: any[];
}

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  onOcrProcess: (
    file: File,
    semesterName: string,
    branch: string,
  ) => Promise<OcrSetupPayload>;
  onGenerate: (selections: {
    programElectiveCode?: string;
    minorElectiveCode?: string;
    programElectiveCodes?: string[];
    minorElectiveCodes?: string[];
    labGroup: string;
    section?: string;
    rawSlots: any[];
  }) => Promise<void>;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

const Stepper: React.FC<{
  current: number;
  total: number;
  labels: string[];
}> = ({ current, total, labels }) => (
  <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
    {Array.from({ length: total }).map((_, i) => {
      const done = i < current - 1;
      const active = i === current - 1;
      return (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                    ? "bg-primary/20 border-2 border-primary text-primary"
                    : "bg-white/5 border border-border text-foreground/30"
              }`}
            >
              {done ? "✓" : i + 1}
            </div>
            <span
              className={`text-[10px] font-medium hidden sm:block whitespace-nowrap
              ${active ? "text-foreground" : "text-foreground/30"}`}
            >
              {labels[i]}
            </span>
          </div>
          {i < total - 1 && (
            <div
              className={`flex-1 h-px min-w-3 transition-all mt-[-10px] ${done ? "bg-primary" : "bg-white/10"}`}
            />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

const CheckCircle = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export const TimetableWizardModal: React.FC<WizardProps> = ({
  isOpen,
  onClose,
  onOcrProcess,
  onGenerate,
}) => {
  // Wizard state
  const [step, setStep] = useState(1);

  // File - Strictly image only
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // OCR
  const [ocrPayload, setOcrPayload] = useState<OcrSetupPayload | null>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Post-OCR selections
  const [selectedSection, setSelectedSection] = useState("");
  const [labGroup, setLabGroup] = useState("");
  const [programElective, setProgramElective] = useState("");
  const [minorElective, setMinorElective] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  // ─── Derived ────────────────────────────────────────────────────────────────

  const hasOcr = ocrPayload !== null;
  const hasSections = hasOcr && (ocrPayload!.sections?.length ?? 0) > 1;
  const hasProgramElectives =
    hasOcr && (ocrPayload!.programElectives?.length ?? 0) > 0;
  const hasMinorElectives =
    hasOcr && (ocrPayload!.minorElectives?.length ?? 0) > 0;

  // Dynamic post-OCR steps
  const postOcrSteps: { key: string; label: string }[] = [];
  if (hasSections) postOcrSteps.push({ key: "section", label: "Section" });
  postOcrSteps.push({ key: "labGroup", label: "Lab Group" });
  if (hasProgramElectives)
    postOcrSteps.push({ key: "progElective", label: "Program Elective" });
  if (hasMinorElectives)
    postOcrSteps.push({ key: "minorElective", label: "Minor Elective" });

  const allStepLabels = ["Upload", ...postOcrSteps.map((s) => s.label)];
  const totalSteps = 1 + postOcrSteps.length;

  const postOcrIndex = step - 2;
  const currentPostKey = postOcrSteps[postOcrIndex]?.key ?? null;

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // Strict frontend image validation
    if (!f.type.startsWith("image/")) {
      setOcrError("Please upload an image file (JPG, JPEG, or PNG).");
      return;
    }

    setFile(f);
    setOcrError(null);

    const reader = new FileReader();
    reader.onloadend = () => setFilePreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleProcessFile = async () => {
    if (!file) return;
    setIsProcessingOcr(true);
    setOcrError(null);
    try {
      const payload = await onOcrProcess(file, "", "");
      setOcrPayload(payload);
      setStep(2);
    } catch {
      setOcrError(
        "Failed to extract timetable. Please try a clearer screenshot.",
      );
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const handleGenerate = async () => {
    if (!ocrPayload) return;
    setIsGenerating(true);
    const programElectiveCodes = ocrPayload.programElectives.flatMap((g) =>
      g.options.map((o) => o.code),
    );
    const minorElectiveCodes = ocrPayload.minorElectives.flatMap((g) =>
      g.options.map((o) => o.code),
    );
    await onGenerate({
      programElectiveCode: hasProgramElectives ? programElective : undefined,
      minorElectiveCode: hasMinorElectives ? minorElective : undefined,
      programElectiveCodes: hasProgramElectives ? programElectiveCodes : [],
      minorElectiveCodes: hasMinorElectives ? minorElectiveCodes : [],
      labGroup,
      section: hasSections ? selectedSection : undefined,
      rawSlots: ocrPayload.rawSlots,
    });
    setIsGenerating(false);
  };

  const handleClose = () => {
    if (isProcessingOcr || isGenerating) return;
    setStep(1);
    setFile(null);
    setFilePreview(null);
    setOcrPayload(null);
    setOcrError(null);
    setSelectedSection("");
    setLabGroup("");
    setProgramElective("");
    setMinorElective("");
    onClose();
  };

  const isUploadStep = step === 1;
  const isLastStep = step === totalSteps;

  const canNext = (() => {
    if (isUploadStep) return !!file && !isProcessingOcr;
    if (currentPostKey === "section") return selectedSection !== "";
    if (currentPostKey === "labGroup") return labGroup !== "";
    if (currentPostKey === "progElective") return programElective !== "";
    if (currentPostKey === "minorElective") return minorElective !== "";
    return !isGenerating;
  })();

  const handleNext = () => {
    if (isUploadStep) {
      handleProcessFile();
      return;
    }
    if (isLastStep) {
      handleGenerate();
      return;
    }
    setStep((s) => s + 1);
  };

  const getNextLabel = () => {
    if (isUploadStep)
      return isProcessingOcr ? "Analysing…" : "Extract Schedule";
    if (isLastStep)
      return isGenerating ? "Generating…" : "Generate My Timetable";
    return "Continue";
  };

  // ─── Step renderer ───────────────────────────────────────────────────────────

  const renderStep = () => {
    // Step 1 — Upload
    if (step === 1)
      return (
        <div className="space-y-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Upload your timetable image
              </h2>
              <p className="text-sm text-muted-foreground">
                Your branch and semester are automatically determined. Please
                upload a clear screenshot.
              </p>
            </div>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
            ${filePreview ? "border-primary/50 bg-primary/5" : "border-white/15 hover:border-white/40 hover:bg-white/[0.03]"}`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg, image/jpg, image/png"
              className="hidden"
              onChange={handleFileSelect}
            />

            {filePreview ? (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={filePreview}
                  alt="Preview"
                  className="max-h-44 mx-auto rounded-xl object-contain shadow-lg"
                />
                <p className="text-sm text-primary font-medium">
                  Click to change image
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">
                    Drop your screenshot here
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    PNG, JPG or JPEG — up to 10 MB
                  </p>
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

    // Post-OCR: Section
    if (currentPostKey === "section")
      return (
        <div className="space-y-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-yellow-500/20 text-yellow-400 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Which section are you in?
              </h2>
              <p className="text-sm text-muted-foreground">
                Your timetable has {ocrPayload!.sections.length} sections — pick
                yours.
              </p>
            </div>
          </div>
          <div className="flex gap-4 flex-wrap">
            {ocrPayload!.sections.map((sec) => (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={`w-24 h-24 rounded-2xl border text-2xl font-black transition-all
                ${
                  selectedSection === sec
                    ? "bg-yellow-500/15 border-yellow-500 text-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.2)]"
                    : "bg-white/[0.02] border-border text-foreground hover:border-white/30 hover:bg-accent"
                }`}
              >
                {sec}
              </button>
            ))}
          </div>
        </div>
      );

    // Post-OCR: Lab Group
    if (currentPostKey === "labGroup") {
      const labOptions = ocrPayload?.labGroups?.[0]?.options?.length
        ? ocrPayload!.labGroups[0].options
        : ["G1", "G2"];
      return (
        <div className="space-y-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Which practical group are you in?
              </h2>
              <p className="text-sm text-muted-foreground">
                We'll filter out the other group's lab slots.
              </p>
            </div>
          </div>
          <div className="flex gap-4 flex-wrap">
            {labOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setLabGroup(opt)}
                className={`w-24 h-24 rounded-2xl border text-2xl font-black transition-all
                  ${
                    labGroup === opt
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                      : "bg-white/[0.02] border-border text-foreground hover:border-white/30 hover:bg-accent"
                  }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Post-OCR: Program Elective
    if (currentPostKey === "progElective")
      return (
        <div className="space-y-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-primary/20 text-primary rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Select your Program Elective
              </h2>
              <p className="text-sm text-muted-foreground">
                Only slots for your chosen elective will be added.
              </p>
            </div>
          </div>
          {ocrPayload!.programElectives.map((group) => (
            <div key={group.id} className="space-y-3">
              <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                {group.name}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {group.options.map((opt) => (
                  <label
                    key={opt.code}
                    className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border transition-all
                    ${
                      programElective === opt.code
                        ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                        : "bg-white/[0.02] border-border hover:border-white/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="progElective"
                      value={opt.code}
                      checked={programElective === opt.code}
                      onChange={(e) => setProgramElective(e.target.value)}
                      className="sr-only"
                    />
                    <span className="text-xs font-mono text-primary mb-1">
                      {opt.code}
                    </span>
                    <span className="text-sm font-semibold text-foreground leading-snug">
                      {opt.title || opt.code}
                    </span>
                    {programElective === opt.code && (
                      <div className="absolute top-4 right-4 text-primary">
                        <CheckCircle />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      );

    // Post-OCR: Minor Elective
    if (currentPostKey === "minorElective")
      return (
        <div className="space-y-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Select your Minor / Open Elective
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose the open elective you registered for.
              </p>
            </div>
          </div>
          {ocrPayload!.minorElectives.map((group) => (
            <div key={group.id} className="space-y-3">
              <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                {group.name}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {group.options.map((opt) => (
                  <label
                    key={opt.code}
                    className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border transition-all
                    ${
                      minorElective === opt.code
                        ? "bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                        : "bg-white/[0.02] border-border hover:border-white/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="minorElective"
                      value={opt.code}
                      checked={minorElective === opt.code}
                      onChange={(e) => setMinorElective(e.target.value)}
                      className="sr-only"
                    />
                    <span className="text-xs font-mono text-blue-400 mb-1">
                      {opt.code}
                    </span>
                    <span className="text-sm font-semibold text-foreground leading-snug">
                      {opt.title || opt.code}
                    </span>
                    {minorElective === opt.code && (
                      <div className="absolute top-4 right-4 text-blue-400">
                        <CheckCircle />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      );

    return null;
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-2xl bg-[#0c0d12] border border-border rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-primary via-blue-500 to-purple-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 text-primary rounded-xl">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Timetable Import Wizard
              </h1>
              <p className="text-xs text-muted-foreground">
                Step {step} of {hasOcr ? totalSteps : `${totalSteps}+`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessingOcr || isGenerating}
            className="p-2 text-foreground/40 hover:text-foreground hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <Stepper
            current={step}
            total={hasOcr ? totalSteps : 1}
            labels={allStepLabels.length >= 1 ? allStepLabels : ["Upload"]}
          />
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-black/20 flex justify-between gap-3 shrink-0">
          <button
            onClick={() => (step > 1 ? setStep((s) => s - 1) : handleClose())}
            disabled={isProcessingOcr || isGenerating}
            className="px-5 py-2.5 rounded-xl font-medium text-foreground/70 hover:text-foreground hover:bg-accent transition-colors text-sm"
          >
            {step === 1 ? "Cancel" : "← Back"}
          </button>
          <button
            onClick={handleNext}
            disabled={!canNext}
            className="flex items-center gap-2 px-7 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {(isProcessingOcr || isGenerating) && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {isLastStep && !isGenerating && <Sparkles className="w-4 h-4" />}
            {getNextLabel()}
            {!isLastStep && !isUploadStep && !isProcessingOcr && (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
