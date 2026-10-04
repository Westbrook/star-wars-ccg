'use client';

import { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface InstallPrompt extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallApp() {
  const [installed, setInstalled] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const fullscreen = window.matchMedia('(display-mode: fullscreen)');
    const sync = () => setInstalled(standalone.matches || fullscreen.matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const available = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const complete = () => { setInstalled(true); setPrompt(null); setOpen(false); };
    sync();
    setReady(true);
    standalone.addEventListener('change', sync);
    fullscreen.addEventListener('change', sync);
    window.addEventListener('beforeinstallprompt', available);
    window.addEventListener('appinstalled', complete);
    return () => {
      standalone.removeEventListener('change', sync);
      fullscreen.removeEventListener('change', sync);
      window.removeEventListener('beforeinstallprompt', available);
      window.removeEventListener('appinstalled', complete);
    };
  }, []);

  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await prompt.prompt();
      if (result.outcome === 'accepted') setOpen(false);
      else setMessage('You can install later from your browser menu.');
    } catch {
      setMessage('Use your browser menu to install Holotable.');
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  }

  if (installed) return null;
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <button className="install-app-trigger text-button" disabled={!ready}><Download size={16} aria-hidden="true"/><span>Install app</span></button>
    </DialogTrigger>
    <DialogContent className="install-app-dialog">
      <div className="install-app-heading">
        {/* A local app identity asset, intentionally rendered without an image service. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/app-192.png" width="64" height="64" alt="" />
        <div><span className="eyebrow amber">YOUR OWN HOLOTABLE</span><DialogTitle>A place on your Home Screen.</DialogTitle></div>
      </div>
      <DialogDescription>Launch Holotable in its own window, without the browser address bar or tabs.</DialogDescription>
      <section aria-labelledby="apple-install-title">
        <h3 id="apple-install-title">iPhone &amp; iPad</h3>
        <ol>
          <li>Open this site in <strong>Safari</strong> and sign in if asked.</li>
          <li>Open <strong>Share</strong> <Share size={15} aria-hidden="true"/> (it may be inside the browser’s More menu), then choose <strong>Add to Home Screen</strong>.</li>
          <li>Keep <strong>Open as Web App</strong> enabled if shown, then tap <strong>Add</strong>.</li>
          <li>Launch <strong>Holotable</strong> from your Home Screen.</li>
        </ol>
      </section>
      {prompt && <button className="button primary" onClick={install} disabled={busy}><Download size={17}/>{busy ? 'Opening installer…' : 'Install Holotable'}</button>}
      <details><summary>Other browsers &amp; devices</summary><p>Use your browser’s Install app or Add to Home Screen command. In Safari on Mac, choose File → Add to Dock. Availability depends on your browser.</p></details>
      <p className="install-app-note">An internet connection is required. You may need to sign in again after installation. Device status and Home controls remain managed by iOS or iPadOS.</p>
      <p role="status" aria-live="polite">{message}</p>
    </DialogContent>
  </Dialog>;
}
