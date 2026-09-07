import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Wake — build status' };

const phases = [
  { id: '0', name: 'Technical validation', state: 'in progress', note: 'Native AlarmKit + AlarmManager spikes, Spotify behaviour matrix on real devices.' },
  { id: '1', name: 'Core alarm engine', state: 'next', note: 'Domain, DB, native schedulers, firing screen, stop/snooze, local audio.' },
  { id: '2', name: 'Alarm management UI', state: 'planned', note: 'List, create, edit, delete, weekdays, label, snooze, vibration.' },
  { id: '3', name: 'Recordings', state: 'planned', note: 'Record, preview, save, rename, delete, select, alarm playback.' },
  { id: '4', name: 'Progressive wake-up', state: 'planned', note: 'Fade engine, presets, custom duration, test.' },
  { id: '5', name: 'Spotify', state: 'planned', note: 'OAuth, selection, playback attempt, fallback, readiness.' },
  { id: '6', name: 'Reliability', state: 'planned', note: 'Readiness, diagnostics, reboot, time zones, permission repair, upgrade reconciliation.' },
  { id: '7', name: 'Polish', state: 'planned', note: 'Animations, onboarding, haptics, accessibility, empty states.' },
];

export default function StatusPage() {
  return (
    <main>
      <h1>Build status</h1>
      <p style={{ color: 'var(--dim)' }}>
        Wake is being built reliability-first (see <code>docs/ARCHITECTURE.md</code> in the repository). This page mirrors the implementation phases from the
        product specification.
      </p>
      <table>
        <thead>
          <tr>
            <th>Phase</th>
            <th>Name</th>
            <th>State</th>
            <th>Scope</th>
          </tr>
        </thead>
        <tbody>
          {phases.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.name}</td>
              <td>
                <span className="pill">{p.state}</span>
              </td>
              <td>{p.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
