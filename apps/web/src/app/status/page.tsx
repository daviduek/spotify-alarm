import type { Metadata } from 'next';

import type { Locale } from '../../lib/i18n';
import { getLocale } from '../../lib/i18n/server';

type Phase = { id: string; name: string; state: string; note: string };

const STR: Record<Locale, { title: string; introBefore: string; introAfter: string; phase: string; name: string; state: string; scope: string; phases: Phase[] }> = {
  en: {
    title: 'Build status',
    introBefore: 'Wake is being built reliability-first (see ',
    introAfter: ' in the repository). This page mirrors the implementation phases from the product specification.',
    phase: 'Phase',
    name: 'Name',
    state: 'State',
    scope: 'Scope',
    phases: [
      { id: '0', name: 'Technical validation', state: 'in progress', note: 'Native AlarmKit + AlarmManager spikes, Spotify behaviour matrix on real devices.' },
      { id: '1', name: 'Core alarm engine', state: 'next', note: 'Domain, DB, native schedulers, firing screen, stop/snooze, local audio.' },
      { id: '2', name: 'Alarm management UI', state: 'planned', note: 'List, create, edit, delete, weekdays, label, snooze, vibration.' },
      { id: '3', name: 'Recordings', state: 'planned', note: 'Record, preview, save, rename, delete, select, alarm playback.' },
      { id: '4', name: 'Progressive wake-up', state: 'planned', note: 'Fade engine, presets, custom duration, test.' },
      { id: '5', name: 'Spotify', state: 'planned', note: 'OAuth, selection, playback attempt, fallback, readiness.' },
      { id: '6', name: 'Reliability', state: 'planned', note: 'Readiness, diagnostics, reboot, time zones, permission repair, upgrade reconciliation.' },
      { id: '7', name: 'Polish', state: 'planned', note: 'Animations, onboarding, haptics, accessibility, empty states.' },
    ],
  },
  es: {
    title: 'Estado del desarrollo',
    introBefore: 'Wake se está construyendo priorizando la confiabilidad (mira ',
    introAfter: ' en el repositorio). Esta página refleja las fases de implementación de la especificación del producto.',
    phase: 'Fase',
    name: 'Nombre',
    state: 'Estado',
    scope: 'Alcance',
    phases: [
      { id: '0', name: 'Validación técnica', state: 'en curso', note: 'Pruebas nativas de AlarmKit + AlarmManager, matriz de comportamiento de Spotify en dispositivos reales.' },
      { id: '1', name: 'Motor de alarmas', state: 'siguiente', note: 'Dominio, DB, planificadores nativos, pantalla de disparo, detener/snooze, audio local.' },
      { id: '2', name: 'UI de gestión de alarmas', state: 'planificada', note: 'Listar, crear, editar, eliminar, días de la semana, etiqueta, snooze, vibración.' },
      { id: '3', name: 'Grabaciones', state: 'planificada', note: 'Grabar, previsualizar, guardar, renombrar, eliminar, seleccionar, reproducción en la alarma.' },
      { id: '4', name: 'Despertar progresivo', state: 'planificada', note: 'Motor de fade, presets, duración personalizada, prueba.' },
      { id: '5', name: 'Spotify', state: 'planificada', note: 'OAuth, selección, intento de reproducción, fallback, verificación de preparación.' },
      { id: '6', name: 'Confiabilidad', state: 'planificada', note: 'Preparación, diagnósticos, reinicio, zonas horarias, reparación de permisos, reconciliación tras actualizaciones.' },
      { id: '7', name: 'Pulido', state: 'planificada', note: 'Animaciones, onboarding, hápticos, accesibilidad, estados vacíos.' },
    ],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: STR[locale].title };
}

export default async function StatusPage() {
  const locale = await getLocale();
  const t = STR[locale];
  return (
    <main>
      <h1>{t.title}</h1>
      <p style={{ color: 'var(--dim)' }}>
        {t.introBefore}<code>docs/ARCHITECTURE.md</code>{t.introAfter}
      </p>
      <table>
        <thead>
          <tr>
            <th>{t.phase}</th>
            <th>{t.name}</th>
            <th>{t.state}</th>
            <th>{t.scope}</th>
          </tr>
        </thead>
        <tbody>
          {t.phases.map((p) => (
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
