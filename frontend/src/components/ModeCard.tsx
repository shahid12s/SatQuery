import type { AgentMode } from '../data/agentModes'

export function ModeCard({ mode, active }: { mode: AgentMode; active: boolean }) {
  return (
    <article className={`mode-card ${active ? 'mode-card--active' : ''} ${mode.selectable ? '' : 'mode-card--locked'}`} aria-disabled={!mode.selectable}>
      <span className={`mode-icon mode-icon--${mode.icon}`} aria-hidden="true" />
      <div>
        <h3>{mode.title}</h3>
        <p>{mode.subtitle}</p>
      </div>
    </article>
  )
}
