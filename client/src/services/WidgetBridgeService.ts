import { registerPlugin, Capacitor } from '@capacitor/core';
import { useCacheStore } from '../stores/cacheStore';
import { useAttendanceStore } from '../stores/attendanceStore';

export interface WidgetDataPayload {
  date_formatted?: string;
  attendance_stat?: string;
  status_chip?: string;
  room?: string;
  subject_name?: string;
  class_time?: string;
  bunk_runway?: string;
  next_room?: string;
  next_countdown?: string;
  next_subject?: string;
  next_time?: string;
  next_runway?: string;
  today_classes_json?: string;
  subjects_json?: string;
  weekly_slots_json?: string;
  events_json?: string;
  semester_end_date?: string;
  today_is_holiday?: boolean;
  today_holiday_title?: string;
  schedule_date?: string;
  auth_token?: string;
  api_base_url?: string;
}

export interface WidgetPendingMutation {
  id?: string;
  subjectId: string;
  timetableSlotId?: string;
  overrideId?: string;
  date: string;
  status: string;
  timestamp: number;
  synced?: boolean;
}

interface WidgetPluginInterface {
  updateWidgetData(data: WidgetDataPayload): Promise<{ success: boolean }>;
  getPendingMutations(): Promise<{ mutations: WidgetPendingMutation[] }>;
  clearPendingMutations(): Promise<{ success: boolean }>;
  getBufferedAnnouncements(): Promise<{ announcements: Array<{ classroomId: string; announcement: any }> }>;
}

const WidgetBridge = registerPlugin<WidgetPluginInterface>('WidgetBridge');

const formatTime12h = (timeStr?: string): string => {
  if (!timeStr) return '--';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
};

