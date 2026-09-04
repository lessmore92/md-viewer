import { useEffect, useState } from 'react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useOffline() {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const supported =
    !window.electronAPI &&
    import.meta.env.PROD &&
    'serviceWorker' in navigator &&
    /^https?:$/.test(location.protocol);
  useEffect(() => {
    const updateNetwork = () => setOnline(navigator.onLine);
    const offerInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const installed = () => setInstallPrompt(null);
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    window.addEventListener('beforeinstallprompt', offerInstall);
    window.addEventListener('appinstalled', installed);
    let cancelled = false;
    const cleanups: (() => void)[] = [];
    if (supported) {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`)
        .then(async (registration) => {
          if (cancelled) return;
          const watchInstallation = () => {
            const worker = registration.installing;
            if (!worker) return;
            const update = () => {
              if (!cancelled && worker.state === 'redundant' && !registration.active)
                setFailed(true);
            };
            worker.addEventListener('statechange', update);
            cleanups.push(() => worker.removeEventListener('statechange', update));
            update();
          };
          watchInstallation();
          registration.addEventListener('updatefound', watchInstallation);
          cleanups.push(() => registration.removeEventListener('updatefound', watchInstallation));
          await navigator.serviceWorker.ready;
          if (!cancelled) setReady(true);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }
    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
      window.removeEventListener('beforeinstallprompt', offerInstall);
      window.removeEventListener('appinstalled', installed);
    };
  }, [supported]);
  const install = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch {
      /* Browser installation is optional. */
    } finally {
      setInstallPrompt(null);
    }
  };
  const label = window.electronAPI
    ? 'نسخهٔ دسکتاپ'
    : ready
      ? online
        ? 'آمادهٔ آفلاین'
        : 'در حال مطالعهٔ آفلاین'
      : failed
        ? 'ذخیرهٔ آفلاین در دسترس نیست'
        : supported
          ? 'آماده‌سازی آفلاین…'
          : 'نسخهٔ وب';
  return { label, ready, install: installPrompt ? install : undefined };
}
