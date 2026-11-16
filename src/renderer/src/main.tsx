import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

const isAi = window.location.hash === '#ai'
createRoot(document.getElementById('root')!).render(<App view={isAi ? 'ai' : 'panel'} />)
