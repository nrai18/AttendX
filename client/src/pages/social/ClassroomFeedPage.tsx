import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Loader2,
  ArrowLeft,
  Megaphone,
  FileText,
  Calendar,
  Plus,
} from "lucide-react";
import { api } from "../../lib/api";

interface Announcement {
  id: string;
  title: string;
  content: string;
  importance: "low" | "medium" | "high";
  createdAt: string;
  author: { name: string };
}


interface FeedData {
  role: "admin" | "member";
  announcements: Announcement[];
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
        const data = typeof res.data === 'string' ? { role: 'member', announcements: [] } : res.data;
        setFeed(data);
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
        <Link
          to="/classrooms"
          className="p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Classroom Feed</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Shared announcements.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Announcements Column */}
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" />
              Announcements
            </h2>
            {feed.role === "admin" && (
              <button 
                onClick={() => window.location.href = "/404"}
                className="flex items-center gap-1 text-xs font-medium bg-primary/20 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/30 transition-colors"
              >
                <Plus className="w-3 h-3" /> New
              </button>
            )}
          </div>

          {feed.announcements.length === 0 ? (
            <div className="p-8 text-center bg-card border border-border rounded-2xl">
              <p className="text-muted-foreground text-sm">
                No announcements yet.
              </p>
            </div>
          ) : (
            feed.announcements.map((ann) => (
              <div
                key={ann.id}
                className="p-5 rounded-2xl bg-card border border-border relative overflow-hidden shadow-sm"
              >
                {ann.importance === "high" && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
                )}
                {ann.importance === "medium" && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500" />
                )}

                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-foreground">{ann.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    {new Date(ann.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                  {ann.content}
                </p>
                <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground flex justify-between items-center">
                  <span>Posted by {ann.author.name}</span>
                  {ann.importance === "high" && (
                    <span className="text-rose-500 font-medium">Important</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
