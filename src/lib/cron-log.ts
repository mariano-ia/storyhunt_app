import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { Resend } from 'resend';

// Shared cron observability. Before 2026-08-27 only abandon-stale-sessions
// wrote cron_runs rows — it then failed silently for 101 straight days.
// Every cron logs here, and the two daily crons cross-monitor each other so a
// dead or failing cron pages within 48h instead of never.

const ALERT_TO = process.env.NOTIFICATION_EMAIL || 'marianonoceti@gmail.com';
const STALE_CRON_HOURS = 48;
const ALERT_COOLDOWN_HOURS = 48;

export async function logCronRun(
    cron: string,
    startedAt: string,
    ok: boolean,
    counts: Record<string, unknown> = {},
    error?: string
) {
    try {
        await getAdminDb().collection('cron_runs').add({
            cron,
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            ok,
            counts,
            ...(error ? { error } : {}),
            timestamp: FieldValue.serverTimestamp(),
        });
    } catch (err) {
        console.error(`[cron-log] failed to log ${cron}:`, err);
    }
}

// Alerts when a watched cron has no cron_runs row in 48h (silent death) or its
// latest row is ok:false (loud death). Cooldown keeps it to one email per cron
// per 48h. Uses only a single-field orderBy — no composite index required.
export async function checkCronHealth(watch: string[]) {
    try {
        const db = getAdminDb();
        const recent = await db.collection('cron_runs')
            .orderBy('started_at', 'desc')
            .limit(60)
            .get();

        const lastSeen: Record<string, { started_at: string; ok: boolean; error?: string }> = {};
        recent.forEach(doc => {
            const d = doc.data();
            if (d.cron && !lastSeen[d.cron]) {
                lastSeen[d.cron] = { started_at: d.started_at, ok: !!d.ok, error: d.error };
            }
        });

        const cutoff = new Date(Date.now() - STALE_CRON_HOURS * 3600 * 1000).toISOString();
        const problems: string[] = [];
        for (const cron of watch) {
            const last = lastSeen[cron];
            if (!last || last.started_at < cutoff) {
                problems.push(`${cron}: sin corridas registradas hace >${STALE_CRON_HOURS}h (última: ${last?.started_at || 'nunca en ventana'})`);
            } else if (!last.ok) {
                problems.push(`${cron}: última corrida FALLÓ (${last.started_at})${last.error ? ` — ${last.error}` : ''}`);
            }
        }
        if (problems.length === 0) return;

        // Cooldown so a broken cron pages once per 48h, not daily.
        const alertRef = db.collection('cron_health').doc('alerts');
        const alertDoc = await alertRef.get();
        const lastAlerts: Record<string, string> = alertDoc.exists ? (alertDoc.data()?.last_alert || {}) : {};
        const cooldownCutoff = new Date(Date.now() - ALERT_COOLDOWN_HOURS * 3600 * 1000).toISOString();
        const toAlert = problems.filter(p => {
            const cron = p.split(':')[0];
            return !lastAlerts[cron] || lastAlerts[cron] < cooldownCutoff;
        });
        if (toAlert.length === 0) return;

        if (process.env.RESEND_API_KEY) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            await resend.emails.send({
                from: 'StoryHunt Ops <hello@storyhunt.city>',
                to: ALERT_TO,
                subject: `[CRON ALERT] ${toAlert.length} cron(s) con problemas`,
                html: `<p>Detección automática de crons caídos o fallando:</p><ul>${toAlert.map(p => `<li>${p}</li>`).join('')}</ul><p>Ver colección cron_runs en Firestore. — cron-health, storyhunt-app</p>`,
            });
        } else {
            console.error('[cron-health] problems but no RESEND_API_KEY:', toAlert);
        }

        const updated = { ...lastAlerts };
        const nowIso = new Date().toISOString();
        for (const p of toAlert) updated[p.split(':')[0]] = nowIso;
        await alertRef.set({ last_alert: updated }, { merge: true });
    } catch (err) {
        // Health-checking must never break the caller cron.
        console.error('[cron-health] check failed:', err);
    }
}
