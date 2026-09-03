export type AiResponseState = {
  status: 'idle' | 'loading' | 'success' | 'error'
  answer: string
  error: string
  model: string
}

export function AnswerPanel({ response }: { response: AiResponseState }) {
  return (
    <article className="answer-card">
      <h3>Answer</h3>
      {response.status === 'idle' ? <AnswerSkeleton /> : null}
      {response.status === 'loading' ? <p className="answer-muted">Analyzing uploaded imagery...</p> : null}
      {response.status === 'success' ? (
        <div className="answer-content">
          <p>{response.answer}</p>
          <small>Model: {response.model}</small>
        </div>
      ) : null}
      {response.status === 'error' ? <p className="answer-error">{response.error}</p> : null}
    </article>
  )
}

export function EvidencePanel() {
  return (
    <article className="evidence-card">
      <h3>Visual Evidence</h3>
      <div className="evidence-placeholder" aria-hidden="true" />
    </article>
  )
}

function AnswerSkeleton() {
  return (
    <>
      <div className="skeleton skeleton--wide" />
      <div className="skeleton skeleton--mid" />
      <div className="skeleton skeleton--mid" />
      <div className="skeleton skeleton--wide" />
      <div className="skeleton skeleton--short" />
    </>
  )
}
