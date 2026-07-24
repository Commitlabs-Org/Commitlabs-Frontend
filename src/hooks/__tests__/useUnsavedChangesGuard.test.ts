import { renderHook, act } from '@testing-library/react-hooks'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'

test('detects dirty state and resets baseline', () => {
  const initial = { a: 1, b: 2 }
  const { result, rerender } = renderHook(({ state }) => useUnsavedChangesGuard(state), {
    initialProps: { state: initial },
  })

  // initially not dirty
  expect(result.current.isDirty).toBe(false)

  // change state
  const changed = { a: 1, b: 3 }
  rerender({ state: changed })
  expect(result.current.isDirty).toBe(true)

  // reset baseline via resetBaseline (simulate after save)
  act(() => {
    result.current.resetBaseline()
  })
  // after reset, not dirty
  expect(result.current.isDirty).toBe(false)
})
