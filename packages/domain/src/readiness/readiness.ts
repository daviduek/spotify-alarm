import type { Alarm } from '../alarm/types';
import { planIncludesProvider, planIncludesRecording } from '../audio/plan';
import type { ProviderReadiness } from '../music/types';
import type { PermissionSnapshot } from '../scheduler/types';

export type ReadinessIssueCode =
  | 'alarm_permission_missing'
  | 'notification_permission_missing'
  | 'full_screen_intent_missing'
  | 'native_schedule_missing'
  | 'fallback_sound_missing'
  | 'recording_file_missing'
  | 'provider_not_authenticated'
  | 'provider_app_missing'
  | 'provider_premium_required'
  | 'provider_connection_problem'
  | 'provider_unknown';

export type ReadinessIssue = {
  code: ReadinessIssueCode;
  /** blocking = the alarm may not ring; warning = it rings, but not as configured. */
  severity: 'blocking' | 'warning';
  title: string;
  detail: string;
  /** Suggested CTA label, if the user can fix it. */
  action?: 'open_settings' | 'connect_provider' | 'choose_sound' | 'reschedule' | 'install_provider_app';
};

export type AlarmReadiness = {
  alarmScheduled: boolean;
  localFallbackReady: boolean;
  spotifyReady?: boolean;
  permissionsReady: boolean;
  issues: ReadinessIssue[];
  status: 'ready' | 'attention' | 'blocked';
  headline: string;
  detail?: string;
};

export type ReadinessInput = {
  alarm: Alarm;
  permissions: PermissionSnapshot;
  nativeScheduled: boolean;
  fallbackSoundAvailable: boolean;
  recordingAvailable?: boolean;
  provider?: { name: string; readiness: ProviderReadiness };
};

/**
 * Spec §26/§28/§55. The user should never wonder "will my alarm actually ring?".
 * Rule: if the OS alarm is scheduled and a local fallback exists, the alarm is
 * never described as broken — provider problems are warnings, not failures.
 */
export function computeReadiness(input: ReadinessInput): AlarmReadiness {
  const issues: ReadinessIssue[] = [];
  const { alarm, permissions } = input;

  const permissionsReady = permissions.alarms === 'granted' || permissions.alarms === 'not_applicable';
  if (!permissionsReady) {
    issues.push({
      code: 'alarm_permission_missing',
      severity: 'blocking',
      title: "Wake can't schedule alarms",
      detail: 'Enable alarm access to continue using your alarms.',
      action: 'open_settings',
    });
  }
  if (permissions.fullScreenIntent === 'denied') {
    issues.push({
      code: 'full_screen_intent_missing',
      severity: 'warning',
      title: 'Alarm screen may not appear over the lock screen',
      detail: 'Allow full-screen alarms so STOP and SNOOZE show when your phone is locked.',
      action: 'open_settings',
    });
  }
  if (permissions.notifications === 'denied') {
    issues.push({
      code: 'notification_permission_missing',
      severity: 'warning',
      title: 'Notifications are off',
      detail: 'Wake uses a notification to show the alarm when the screen is on.',
      action: 'open_settings',
    });
  }

  const alarmScheduled = input.nativeScheduled;
  if (alarm.enabled && permissionsReady && !alarmScheduled) {
    issues.push({
      code: 'native_schedule_missing',
      severity: 'blocking',
      title: 'Alarm is not scheduled',
      detail: 'Wake could not confirm the system alarm. Open the alarm and save it again.',
      action: 'reschedule',
    });
  }

  const localFallbackReady = input.fallbackSoundAvailable;
  if (!localFallbackReady) {
    issues.push({
      code: 'fallback_sound_missing',
      severity: 'blocking',
      title: 'Fallback sound missing',
      detail: 'Choose a Wake sound so the alarm can always ring.',
      action: 'choose_sound',
    });
  }

  if (planIncludesRecording(alarm.audioPlan) && input.recordingAvailable === false) {
    issues.push({
      code: 'recording_file_missing',
      severity: 'warning',
      title: 'Recording not found',
      detail: 'Your recording file is missing. The fallback sound will play instead.',
      action: 'choose_sound',
    });
  }

  let spotifyReady: boolean | undefined;
  if (input.provider && planIncludesProvider(alarm.audioPlan)) {
    const { name, readiness } = input.provider;
    spotifyReady = readiness === 'ready';
    const issue = providerIssue(name, readiness);
    if (issue) issues.push(issue);
  }

  const blocking = issues.some((i) => i.severity === 'blocking');
  const status: AlarmReadiness['status'] = blocking ? 'blocked' : issues.length > 0 ? 'attention' : 'ready';

  return {
    alarmScheduled,
    localFallbackReady,
    spotifyReady,
    permissionsReady,
    issues,
    status,
    ...headlineFor(status, issues, input.provider?.name),
  };
}

function providerIssue(name: string, readiness: ProviderReadiness): ReadinessIssue | null {
  const fallback = 'Your fallback sound will still play.';
  switch (readiness) {
    case 'ready':
      return null;
    case 'not_authenticated':
      return {
        code: 'provider_not_authenticated',
        severity: 'warning',
        title: `${name} not connected`,
        detail: `${name} may not start automatically. ${fallback}`,
        action: 'connect_provider',
      };
    case 'app_missing':
      return {
        code: 'provider_app_missing',
        severity: 'warning',
        title: `${name} app missing`,
        detail: `Install ${name} to wake up with your music. ${fallback}`,
        action: 'install_provider_app',
      };
    case 'premium_required':
      return {
        code: 'provider_premium_required',
        severity: 'warning',
        title: `${name} Premium required`,
        detail: `${name} only allows remote playback on Premium accounts. ${fallback}`,
      };
    case 'connection_problem':
      return {
        code: 'provider_connection_problem',
        severity: 'warning',
        title: `${name} unavailable`,
        detail: `${name} may not start automatically. ${fallback}`,
        action: 'connect_provider',
      };
    case 'unknown':
      return {
        code: 'provider_unknown',
        severity: 'warning',
        title: `${name} status unknown`,
        detail: `We couldn't check ${name}. ${fallback}`,
      };
  }
}

function headlineFor(
  status: AlarmReadiness['status'],
  issues: ReadinessIssue[],
  providerName?: string,
): { headline: string; detail?: string } {
  if (status === 'ready') return { headline: 'Ready for tomorrow' };
  if (status === 'blocked') {
    const first = issues.find((i) => i.severity === 'blocking');
    return { headline: 'Needs attention', detail: first?.detail };
  }
  const providerWarning = issues.find((i) => i.code.startsWith('provider_'));
  if (providerWarning) {
    return { headline: `${providerName ?? 'Music'} unavailable`, detail: 'Fallback sound ready' };
  }
  return { headline: 'Ready, with a note', detail: issues[0]?.detail };
}
