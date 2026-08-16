import React, { useState, useRef, useEffect } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  RotateCcw,
  Layers,
  Sparkles,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  useNotificationStore,
  InAppNotification,
} from "../../stores/notificationStore";

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  } = useNotificationStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const getCategoryIcon = (n: InAppNotification) => {
    if (n.category === "semester") {
      return <Layers className="w-4 h-4 text-indigo-400" />;
    }
    if (n.category === "delete") {
      return <Trash2 className="w-4 h-4 text-rose-400" />;
    }
    if (n.category === "reset") {
      return <RotateCcw className="w-4 h-4 text-amber-400" />;
    }
    if (n.type === "success") {
      return <Sparkles className="w-4 h-4 text-emerald-400" />;
    }
    if (n.type === "warning") {
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    }
    return <Info className="w-4 h-4 text-sky-400" />;
  };

  const formatTimestamp = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 cursor-pointer transition-transform active:scale-95 border border-transparent hover:border-border/60"
        title="Notifications"
        aria-label="In-App Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-background animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/20 text-primary">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Read all</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-muted-foreground hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 cursor-pointer transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-10 h-10 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-2">
                  <Bell className="w-5 h-5 opacity-50" />
                </div>
                <p className="text-xs font-semibold text-foreground">No notifications</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px]">
                  Updates on semester creations, deletes, and data resets will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`group flex items-start gap-3 p-3.5 text-left transition-colors cursor-pointer ${
                    n.read
                      ? "hover:bg-muted/30 opacity-75 hover:opacity-100"
                      : "bg-primary/5 hover:bg-primary/10 border-l-2 border-primary"
                  }`}
                >
                  {/* Icon Avatar */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      n.category === "delete"
                        ? "bg-rose-500/10 text-rose-400"
                        : n.category === "reset"
                        ? "bg-amber-500/10 text-amber-400"
                        : n.category === "semester"
                        ? "bg-indigo-500/10 text-indigo-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {getCategoryIcon(n)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-xs font-bold text-foreground truncate">
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                        {formatTimestamp(n.timestamp)}
                      </span>
                    </div>
                    {n.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {n.description}
                      </p>
                    )}
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(n.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/80 transition-opacity cursor-pointer shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
