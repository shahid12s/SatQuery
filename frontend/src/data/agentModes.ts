export type AgentModeId = 'auto' | 'single' | 'change' | 'fusion'

export type AgentMode = {
  id: AgentModeId
  title: string
  subtitle: string
  icon: 'spark' | 'image' | 'switch' | 'signal'
  selectable: boolean
}

export const agentModes: AgentMode[] = [
  {
    id: 'auto',
    title: 'General (Auto)',
    subtitle: 'Let AI agent automatically choose the right task.',
    icon: 'spark',
    selectable: true,
  },
  {
    id: 'single',
    title: 'Single Image',
    subtitle: 'Answer questions on a single image.',
    icon: 'image',
    selectable: false,
  },
  {
    id: 'change',
    title: 'Change Detection',
    subtitle: 'Detect changes between two images.',
    icon: 'switch',
    selectable: false,
  },
  {
    id: 'fusion',
    title: 'Optical + SAR',
    subtitle: 'Compare optical and SAR images.',
    icon: 'signal',
    selectable: false,
  },
]

export const modelDestinations: Record<Exclude<AgentModeId, 'auto'>, string> = {
  single: '/models/single-image',
  change: '/models/change-detection',
  fusion: '/models/optical-sar',
}

export function inferAgentMode(question: string): Exclude<AgentModeId, 'auto'> {
  if (/change|before|after|compare/i.test(question)) return 'change'
  if (/sar|radar|optical/i.test(question)) return 'fusion'
  return 'single'
}
