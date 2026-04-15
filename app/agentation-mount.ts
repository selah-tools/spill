import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Agentation } from 'agentation'

import { isFeatureEnabled } from './feature-flags'

if (import.meta.env.DEV && isFeatureEnabled('agentationDevtools')) {
  const container = document.createElement('div')
  container.id = 'agentation-root'
  document.body.append(container)

  const root = createRoot(container)
  root.render(createElement(Agentation))
}
