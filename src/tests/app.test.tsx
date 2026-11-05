import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { useGraphStore } from '../graph/graph-store'

describe('App shell', () => {
  beforeEach(() => {
    useGraphStore.getState().reset()
  })

  it('renders the search field and empty state', () => {
    render(<App />)
    expect(screen.getByText('spider-map')).toBeInTheDocument()
    expect(screen.getByLabelText('Объект исследования')).toBeInTheDocument()
    expect(screen.getByText('Введите объект исследования')).toBeInTheDocument()
  })

  it('renders the source panel', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Источники' })).toBeInTheDocument()
  })
})
