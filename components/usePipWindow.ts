'use client';

import { useCallback, useEffect, useState } from 'react';

type DocumentPip = { requestWindow(opts: { width: number; height: number }): Promise<Window> };

function copyStyles(from: Document, to: Document) {
  for (const sheet of Array.from(from.styleSheets)) {
    try {
      const style = to.createElement('style');
      style.textContent = Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
      to.head.appendChild(style);
    } catch {
      if (!sheet.href) continue;
      const link = to.createElement('link');
      link.rel = 'stylesheet';
      link.href = sheet.href;
      to.head.appendChild(link);
    }
  }
}

function syncTheme(target: Window) {
  const theme = document.documentElement.dataset.theme;
  if (theme) target.document.documentElement.dataset.theme = theme;
  else delete target.document.documentElement.dataset.theme;
}

export function usePipWindow() {
  const [supported, setSupported] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  useEffect(() => { setSupported('documentPictureInPicture' in window); }, []);

  const open = useCallback(async () => {
    const api = (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture;
    if (!api) return;
    const win = await api.requestWindow({ width: 340, height: 130 });
    win.document.title = 'Weave';
    copyStyles(document, win.document);
    syncTheme(win);
    win.document.body.className = 'pip-body';
    win.addEventListener('pagehide', () => setPipWindow(null));
    setPipWindow(win);
  }, []);

  useEffect(() => {
    if (!pipWindow) return;
    const observer = new MutationObserver(() => syncTheme(pipWindow));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [pipWindow]);

  const close = useCallback(() => { pipWindow?.close(); }, [pipWindow]);

  // Needs a user click (browser rule); harmless if refused.
  const resize = useCallback((width: number, height: number) => {
    try { pipWindow?.resizeTo(width, height); } catch { /* not allowed without a click */ }
  }, [pipWindow]);

  return { supported, pipWindow, open, close, resize };
}
