import React, { useState } from "react";
import { CheckCircle2, Info, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { SaveToggle } from "../../components/ui/save-toggle";
import { format, parse } from "date-fns";

export const FIXED_HOLIDAYS = [
  { sr: 1, name: "Republic Day", date: "26 January", day: "Monday" },
  { sr: 2, name: "Holi", date: "04 March", day: "Wednesday" },
  { sr: 3, name: "Id-ul-Fitr", date: "21 March", day: "Saturday" },
  { sr: 4, name: "Ram Navami", date: "26 March", day: "Thursday" },
  { sr: 5, name: "Mahavir Jayanti", date: "31 March", day: "Tuesday" },
  { sr: 6, name: "Good Friday", date: "03 April", day: "Friday" },
  { sr: 7, name: "Buddha Purnima", date: "01 May", day: "Friday" },
  { sr: 8, name: "Id-ul-Zuha (Bakrid)", date: "27 May", day: "Wednesday" },
  { sr: 9, name: "Muharram", date: "26 June", day: "Friday" },
  { sr: 10, name: "Independence Day", date: "15 August", day: "Saturday" },
  { sr: 11, name: "Milad-Un-Nabi or Id-e-Milad", date: "26 August", day: "Wednesday" },
  { sr: 12, name: "Janmashtami", date: "04 September", day: "Friday" },
  { sr: 13, name: "Mahatma Gandhi's Birthday", date: "02 October", day: "Friday" },
  { sr: 14, name: "Dussehra", date: "20 October", day: "Tuesday" },
  { sr: 15, name: "Diwali (Deepavali)", date: "08 November", day: "Sunday" },
  { sr: 16, name: "Guru Nanak's Birthday", date: "24 November", day: "Tuesday" },
  { sr: 17, name: "Christmas Day", date: "25 December", day: "Friday" },
];

export const RESTRICTED_HOLIDAYS = [
  { sr: 1, name: "New Year's Day", date: "01 January", day: "Thursday" },
  { sr: 2, name: "Hazarat Ali's Birthday", date: "03 January", day: "Saturday" },
  { sr: 3, name: "Makar Sankranti", date: "14 January", day: "Wednesday" },
  { sr: 4, name: "Magha Bihu/ Pongal", date: "15 January", day: "Thursday" },
  { sr: 5, name: "Sri Panchami, Basant Panchami", date: "24 January", day: "Saturday" },
  { sr: 6, name: "Guru Ravidas's Birthday", date: "03 February", day: "Tuesday" },
  { sr: 7, name: "Swami Dayananda Saraswati Jayanti", date: "14 February", day: "Saturday" },
  { sr: 8, name: "Maha Shivratri", date: "26 February", day: "Thursday" },
  { sr: 9, name: "Shivaji Jayanti", date: "19 February", day: "Thursday" },
  { sr: 10, name: "Holika Dahan", date: "03 March", day: "Tuesday" },
  { sr: 11, name: "Dolyatra", date: "04 March", day: "Wednesday" },
  { sr: 12, name: "Chaitra Sukladi / Gudi Padwa / Ugadi", date: "30 March", day: "Monday" },
  { sr: 13, name: "Jamat-Ul-Vida", date: "17 April", day: "Friday" },
  { sr: 14, name: "Easter Sunday", date: "05 April", day: "Sunday" },
  { sr: 15, name: "Vaisakhi / Vishu / Meshadi", date: "14 April", day: "Tuesday" },
  { sr: 16, name: "Vaisakhasi (Bengal) / Bahag Bihu (Assam)", date: "15 April", day: "Wednesday" },
  { sr: 17, name: "Rabindranath Tagore's Birthday", date: "09 May", day: "Saturday" },
  { sr: 18, name: "Rath Yatra", date: "26 June", day: "Friday" },
  { sr: 19, name: "Parsi New Year's day / Nauraz", date: "16 August", day: "Sunday" },
  { sr: 20, name: "Onam or Thiru Onam Day", date: "26 August", day: "Wednesday" },
  { sr: 21, name: "Raksha Bandhan", date: "28 August", day: "Friday" },
  { sr: 22, name: "Ganesh Chaturthi / Vinayaka Chaturthi", date: "07 September", day: "Monday" },
  { sr: 23, name: "Dussehra (Saptami)", date: "17 October", day: "Saturday" },
  { sr: 24, name: "Dussehra (Mahashtami)", date: "18 October", day: "Sunday" },
  { sr: 25, name: "Dussehra (Mahanavami)", date: "19 October", day: "Monday" },
  { sr: 26, name: "Maharishi Valmiki's Birthday", date: "26 October", day: "Monday" },
  { sr: 27, name: "Karaka Chaturthi (Karwa Chouth)", date: "29 October", day: "Thursday" },
  { sr: 28, name: "Naraka Chaturdasi", date: "08 November", day: "Sunday" },
  { sr: 29, name: "Govardhan Puja", date: "09 November", day: "Monday" },
  { sr: 30, name: "Bhai Duj", date: "11 November", day: "Wednesday" },
  { sr: 31, name: "Pratihar Shashthi or Surya Shashthi (Chhat Puja)", date: "15 November", day: "Sunday" },
  { sr: 32, name: "Guru Teg Bahadur's Martyrdom Day", date: "24 November", day: "Tuesday" },
  { sr: 33, name: "Hazarat Ali's Birthday", date: "23 December", day: "Wednesday" },
  { sr: 34, name: "Christmas Eve", date: "24 December", day: "Thursday" },
];

export const HolidayListTab = ({ semesterId, semesterStartDate, semesterEndDate }: { semesterId?: string, semesterStartDate?: string, semesterEndDate?: string }) => {
  const [activeSubTab, setActiveSubTab] = useState<"fixed" | "restricted">("fixed");
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncHolidays = async () => {
    if (!semesterId) {
      toast.error("No active semester to sync holidays to!");
      return;
    }
    
    setIsSyncing(true);
    try {
      const restrictedPayload = RESTRICTED_HOLIDAYS.map(h => {
        const parsedDate = parse(`${h.date} 2026`, "dd MMMM yyyy", new Date());
        const yyyyMmDd = format(parsedDate, "yyyy-MM-dd");
        return {
          title: `${h.name}`,
          eventType: "restricted_holiday",
          date: `${yyyyMmDd}T00:00:00Z`,
          allDay: true,
          isHolidayList: true,
        };
      });

      const fixedPayload = FIXED_HOLIDAYS.map(h => {
        const parsedDate = parse(`${h.date} 2026`, "dd MMMM yyyy", new Date());
        const yyyyMmDd = format(parsedDate, "yyyy-MM-dd");
        return {
          title: h.name,
          eventType: "holiday",
          date: `${yyyyMmDd}T00:00:00Z`,
          allDay: true,
          isHolidayList: true,
        };
      });

      let payloadEvents = [...fixedPayload, ...restrictedPayload];

      // Fetch existing events to resolve conflicts
      const res = await api.get(`/events?semesterId=${semesterId}`);
      const existingEvents: any[] = res.data || [];

      // Filter out any holidays from the payload that conflict with existing events (same date)
      payloadEvents = payloadEvents.filter(ev => {
        const hasConflict = existingEvents.some(existing => {
          const existingDate = new Date(existing.date).toISOString().split('T')[0];
          const payloadDate = ev.date.split('T')[0];
          return existingDate === payloadDate;
        });
        return !hasConflict;
      });

      await api.post("/events/save-wizard", {
        semesterId,
        events: payloadEvents,
      });

      toast.success(`Successfully synced ${payloadEvents.length} holidays for this semester!`);
      // Reload page to reflect changes in UI
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error("Failed to sync holidays", err);
      toast.error("Failed to sync holidays to calendar.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearEvents = async () => {
    toast("Clear Holidays", {
      description: "Are you sure you want to clear ALL synced holidays?",
      action: {
        label: "Clear All",
        onClick: async () => {
          try {
            await api.delete("/events/all?target=holiday_list");
            toast.success("Holidays cleared successfully!");
            setTimeout(() => window.location.reload(), 1500);
          } catch (err) {
            console.error(err);
            toast.error("Failed to clear holidays.");
          }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Holiday List 2026</h2>
          <p className="text-sm text-muted-foreground mt-1">Official list of holidays for the calendar year 2026.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <div className="flex bg-muted/50 p-1 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setActiveSubTab("fixed")}
              className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeSubTab === "fixed" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Fixed Holidays
            </button>
            <button
              onClick={() => setActiveSubTab("restricted")}
              className={`flex-1 md:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeSubTab === "restricted" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              Restricted Holidays
            </button>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleClearEvents}
              className="flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all whitespace-nowrap"
            >
              Clear All
            </button>

            <SaveToggle
              onClick={handleSyncHolidays}
              idleText="Sync to Calendar"
              savedText="Synced!"
              size="sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-card/50 border border-border/50 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-6 py-4 font-semibold w-16">Sr. No.</th>
                <th className="px-6 py-4 font-semibold">Holidays</th>
                <th className="px-6 py-4 font-semibold w-40">Date & Month</th>
                <th className="px-6 py-4 font-semibold w-32">Day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {(activeSubTab === "fixed" ? FIXED_HOLIDAYS : RESTRICTED_HOLIDAYS).map((holiday) => (
                <tr key={holiday.sr} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 text-muted-foreground">{holiday.sr}</td>
                  <td className="px-6 py-4 font-medium text-foreground">{holiday.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{holiday.date}</td>
                  <td className="px-6 py-4 text-muted-foreground">{holiday.day}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-600 dark:text-blue-400">
          <p className="font-semibold mb-1">Important Note</p>
          {activeSubTab === "fixed" ? (
            <p>* Holidays may change depending upon shifting of the moon. Holidays announced by Central Government Welfare coordination committee will be followed for these holidays.</p>
          ) : (
            <p>Restricted Holidays (02 Nos.) to be observed for the year 2026. Students and staff may choose any two holidays from this list.</p>
          )}
        </div>
      </div>
    </div>
  );
};

