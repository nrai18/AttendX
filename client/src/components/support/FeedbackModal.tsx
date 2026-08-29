import React, { useState } from "react";
import { X, Upload, Mail, Lightbulb, Bug } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultIssue?: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  defaultIssue = "",
}) => {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<"issue" | "improvement">("issue");

  // Issue state
  const [selectedQuestion, setSelectedQuestion] = useState(defaultIssue || "Timetable Error");
  const [frequency, setFrequency] = useState("Just once");
  const [issueDescription, setIssueDescription] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [attachLogs, setAttachLogs] = useState(true);

  // Improvement state
  const [improvementArea, setImprovementArea] = useState("UI / Design");
  const [improvementDescription, setImprovementDescription] = useState("");

  // Shared
  const [email, setEmail] = useState(user?.email || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setScreenshot(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const desc = tab === "issue" ? issueDescription : improvementDescription;
    if (!desc.trim() || !email.trim()) {
      toast.error("Description and email are required");
      return;
    }

    try {
      setIsSubmitting(true);
      let deviceLogs = null;
      if (tab === "issue" && attachLogs) {
        deviceLogs = {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          localStorage: { ...localStorage },
          windowSize: `${window.innerWidth}x${window.innerHeight}`,
          url: window.location.href
        };
      }

      await api.post("/support/feedback", {
        type: tab === "issue" ? "Report an issue" : "Improvement suggestion",
        issue: tab === "issue" ? selectedQuestion : improvementArea,
        frequency: tab === "issue" ? frequency : undefined,
        description: desc,
        email,
        attachLogs: tab === "issue" ? attachLogs : false,
        screenshot: tab === "issue" ? screenshot : null,
        deviceLogs
      });
      toast.success("Feedback sent successfully. Thank you!");
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to send feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto relative animate-in slide-in-from-bottom-4 sm:zoom-in-95">
        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-6 pb-4">
          <h2 className="text-xl font-bold text-foreground">Send feedback</h2>
          <button onClick={onClose} className="p-2 bg-muted/50 hover:bg-muted text-muted-foreground rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 px-6 pb-5">
          <button
            type="button"
            onClick={() => setTab("issue")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-semibold transition-all ${
              tab === "issue"
                ? "bg-rose-500/10 border-rose-500/40 text-rose-500"
                : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <Bug className="w-4 h-4" />
            Report an issue
          </button>
          <button
            type="button"
            onClick={() => setTab("improvement")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-semibold transition-all ${
              tab === "improvement"
                ? "bg-amber-500/10 border-amber-500/40 text-amber-500"
                : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            Improvement
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">

          {/* ── ISSUE FORM ───────────────────────────── */}
          {tab === "issue" && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Issue category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedQuestion}
                  onChange={(e) => setSelectedQuestion(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl p-3 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option>Timetable Error</option>
                  <option>Attendance Sync</option>
                  <option>Notifications</option>
                  <option>Peer Sync</option>
                  <option>UI Bug</option>
                  <option>Performance</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  How often does this happen? <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {["Just once", "1–2 times/week", "3–5 times/week", "Daily"].map((f) => (
                    <button
                      key={f} type="button" onClick={() => setFrequency(f)}
                      className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        frequency === f
                          ? "bg-rose-500/15 border-rose-500/40 text-rose-500"
                          : "bg-muted/50 border-border text-muted-foreground"
                      }`}
                    >{f}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Describe the issue <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className="w-full h-28 bg-muted/50 border border-border rounded-xl p-3 text-sm text-foreground outline-none focus:border-primary resize-none placeholder-muted-foreground/50"
                  placeholder="What happened? What did you expect?"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Screenshot (optional)</label>
                <div className="relative w-16 h-16 bg-muted/50 border border-border rounded-xl flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground overflow-hidden">
                  {screenshot ? (
                    <img src={screenshot} alt="Screenshot" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                  <input type="file" accept="image/*" onChange={handleScreenshotChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileTextIcon className="w-4 h-4 text-foreground" />
                    <span className="text-sm font-medium text-foreground">Attach device logs</span>
                  </div>
                  <button
                    type="button" onClick={() => setAttachLogs(!attachLogs)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${attachLogs ? "bg-primary" : "bg-muted"}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${attachLogs ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Helps us identify the problem faster. Generates a password-protected file only the developer can read.
                </p>
              </div>
            </>
          )}

          {/* ── IMPROVEMENT FORM ─────────────────────── */}
          {tab === "improvement" && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Which area? <span className="text-rose-500">*</span>
                </label>
                <select
                  value={improvementArea}
                  onChange={(e) => setImprovementArea(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl p-3 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option>UI / Design</option>
                  <option>Timetable</option>
                  <option>Attendance Tracking</option>
                  <option>Notifications</option>
                  <option>Peer Sync</option>
                  <option>AI / Smart Features</option>
                  <option>Performance</option>
                  <option>New Feature Request</option>
                  <option>Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Your suggestion <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={improvementDescription}
                  onChange={(e) => setImprovementDescription(e.target.value)}
                  className="w-full h-32 bg-muted/50 border border-border rounded-xl p-3 text-sm text-foreground outline-none focus:border-primary resize-none placeholder-muted-foreground/50"
                  placeholder="What would you like to improve or see added? Be as specific as you like."
                />
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                  💡 Good suggestions get prioritised in the next release. The more detail you provide, the better!
                </p>
              </div>
            </>
          )}

          {/* ── SHARED: Email ─────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Your email <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-xl py-3 pl-10 pr-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          <button
            type="submit" disabled={isSubmitting}
            className="w-full py-3.5 bg-foreground text-background rounded-xl font-bold text-sm hover:bg-foreground/90 transition-colors flex items-center justify-center"
          >
            {isSubmitting ? "Sending..." : "Send feedback"}
          </button>
        </form>
      </div>
    </div>
  );
};

function FileTextIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  );
}