export const WidgetBridgeService = {
  async syncWidgets(payload: WidgetDataPayload): Promise<void> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return;
    }
    try {
      await WidgetBridge.updateWidgetData(payload);
    } catch (e) {
      console.warn('[WidgetBridge] Failed to update Android widgets:', e);
    }
  },

  async reconcileBufferedAnnouncements(): Promise<void> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return;
    }
    try {
      const res = await WidgetBridge.getBufferedAnnouncements();
      const announcements = res?.announcements || [];
      if (announcements.length > 0) {
        console.log('[WidgetBridge] Ingesting', announcements.length, 'buffered background FCM announcements');
        const store = useCacheStore.getState();
        for (const item of announcements) {
          if (item?.classroomId && item?.announcement) {
            store.appendClassroomAnnouncement(item.classroomId, item.announcement);
          }
        }
      }
    } catch (e) {
      console.warn('[WidgetBridge] Failed to fetch buffered announcements:', e);
    }
  },

  async reconcilePendingWidgetMutations(): Promise<WidgetPendingMutation[]> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return [];
    }
    try {
      const res = await WidgetBridge.getPendingMutations();
      const mutations = res?.mutations || [];
      if (mutations.length > 0) {
        console.log('[WidgetBridge] Reconciling', mutations.length, 'widget mutations in foreground');

        const cache = useCacheStore.getState();
        const attStore = useAttendanceStore.getState();
        const { useOfflineStore } = await import('../stores/offlineStore');
        const offlineQueue = useOfflineStore.getState().queue;
        let currentSubjects = [...(attStore.subjects || [])];
        let totalAttended = attStore.totalAttended || 0;
        let totalClasses = attStore.totalClasses || 0;

        // Mutable working copy prevents frozen-snapshot double counting across multi-tap batches
        const todayMap: Record<string, any> = { ...(cache.today || {}) };

        const ensureDayAgenda = (dateStr: string) => {
          if (todayMap[dateStr] && Array.isArray(todayMap[dateStr].agenda)) {
            return todayMap[dateStr];
          }
          const [y, mo, d] = dateStr.split('-').map(Number);
          const dt = new Date(y, (mo || 1) - 1, d || 1);
          const jsDay = dt.getDay();
          const dbDay = jsDay === 0 ? 6 : jsDay - 1;
          const weeklySlots = cache.timetable?.slots || [];
          const daySlots = weeklySlots
            .filter((s: any) => s.dayOfWeek === dbDay && !s.validUntil)
            .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));
          const queuedExtraCreates = offlineQueue.filter(
            (q) => q.url.includes('/timetable/extra-class') && String(q.method || 'post').toLowerCase() === 'post' && q.data?.date === dateStr
          );
          const builtItems: any[] = daySlots.map((s: any, idx: number) => ({
            id: s.id || `slot_${idx}`,
            timetableSlotId: s.id,
            subjectId: s.subjectId,
            subject: s.subject || currentSubjects.find(sub => sub.id === s.subjectId || sub.subjectId === s.subjectId) || { id: s.subjectId, name: s.subjectName || 'Scheduled Class' },
            startTime: s.startTime,
            endTime: s.endTime,
            room: s.room,
            type: 'slot',
            status: null,
          }));
          for (const q of queuedExtraCreates) {
            const p = q.data || {};
            const extraId = p.tempId || q.tempId || `temp_extra_${q.id}`;
            if (!builtItems.some((item) => item.id === extraId)) {
              builtItems.push({
                id: extraId,
                overrideId: extraId,
                subjectId: p.subjectId,
                subject: currentSubjects.find(sub => sub.id === p.subjectId || sub.subjectId === p.subjectId) || { id: p.subjectId, name: 'Extra Class' },
                startTime: p.startTime || '09:00',
                endTime: p.endTime || '10:00',
                type: 'override',
                isExtra: true,
                status: null,
              });
            }
          }
          const built = {
            ...(todayMap[dateStr] || {}),
            agenda: builtItems,
          };
          todayMap[dateStr] = built;
          return built;
        };

        // Track only the final unsynced network mutation per target class+date
        const pendingNetworkMap = new Map<string, WidgetPendingMutation>();

        for (const m of mutations) {
          const mutKey = `${m.date}_${m.overrideId || m.timetableSlotId || m.subjectId}`;
          if (m.synced) {
            pendingNetworkMap.delete(mutKey);
          } else {
            pendingNetworkMap.set(mutKey, m);
          }

          const dayData = ensureDayAgenda(m.date);
          if (dayData && Array.isArray(dayData.agenda)) {
            const nextAgenda = dayData.agenda.map((item: any) => {
              const matchesOverride = m.overrideId && (item.id === m.overrideId || item.overrideId === m.overrideId);
              const matchesSlot = m.timetableSlotId && (item.id === m.timetableSlotId || item.timetableSlotId === m.timetableSlotId);
              const matchesSubj = !m.overrideId && !m.timetableSlotId && (item.subjectId === m.subjectId || item.subject?.id === m.subjectId);

              if (matchesOverride || matchesSlot || matchesSubj) {
                const prevStatus = item.status;
                const newStatus = m.status === 'clear' ? null : m.status;

                if (prevStatus !== newStatus) {
                  const subIdx = currentSubjects.findIndex(s => s.id === m.subjectId || s.subjectId === m.subjectId);
                  if (subIdx !== -1) {
                    let subAtt = currentSubjects[subIdx].attended || 0;
                    let subTot = currentSubjects[subIdx].total || 0;
                    const prevLower = (prevStatus || '').toLowerCase();
                    const newLower = (newStatus || '').toLowerCase();

                    if (prevLower === 'present' || prevLower === 'attended' || prevLower === 'medical' || prevLower === 'od') {
                      subAtt = Math.max(0, subAtt - 1);
                      subTot = Math.max(0, subTot - 1);
                      totalAttended = Math.max(0, totalAttended - 1);
                      totalClasses = Math.max(0, totalClasses - 1);
                    } else if (prevLower === 'absent' || prevLower === 'missed') {
                      subTot = Math.max(0, subTot - 1);
                      totalClasses = Math.max(0, totalClasses - 1);
                    }

                    if (newLower === 'present' || newLower === 'attended' || newLower === 'medical' || newLower === 'od') {
                      subAtt += 1;
                      subTot += 1;
                      totalAttended += 1;
                      totalClasses += 1;
                    } else if (newLower === 'absent' || newLower === 'missed') {
                      subTot += 1;
                      totalClasses += 1;
                    }

                    const subPct = subTot > 0 ? (subAtt / subTot) * 100 : 0;
                    currentSubjects[subIdx] = {
                      ...currentSubjects[subIdx],
                      attended: subAtt,
                      total: subTot,
                      percentage: Number(subPct.toFixed(1)),
                    };
                  }
                }

                return { ...item, status: newStatus };
              }
              return item;
            });

            todayMap[m.date] = { ...dayData, agenda: nextAgenda };
          }
        }

        cache.setCache('today', todayMap);

        const overallPercentage = totalClasses > 0 ? Number(((totalAttended / totalClasses) * 100).toFixed(1)) : 0;
        useAttendanceStore.setState({
          subjects: currentSubjects,
          totalAttended,
          totalClasses,
          overallPercentage,
        });
        cache.setCache('subjects', {
          ...(cache.subjects || {}),
          stats: currentSubjects,
          activeSemesterId: attStore.activeSemesterId || cache.subjects?.activeSemesterId || null,
        });

        const unsyncedMutations = Array.from(pendingNetworkMap.values());
        if (unsyncedMutations.length > 0) {
          const { api } = await import('../lib/api');

          for (const m of unsyncedMutations) {
            try {
              await api.post("/attendance/mark", {
                subjectId: m.subjectId,
                date: m.date,
                status: m.status,
                timetableSlotId: m.timetableSlotId || undefined,
                overrideId: m.overrideId || undefined,
              }, { silent: true, skipToast: true } as any);
            } catch (err) {
              console.warn('[WidgetBridge] Failed to persist widget mutation online, safely queueing into offlineStore:', err);
              const { useOfflineStore } = await import('../stores/offlineStore');
              useOfflineStore.getState().enqueue({
                method: 'POST',
                url: '/attendance/mark',
                data: {
                  subjectId: m.subjectId,
                  date: m.date,
                  status: m.status,
                  timetableSlotId: m.timetableSlotId || undefined,
                  overrideId: m.overrideId || undefined,
                },
              });
            }
          }
        }

        attStore.invalidateInFlightStats();
        window.dispatchEvent(new CustomEvent('widget_attendance_marked', { detail: { mutations } }));
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            await useAttendanceStore.getState().fetchStats(true);
          } catch {}
        }
      }
      return mutations;
    } catch (e) {
      console.warn('[WidgetBridge] Failed to reconcile pending widget mutations:', e);
      return [];
    }
  },

  async syncFromAppState(params: {
    agenda?: any[];
    overallPercentage?: number;
    subjects?: any[];
    todayStatus?: any;
    weeklySlots?: any[];
  }): Promise<void> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return;
    }

    try {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMins = now.getMinutes();
      const currentTotalMins = currentHours * 60 + currentMins;
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Date string: e.g. "Tue, 17 Nov"
      const dateFormatted = now.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });

      // Attendance percentage
      const pct = params.overallPercentage != null ? params.overallPercentage : 0;
      const attendanceStat = `${pct.toFixed(1)}%`;

      const agenda = params.agenda || [];
      const subjects = params.subjects || [];
      const todayStatus = params.todayStatus;
      const weeklySlots = params.weeklySlots || [];

      // Helper to compute runway text for a subject
      const getSubjectRunway = (subId?: string): string => {
        if (!subId) return 'Safe';
        const sub = subjects.find(s => s.id === subId || s.subjectId === subId);
        if (!sub) return 'Safe';
        const target = sub.targetPercentage ?? sub.target ?? 75;
        const attended = sub.attended || 0;
        const total = sub.total || 0;
        if (total === 0) return 'Safe';
        
        // Can miss = floor((attended - target/100 * total) / (target/100))
        const canMiss = Math.floor((attended - (target / 100) * total) / (target / 100));
        if (canMiss > 1) return `${canMiss} Bunks Safe`;
        if (canMiss === 1) return '1 Bunk Safe';
        if (canMiss === 0) return "Can't Miss Next";
        
        // Need consecutive = ceil((target/100 * total - attended) / (1 - target/100))
        const need = Math.ceil(((target / 100) * total - attended) / (1 - target / 100));
        return `Need ${Math.max(1, need)} Classes`;
      };

      // Rich today_classes_json array: clearly separate regular slots, overrides, and manual logs
      const todayClasses = agenda.map((item, idx) => {
        const isOverride = item.type === "override";
        const isSlot = !isOverride && item.type !== "manual";
        return {
          id: item.id || `slot_${idx}`,
          slotId: isSlot ? (item.timetableSlotId || item.id) : undefined,
          overrideId: isOverride ? (item.overrideId || item.id) : item.overrideId || undefined,
          subjectId: item.subject?.id || item.subjectId,
          subjectName: item.subject?.name || item.subjectName || "Scheduled Class",
          startTime: item.startTime || "00:00",
          endTime: item.endTime || "00:00",
          timeRange: `${formatTime12h(item.startTime)} – ${formatTime12h(item.endTime)}`,
          room: item.room ? item.room.trim() : "",
          status: item.status || null,
          bunkRunway: getSubjectRunway(item.subject?.id || item.subjectId),
          type: isOverride ? "override" : (item.type === "manual" ? "manual" : "slot"),
          isExtra: Boolean(item.isExtra),
        };
      });

      // Serializable subjects array
      const subjectsJson = subjects.map(s => ({
        id: s.id || s.subjectId,
        subjectId: s.subjectId || s.id,
        name: s.name,
        attended: s.attended || 0,
        total: s.total || 0,
        targetPercentage: s.targetPercentage ?? s.target ?? 75,
      }));

      const authState = (await import('../stores/authStore')).useAuthStore.getState();
      const authToken = authState.accessToken || localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
      const apiBaseUrl = (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.startsWith('/'))
        ? import.meta.env.VITE_API_URL
        : 'https://attendx.tech/api';

      const cacheState = useCacheStore.getState();
      const eventsArr = useAttendanceStore.getState().events || [];
      const serializedEvents = eventsArr.map((ev: any) => ({
        title: ev.title || '',
        type: ev.eventType || ev.type || '',
        date: ev.date || '',
        endDate: ev.endDate || ev.date || '',
      }));
      const semesterEndDate = cacheState.semester?.activeSemester?.endDate || '';

      const commonPayload = {
        schedule_date: todayStr,
        weekly_slots_json: JSON.stringify(weeklySlots),
        today_classes_json: JSON.stringify(todayClasses),
        subjects_json: JSON.stringify(subjectsJson),
        events_json: JSON.stringify(serializedEvents),
        semester_end_date: semesterEndDate,
        today_is_holiday: Boolean(todayStatus?.isHoliday),
        today_holiday_title: (todayStatus?.title || '').trim() || 'Holiday / Institute Closed',
        auth_token: authToken,
        api_base_url: apiBaseUrl,
      };

      // 1. Holiday State
      if (todayStatus?.isHoliday) {
        await this.syncWidgets({
          ...commonPayload,
          date_formatted: dateFormatted,
          attendance_stat: attendanceStat,
          status_chip: '🌴 HOLIDAY',
          room: 'Campus Closed',
          subject_name: todayStatus.title || 'Holiday / Institute Closed',
          class_time: 'No classes today',
          bunk_runway: 'No Impact',
          next_room: '📍 HOLIDAY',
          next_countdown: '🌴 NO CLASS',
          next_subject: todayStatus.title || 'Institute Holiday',
          next_time: 'Campus Closed',
          next_runway: 'Safe',
        });
        return;
      }

      // 2. No classes scheduled
      if (agenda.length === 0) {
        await this.syncWidgets({
          ...commonPayload,
          date_formatted: dateFormatted,
          attendance_stat: attendanceStat,
          status_chip: '☕ FREE',
          room: 'No Classes',
          subject_name: 'No lectures scheduled today',
          class_time: 'Enjoy your day',
          bunk_runway: 'Attendance Safe',
          next_room: '📍 FREE DAY',
          next_countdown: '☕ RELAX',
          next_subject: 'No classes scheduled today',
          next_time: 'Free schedule',
          next_runway: 'Safe',
        });
        return;
      }

      // 3. Find Ongoing Class
      let activeItem: any = null;
      let nextItem: any = null;

      for (const item of agenda) {
        const [startH, startM] = (item.startTime || '00:00').split(':').map(Number);
        const [endH, endM] = (item.endTime || '00:00').split(':').map(Number);
        const startTotal = (startH || 0) * 60 + (startM || 0);
        const endTotal = (endH || 0) * 60 + (endM || 0);
        const effEnd = endTotal === 0 && startTotal > 0 ? 1440 : endTotal;
        const isOngoingWindow = effEnd > startTotal
          ? (currentTotalMins >= startTotal && currentTotalMins < effEnd)
          : (effEnd !== startTotal && endTotal > 0 && (currentTotalMins >= startTotal || currentTotalMins < effEnd));

        if (isOngoingWindow) {
          activeItem = item;
          break;
        } else if (currentTotalMins < startTotal && !nextItem) {
          nextItem = item;
        }
      }

      // If no active item, and nextItem exists, spotlight the upcoming one
      const spotlight = activeItem || nextItem;

      if (!spotlight) {
        // All classes completed for today!
        await this.syncWidgets({
          ...commonPayload,
          date_formatted: dateFormatted,
          attendance_stat: attendanceStat,
          status_chip: '🎉 ALL DONE',
          room: 'Schedule Complete',
          subject_name: `All ${agenda.length} classes completed!`,
          class_time: 'Great job today',
          bunk_runway: 'Attendance Recorded',
          next_room: '📍 COMPLETED',
          next_countdown: '🎉 DONE',
          next_subject: 'All classes completed today',
          next_time: 'Free for the day',
          next_runway: 'Safe',
        });
        return;
      }

      const isOngoing = activeItem === spotlight;
      let countdown = '';
      if (!isOngoing) {
        const [startH, startM] = (spotlight.startTime || '00:00').split(':').map(Number);
        const startTotal = startH * 60 + startM;
        const diff = startTotal - currentTotalMins;
        if (diff <= 60) {
          countdown = `IN ${diff}M`;
        } else {
          countdown = `AT ${formatTime12h(spotlight.startTime)}`;
        }
      } else {
        countdown = `ENDS ${formatTime12h(spotlight.endTime)}`;
      }

      const subName = spotlight.subject?.name || spotlight.subjectName || 'Scheduled Class';
      const roomNum = spotlight.room ? `Room ${spotlight.room.replace(/^Room\s*/i, '')}` : 'Room TBA';
      const timeRange = `${formatTime12h(spotlight.startTime)} – ${formatTime12h(spotlight.endTime)}`;
      const runway = getSubjectRunway(spotlight.subject?.id || spotlight.subjectId);

      await this.syncWidgets({
        ...commonPayload,
        date_formatted: dateFormatted,
        attendance_stat: attendanceStat,
        status_chip: isOngoing ? '🟢 ONGOING' : `⏱️ ${countdown}`,
        room: `📍 ${roomNum}`,
        subject_name: subName,
        class_time: timeRange,
        bunk_runway: runway,

        // 1x2 Next Class Glance Widget Fields
        next_room: `📍 ${roomNum.toUpperCase()}`,
        next_countdown: isOngoing ? '⚡ ONGOING' : `⏱️ ${countdown}`,
        next_subject: subName,
        next_time: timeRange,
        next_runway: runway,
      });
    } catch (err) {
      console.warn('[WidgetBridge] Error calculating widget data:', err);
    }
  },
};
