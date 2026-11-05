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
  auth_token?: string;
  api_base_url?: string;
}

export interface WidgetPendingMutation {
  subjectId: string;
  timetableSlotId?: string;
  date: string;
  status: string;
  timestamp: number;
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
        
        // 1. Immediately apply to local in-memory cache so TodayPage and Subject Detail reflect marks without delay
        const cache = useCacheStore.getState();
        mutations.forEach(m => {
          const dayData = cache.today?.[m.date];
          if (dayData && Array.isArray(dayData.agenda)) {
            const nextAgenda = dayData.agenda.map((item: any) => {
              const matchesSlot = m.timetableSlotId && (item.id === m.timetableSlotId || item.timetableSlotId === m.timetableSlotId);
              const matchesSubj = !m.timetableSlotId && (item.subjectId === m.subjectId || item.subject?.id === m.subjectId);
              if (matchesSlot || matchesSubj) {
                return { ...item, status: m.status === 'clear' ? null : m.status };
              }
              return item;
            });
            cache.setCache('today', {
              ...cache.today,
              [m.date]: { ...dayData, agenda: nextAgenda }
            });
          }
        });

        const { api } = await import('../lib/api');
        for (const m of mutations) {
          try {
            await api.post("/attendance/mark", {
              subjectId: m.subjectId,
              date: m.date,
              status: m.status,
              timetableSlotId: m.timetableSlotId,
            }, { silent: true, skipToast: true } as any);
          } catch (err) {
            console.warn('[WidgetBridge] Failed to persist widget mutation to server:', err);
          }
        }

        // 2. Dispatch events to notify listeners and fetch fresh attendance stats
        window.dispatchEvent(new CustomEvent('widget_attendance_marked', { detail: { mutations } }));
        useAttendanceStore.getState().fetchStats(true);
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
  }): Promise<void> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return;
    }

    try {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMins = now.getMinutes();
      const currentTotalMins = currentHours * 60 + currentMins;

      // Date string: e.g. "Tuesday, 4 Nov"
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

      // Helper to compute runway text for a subject
      const getSubjectRunway = (subId?: string): string => {
        if (!subId) return 'Safe';
        const sub = subjects.find(s => s.id === subId || s.subjectId === subId);
        if (!sub) return 'Safe';
        const target = sub.targetPercentage || 75;
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

      // Rich today_classes_json array for direct home screen marking
      const todayClasses = agenda.map((item, idx) => ({
        id: item.id || `slot_${idx}`,
        subjectId: item.subject?.id || item.subjectId,
        subjectName: item.subject?.name || item.subjectName || "Scheduled Class",
        startTime: item.startTime || "00:00",
        endTime: item.endTime || "00:00",
        timeRange: `${formatTime12h(item.startTime)} – ${formatTime12h(item.endTime)}`,
        room: item.room ? item.room.trim() : "",
        status: item.status || null,
        bunkRunway: getSubjectRunway(item.subject?.id || item.subjectId),
        type: item.type || "slot",
      }));

      // Serializable subjects array
      const subjectsJson = subjects.map(s => ({
        id: s.id || s.subjectId,
        name: s.name,
        attended: s.attended || 0,
        total: s.total || 0,
        targetPercentage: s.targetPercentage || 75,
      }));

      const authState = (await import('../stores/authStore')).useAuthStore.getState();
      const authToken = authState.accessToken || localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
      const apiBaseUrl = (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.startsWith('/'))
        ? import.meta.env.VITE_API_URL
        : 'https://attendx.tech/api';

      // 1. Holiday State
      if (todayStatus?.isHoliday) {
        await this.syncWidgets({
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
          today_classes_json: JSON.stringify(todayClasses),
          subjects_json: JSON.stringify(subjectsJson),
          auth_token: authToken,
          api_base_url: apiBaseUrl,
        });
        return;
      }

      // 2. No classes scheduled
      if (agenda.length === 0) {
        await this.syncWidgets({
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
          today_classes_json: JSON.stringify(todayClasses),
          subjects_json: JSON.stringify(subjectsJson),
          auth_token: authToken,
          api_base_url: apiBaseUrl,
        });
        return;
      }

      // 3. Find Ongoing Class
      let activeItem: any = null;
      let nextItem: any = null;

      for (const item of agenda) {
        const [startH, startM] = (item.startTime || '00:00').split(':').map(Number);
        const [endH, endM] = (item.endTime || '00:00').split(':').map(Number);
        const startTotal = startH * 60 + startM;
        const endTotal = endH * 60 + endM;

        if (currentTotalMins >= startTotal && currentTotalMins < endTotal) {
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
          today_classes_json: JSON.stringify(todayClasses),
          subjects_json: JSON.stringify(subjectsJson),
          auth_token: authToken,
          api_base_url: apiBaseUrl,
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

        // Rich interactive widget data
        today_classes_json: JSON.stringify(todayClasses),
        subjects_json: JSON.stringify(subjectsJson),
        auth_token: authToken,
        api_base_url: apiBaseUrl,
      });
    } catch (err) {
      console.warn('[WidgetBridge] Error calculating widget data:', err);
    }
  },
};
