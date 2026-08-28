import React, { useState } from "react";
import { X, Upload, Mail } from "lucide-react";
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
  const [issueType, setIssueType] = useState<
    "Report an issue" | "Improvement suggestion"
  >("Report an issue");
  const [selectedQuestion, setSelectedQuestion] = useState(
    defaultIssue || "Timetable Error",
  );
  const [frequency, setFrequency] = useState("Just once");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [attachLogs, setAttachLogs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !email.trim()) {
      toast.error("Description and email are required");
      return;
    }

    try {
      setIsSubmitting(true);
      
      let deviceLogs = null;
      if (attachLogs) {
        deviceLogs = {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          localStorage: { ...localStorage },
          windowSize: `${window.innerWidth}x${window.innerHeight}`,
          url: window.location.href
        };
      }

      await api.post("/support/feedback", {
        type: issueType,
        issue: selectedQuestion,
        frequency,
        description,
        email,
        attachLogs,
        screenshot,
        deviceLogs
      });
      toast.success("Feedback sent successfully.");
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to send feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl h-[85vh] sm:h-auto overflow-y-auto relative animate-in slide-in-from-bottom-4 sm:zoom-in-95">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-foreground">Send feedback</h2>
          <button
            onClick={onClose}
            className="p-2 bg-muted/50 hover:bg-muted text-muted-foreground rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 pb-20 sm:pb-0">
          <div className="flex bg-muted/50 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setIssueType("Report an issue")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${issueType === "Report an issue" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              Report an issue
            </button>
            <button
              type="button"
              onClick={() => setIssueType("Improvement suggestion")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${issueType === "Improvement suggestion" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              Improvement suggestion
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Selected issue <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedQuestion}
              onChange={(e) => setSelectedQuestion(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-xl p-3 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="Timetable Error">Timetable Error</option>
              <option value="Attendance Sync">Attendance Sync</option>
              <option value="Notifications">Notifications</option>
              <option value="UI Bug">UI Bug</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Issue frequency <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                "Just once",
                "1 to 2 times/week",
                "3 to 5 times/week",
                "Daily",
              ].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors ${frequency === f ? "bg-primary/20 border-primary/50 text-primary" : "bg-muted/50 border-border text-muted-foreground"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Issue description <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-32 bg-muted/50 border border-border rounded-xl p-3 text-sm text-foreground outline-none focus:border-primary resize-none placeholder-muted-foreground/50"
              placeholder="Please describe the issue you're encountering and the results you're expecting."
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Add screenshot (optional)
            </label>
            <div className="relative w-16 h-16 bg-muted/50 border border-border rounded-xl flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground overflow-hidden">
              {screenshot ? (
                <img src={screenshot} alt="Screenshot preview" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleScreenshotChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Your email address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-xl py-3 pl-10 pr-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              System logs
            </h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-muted rounded-md">
                  <FileTextIcon className="w-4 h-4 text-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  Attach device logs
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachLogs(!attachLogs)}
                className={`w-11 h-6 rounded-full transition-colors relative ${attachLogs ? "bg-primary" : "bg-muted"}`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${attachLogs ? "left-[22px]" : "left-0.5"}`}
                />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Uploading the logs will help us to quickly identify your problem.
              This generates a password-protected `.bin` file that only the
              developer can access.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
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
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  );
}
