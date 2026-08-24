import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useSyncStore } from "../../stores/syncStore";

type SyncMode = "SEND" | "RECEIVE";

export const PeerSyncModal = () => {
  const [mode, setMode] = useState<SyncMode>("RECEIVE");
  const [inputCode, setInputCode] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const { activeCode, expiresAt, setActiveCode, clearActiveCode } = useSyncStore();
  const [remainingTime, setRemainingTime] = useState<number>(0);

  // Initialize and update countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const calculateRemaining = () => Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const initialRemaining = calculateRemaining();
    
    if (initialRemaining === 0) {
      clearActiveCode();
      setRemainingTime(0);
      return;
    }

    setRemainingTime(initialRemaining);

    const timer = setInterval(() => {
      const currentRemaining = calculateRemaining();
      setRemainingTime(currentRemaining);
      if (currentRemaining <= 0) {
        clearInterval(timer);
        clearActiveCode();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, clearActiveCode]);

  const handleGenerateCode = async () => {
    setLoading(true);
    try {
      const payload = { timetable: [], academicCalendar: [] }; 
      
      const res = await api.post("/transfer/send", {
        contextType: "SCHEDULE_STATUS",
        payload: payload
      });
      setActiveCode(res.data.code, res.data.expiresIn);
      toast.success("Code generated securely!");
    } catch (error: any) {
      console.log("Error caught in PeerSyncModal:", error);
      const errRes = error.response;
      
      // If the backend says we already have a code, just grab it from the response!
      if (errRes?.data?.code || errRes?.data?.message?.includes("already have an active")) {
        const recoveredCode = errRes?.data?.code || "000000"; // fallback if missing
        const recoveredExp = errRes?.data?.expiresIn || 300;
        
        setActiveCode(recoveredCode, recoveredExp);
        toast.success("Recovered your active transfer code!");
      } else {
        toast.error(errRes?.data?.message || "Failed to generate code.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetrieveCode = async () => {
    if (inputCode.length !== 6) return toast.error("Code must be 6 digits.");
    setLoading(true);
    try {
      const res = await api.post("/transfer/retrieve", { code: inputCode });
      const { contextType, payload } = res.data;
      
      console.log("Reconciling payload...", contextType, payload);
      
      toast.success("Schedule mirrored successfully!");
      setInputCode("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#050508] text-white p-6 rounded-2xl w-full max-w-md mx-auto shadow-xl border border-gray-800">
      <div className="flex bg-gray-900 rounded-lg p-1 mb-8">
        <button
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "RECEIVE" ? "bg-indigo-600 shadow-sm" : "text-gray-400 hover:text-white"}`}
          onClick={() => setMode("RECEIVE")}
        >
          Retrieve
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "SEND" ? "bg-indigo-600 shadow-sm" : "text-gray-400 hover:text-white"}`}
          onClick={() => setMode("SEND")}
        >
          Send
        </button>
      </div>

      {mode === "SEND" ? (
        <div className="text-center py-6">
          <h2 className="text-xl font-semibold mb-2">App Code</h2>
          <p className="text-sm text-gray-400 mb-8">Share this code to transfer your schedule</p>
          
          {activeCode ? (
            <div>
              <div className="text-5xl font-mono tracking-[0.3em] font-bold text-white mb-6">
                {activeCode.substring(0, 3)} {activeCode.substring(3, 6)}
              </div>
              
              {/* Animated Progress Bar */}
              <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden mb-4 relative">
                <div 
                  className="bg-blue-500 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(remainingTime / 300) * 100}%` }}
                />
              </div>
              <p className="text-sm text-blue-400">Changes in {remainingTime}s</p>
            </div>
          ) : (
            <button 
              onClick={handleGenerateCode}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white w-full py-3 rounded-lg font-medium flex justify-center items-center"
            >
              {loading ? <Loader2 className="animate-spin mr-2" /> : null}
              Generate 6-Digit Code
            </button>
          )}
        </div>
      ) : (
        <div className="py-2">
          <label className="text-sm text-gray-400 block mb-2">Retrieval code (6-digit number)</label>
          <input
            type="text"
            maxLength={6}
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 543210"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg py-4 px-4 text-center text-2xl tracking-widest text-white focus:outline-none focus:border-indigo-500 mb-6"
          />
          <button 
            onClick={handleRetrieveCode}
            disabled={loading || inputCode.length !== 6}
            className="bg-indigo-600 disabled:bg-indigo-600/50 hover:bg-indigo-700 text-white w-full py-3 rounded-lg font-medium flex justify-center items-center transition-all"
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : null}
            ↓ Retrieve Schedule
          </button>
        </div>
      )}
    </div>
  );
};
