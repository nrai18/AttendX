import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Link2, X, ChevronRight, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";

interface Subject {
  id: string;
  name: string;
  code?: string;
}

interface ReconciliationProps {
  isOpen: boolean;
  onClose: () => void;
  semesterId: string;
  newSubjectIds?: string[];
  existingSubjectIds?: string[];
  onComplete: () => void;
}

export const SubjectReconciliationModal: React.FC<ReconciliationProps> = ({
  isOpen,
  onClose,
  semesterId,
  onComplete,
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mappings, setMappings] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (isOpen) {
      fetchSubjects();
    }
  }, [isOpen, semesterId]);

  const fetchSubjects = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/subjects?semesterId=${semesterId}`);
      setSubjects(res.data);
      autoMap(res.data);
    } catch (err) {
      console.error("Failed to load subjects", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getFullSubjectName = (sub: Subject) => `${sub.name} ${sub.code ? `(${sub.code})` : ""}`.trim();

  // Filter the subjects using regex to find codes in parentheses
  const targetSubjects = useMemo(() => {
    return subjects.filter(s => /\([A-Z0-9_]+\)/.test(getFullSubjectName(s)));
  }, [subjects]);

  const duplicateOptions = useMemo(() => {
    return subjects.filter(s => !/\([A-Z0-9_]+\)/.test(getFullSubjectName(s)));
  }, [subjects]);

  const autoMap = (loadedSubjects: Subject[]) => {
    const getFullName = (sub: Subject) => `${sub.name} ${sub.code ? `(${sub.code})` : ""}`.trim();
    const targets = loadedSubjects.filter(s => /\([A-Z0-9_]+\)/.test(getFullName(s)));
    const duplicates = loadedSubjects.filter(s => !/\([A-Z0-9_]+\)/.test(getFullName(s)));
    
    const initialMappings: Record<string, string | null> = {};

    targets.forEach(targetSub => {
      const targetName = targetSub.name.toLowerCase();
      const targetCode = (targetSub.code || "").toLowerCase();
      
      let bestMatch: string | null = null;
      let highestScore = 0;

      duplicates.forEach(dupSub => {
        const sourceName = dupSub.name.toLowerCase();
        const sourceCode = (dupSub.code || "").toLowerCase();

        if (targetCode && targetCode === sourceCode) {
          bestMatch = dupSub.id;
          highestScore = 100;
          return;
        }

        if (targetName === sourceName) {
          bestMatch = dupSub.id;
          highestScore = 90;
          return;
        }

        const getAcronym = (name: string) => name.split(/\s+/).filter(w => !["and", "of", "the", "for", "in", "a"].includes(w)).map(w => w[0]).join("");
        const acronym = getAcronym(targetName);
        if (acronym.length > 1 && (acronym === sourceName || acronym === sourceCode)) {
          if (highestScore < 80) {
            bestMatch = dupSub.id;
            highestScore = 80;
          }
        }
        
        const sourceAcronym = getAcronym(sourceName);
        if (sourceAcronym.length > 1 && (sourceAcronym === targetCode || sourceAcronym === targetName)) {
          if (highestScore < 80) {
            bestMatch = dupSub.id;
            highestScore = 80;
          }
        }

        if (targetName.includes(sourceName) || sourceName.includes(targetName)) {
           if (highestScore < 50) {
             bestMatch = dupSub.id;
             highestScore = 50;
           }
        }
      });

      initialMappings[targetSub.id] = bestMatch;
    });

    setMappings(initialMappings);
  };

  const handleMerge = async () => {
    setIsSubmitting(true);
    try {
      const mergesToApply = Object.entries(mappings)
        .filter(([targetId, sourceId]) => sourceId !== null && sourceId !== "none")
        .map(([targetId, sourceId]) => ({
          targetId,
          sourceId
        }));

      if (mergesToApply.length > 0) {
        await api.post("/subjects/merge", { merges: mergesToApply });
      }
      
      onComplete();
    } catch (error) {
      console.error("Failed to merge subjects", error);
      toast.error("Merge failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Reconcile Subjects</h2>
              <p className="text-xs text-muted-foreground">Map your old duplicate subjects to the new timetable subjects.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-600 dark:text-amber-400">
                <strong>Why am I seeing this?</strong> Select the duplicates you want to merge. The subject on the LEFT will be kept. The subject selected on the RIGHT will be merged into it and deleted.
              </div>

              <div className="space-y-4">
                {targetSubjects.map(targetSub => (
                  <div key={targetSub.id} className="bg-background border border-border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between shadow-sm">
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">Keep This Subject</div>
                      <div className="font-bold text-foreground">{targetSub.name}</div>
                      {targetSub.code && <div className="text-xs text-muted-foreground">{targetSub.code}</div>}
                    </div>

                    <div className="hidden md:flex items-center justify-center text-muted-foreground px-2">
                      <Link2 className="w-5 h-5" />
                    </div>

                    <div className="flex-1 w-full md:w-auto">
                      <div className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-1">Merge Duplicate Into It</div>
                      <select
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                        value={mappings[targetSub.id] || "none"}
                        onChange={(e) => setMappings(m => ({ ...m, [targetSub.id]: e.target.value === "none" ? null : e.target.value }))}
                      >
                        <option value="none">None (Keep separate)</option>
                        {duplicateOptions.map(dupSub => {
                          return (
                            <option key={dupSub.id} value={dupSub.id}>
                              {getFullSubjectName(dupSub)}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t border-border flex justify-end gap-3 bg-muted/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={isSubmitting || isLoading}
            className="px-6 py-2 font-medium bg-primary text-primary-foreground hover:opacity-90 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                Complete Reconciliation
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
