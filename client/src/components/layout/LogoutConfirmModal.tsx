import React from "react";
import { LogOut, X } from "lucide-react";
import { Button } from "../ui/button";

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#0c0d12] border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-white/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
            <LogOut className="w-6 h-6 text-rose-500" />
          </div>
          
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Sign Out</h3>
            <p className="text-sm text-white/60">
              Are you sure you want to sign out of AttendX? You will need to enter your credentials to access your dashboard again.
            </p>
          </div>

          <div className="flex gap-3 w-full pt-4">
            <Button 
              variant="outline" 
              className="flex-1 bg-transparent border-white/10 hover:bg-white/5" 
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-rose-500 hover:bg-rose-600 text-white border-none shadow-lg shadow-rose-500/20" 
              onClick={onConfirm}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
