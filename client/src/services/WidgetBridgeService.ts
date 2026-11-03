import { registerPlugin, Capacitor } from '@capacitor/core';

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
}

interface WidgetPluginInterface {
  updateWidgetData(data: WidgetDataPayload): Promise<{ success: boolean }>;
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
        const sub = subjects.find(s => s.id === subId);
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
      });
    } catch (err) {
      console.warn('[WidgetBridge] Error calculating widget data:', err);
    }
  },
};
