import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useOffline } from './useOffline';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('reports a failed initial cache installation instead of waiting forever', async () => {
  vi.stubEnv('PROD', true);
  delete window.electronAPI;
  const worker = Object.assign(new EventTarget(), { state: 'installing' });
  const registration = Object.assign(new EventTarget(), { installing: worker, active: null });
  vi.stubGlobal('navigator', {
    onLine: true,
    serviceWorker: { register: () => Promise.resolve(registration), ready: new Promise(() => {}) },
  });
  const { result } = renderHook(() => useOffline());
  await act(async () => {
    await Promise.resolve();
  });
  act(() => {
    worker.state = 'redundant';
    worker.dispatchEvent(new Event('statechange'));
  });
  await waitFor(() => expect(result.current.label).toBe('ذخیرهٔ آفلاین در دسترس نیست'));
});
