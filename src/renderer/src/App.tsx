import React, { useEffect, useMemo, useState } from 'react'
import { Panel } from './views/Panel'
import { AiWindow } from './views/AiWindow'

export function App({ view }: { view: 'panel' | 'ai' }): React.JSX.Element {
  const app = useMemo(
    () => ({
      view
    }),
    [view]
  )
  useEffect(() => {
    document.documentElement.dataset.view = app.view
  }, [app.view])
  return view === 'ai' ? <AiWindow /> : <Panel />
}
