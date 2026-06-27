// notifications.ts — on-device kick-off reminders for the Capacitor native build.
// No backend needed: the full schedule lives in matches.json, so we schedule local
// notifications ~15 min before each upcoming kick-off. Guarded to native platforms;
// a no-op on the web (so the website is completely unaffected).
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Match } from './types';

const REMIND_MS = 15 * 60 * 1000;   // notify 15 minutes before kick-off
const MAX_SCHEDULED = 60;           // iOS caps pending notifications (~64) — stay under

export async function scheduleKickoffReminders(matches: Match[], now: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;   // web / dev → do nothing
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;

    const upcoming = matches
      .filter(m => m.kickoffUTC - REMIND_MS > now)
      .sort((a, b) => a.kickoffUTC - b.kickoffUTC)
      .slice(0, MAX_SCHEDULED);

    // Clear any previously-scheduled reminders to avoid duplicates on relaunch.
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
    }

    await LocalNotifications.schedule({
      notifications: upcoming.map(m => ({
        id: m.num,
        title: `${m.teams[0].short} v ${m.teams[1].short} — kick-off soon`,
        body: `${m.stageShort}${m.city ? ` · ${m.city}` : ''}. Kicks off in 15 minutes.`,
        schedule: { at: new Date(m.kickoffUTC - REMIND_MS) },
      })),
    });
  } catch (err) {
    console.warn('[notifications] scheduleKickoffReminders failed:', err);
  }
}
