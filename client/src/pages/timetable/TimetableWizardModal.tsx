import React, { useState } from "react";
import { Loader2, Wand2, BookOpen, FlaskConical, Sparkles, X } from "lucide-react";
import { getSemesterFilterInfo } from "../../utils/scheduleFilter";

interface Option {
  code: string;
  title: string;
  credits: number;
}

interface Group {
  id: string;
  name: string;
  options: any[]; // String or Option
}

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (selections: any) => Promise<void>;
  setupPayload: {
    programElectives: Group[];
    minorElectives: Group[];
    labGroups: Group[];
    rawSlots: any[];
  } | null;
  semesterName?: string;
}

export const TimetableWizardModal: React.FC<WizardProps> = ({ isOpen, onClose, onGenerate, setupPayload, semesterName = "" }) => {
  const [programElective, setProgramElective] = useState<string>("");
  const [minorElective, setMinorElective] = useState<string>("");
  const [labGroup, setLabGroup] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen || !setupPayload) return null;

  const filterInfo = getSemesterFilterInfo(semesterName);
  const showElectives = filterInfo.hasElectives;

  const handleSubmit = async () => {
    setIsGenerating(true);
    await onGenerate({
      programElectiveCode: showElectives ? programElective : undefined,
      minorElectiveCode: showElectives ? minorElective : undefined,
      labGroup: labGroup
    });
    setIsGenerating(false);
  };

  const isReady = showElectives 
    ? (programElective !== "" && minorElective !== "" && labGroup !== "")
    : (labGroup !== "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => !isGenerating && onClose()}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-[#0c0d12] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-blue-500 to-purple-500" />
        
        <div className="p-6 md:p-8 overflow-y-auto">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-primary/20 text-primary rounded-xl">
                  <Wand2 className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-white">Smart Timetable Setup</h2>
              </div>
              <p className="text-muted-foreground text-sm pl-12">
                We've extracted the schedule. Tell us your electives and groups to personalize it.
              </p>
            </div>
            <button onClick={onClose} disabled={isGenerating} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-8 pl-12">
            
            {/* Program Electives */}
            {showElectives && setupPayload.programElectives.map(group => (
              <div key={group.id} className="space-y-4">
                <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Select {group.name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.options.map((opt: Option) => (
                    <label 
                      key={opt.code}
                      className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border transition-all ${
                        programElective === opt.code 
                          ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--primary),0.2)]" 
                          : "bg-white/[0.02] border-white/5 hover:border-white/20"
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="programElective" 
                        value={opt.code}
                        checked={programElective === opt.code}
                        onChange={(e) => setProgramElective(e.target.value)}
                        className="sr-only"
                      />
                      <span className="text-xs font-mono text-primary mb-1">{opt.code}</span>
                      <span className="text-sm font-medium text-white">{opt.title}</span>
                      <span className="text-xs text-muted-foreground mt-2">{opt.credits} Credits</span>
                      
                      {programElective === opt.code && (
                        <div className="absolute top-4 right-4 text-primary">
                          <CheckCircleIcon />
                        </div>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {/* Minor Electives */}
            {showElectives && setupPayload.minorElectives.map(group => (
              <div key={group.id} className="space-y-4">
                <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  Select {group.name}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.options.map((opt: Option) => (
                    <label 
                      key={opt.code}
                      className={`relative flex flex-col p-4 cursor-pointer rounded-2xl border transition-all ${
                        minorElective === opt.code 
                          ? "bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
                          : "bg-white/[0.02] border-white/5 hover:border-white/20"
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
                      <span className="text-xs font-mono text-blue-400 mb-1">{opt.code}</span>
                      <span className="text-sm font-medium text-white">{opt.title}</span>
                      <span className="text-xs text-muted-foreground mt-2">{opt.credits} Credits</span>
                      
                      {minorElective === opt.code && (
                        <div className="absolute top-4 right-4 text-blue-400">
                          <CheckCircleIcon />
                        </div>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {/* Lab Groups */}
            {setupPayload.labGroups.map(group => (
              <div key={group.id} className="space-y-4">
                <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-emerald-400" />
                  Select {group.name}
                </h3>
                <div className="flex gap-3">
                  {group.options.map((opt: string) => (
                    <label 
                      key={opt}
                      className={`relative flex items-center justify-center p-4 w-24 cursor-pointer rounded-2xl border transition-all ${
                        labGroup === opt 
                          ? "bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                          : "bg-white/[0.02] border-white/5 hover:border-white/20"
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="labGroup" 
                        value={opt}
                        checked={labGroup === opt}
                        onChange={(e) => setLabGroup(e.target.value)}
                        className="sr-only"
                      />
                      <span className={`text-lg font-bold ${labGroup === opt ? "text-emerald-400" : "text-white"}`}>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end gap-3">
          <button 
            onClick={onClose}
            disabled={isGenerating}
            className="px-6 py-2.5 rounded-xl font-medium text-white hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!isReady || isGenerating}
            className="flex items-center gap-2 px-8 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Generate Timetable
          </button>
        </div>

      </div>
    </div>
  );
};

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);
