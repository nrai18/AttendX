import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft, Megaphone, FileText, Calendar, Plus } from "lucide-react";
import { api } from "../../lib/api";

interface Announcement {
  id: string;
  title: string;
  content: string;
  importance: "low" | "medium" | "high";
  createdAt: string;
  author: { name: string };
}

interface Assignment {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
}

interface FeedData {
  role: "admin" | "member";
  announcements: Announcement[];
  assignments: Assignment[];
}

export const ClassroomFeedPage = () => {
  const { id } = useParams<{ id: string }>();
  const [feed, setFeed] = useState<FeedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        setIsLoading(true);
        const res = await api.get(`/classrooms/${id}/feed`);
        setFeed(res.data);
      } catch (error) {
        console.error("Failed to fetch feed:", error);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchFeed();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!feed) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Classroom not found or access denied.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full pb-24 md:pb-8">
      <div className="flex items-center gap-3">
        <Link to="/classrooms" className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Classroom Feed</h1>
          <p className="text-sm text-muted-foreground mt-1">Shared announcements and assignments.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Announcements Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              Announcements
            </h2>
            {feed.role === "admin" && (
              <button className="flex items-center gap-1 text-xs font-medium bg-primary/20 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/30 transition-colors">
                <Plus className="w-3 h-3" /> New
              </button>
            )}
          </div>

          {feed.announcements.length === 0 ? (
            <div className="p-8 text-center bg-[#0c0d12] border border-white/5 rounded-2xl">
              <p className="text-muted-foreground text-sm">No announcements yet.</p>
            </div>
          ) : (
            feed.announcements.map(ann => (
              <div key={ann.id} className="p-5 rounded-2xl bg-[#0c0d12] border border-white/5 relative overflow-hidden">
                {ann.importance === "high" && <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />}
                {ann.importance === "medium" && <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500" />}
                
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-white">{ann.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    {new Date(ann.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-white/70 whitespace-pre-wrap">{ann.content}</p>
                <div className="mt-3 pt-3 border-t border-white/5 text-xs text-muted-foreground flex justify-between items-center">
                  <span>Posted by {ann.author.name}</span>
                  {ann.importance === "high" && (
                    <span className="text-rose-400 font-medium">Important</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Assignments Column */}
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Assignments
            </h2>
            {feed.role === "admin" && (
              <button className="p-1.5 text-blue-400 hover:bg-blue-400/20 rounded-lg transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {feed.assignments.length === 0 ? (
            <div className="p-6 text-center bg-[#0c0d12] border border-white/5 rounded-2xl">
              <p className="text-muted-foreground text-sm">No upcoming assignments.</p>
            </div>
          ) : (
            feed.assignments.map(assign => {
              const dueDate = new Date(assign.dueDate);
              const isUrgent = dueDate.getTime() - new Date().getTime() < 86400000; // < 24h
              return (
                <div key={assign.id} className="p-4 rounded-xl bg-[#0c0d12] border border-white/5">
                  <h3 className="font-medium text-white mb-1">{assign.title}</h3>
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${isUrgent ? 'text-rose-400' : 'text-muted-foreground'}`}>
                    <Calendar className="w-3.5 h-3.5" />
                    Due {dueDate.toLocaleDateString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
