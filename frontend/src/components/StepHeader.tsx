export function StepHeader({ number, title, description }: { number: string; title: string; description?: string }) {
  return (
    <header className="step-header">
      <h2><span>{number}.</span> {title}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  )
}
