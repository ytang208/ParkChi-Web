'use client';

import { BatteryFull, Bell, CalendarClock, CalendarDays, Camera, CarFront, Check, ChevronRight, CircleParking, Clock3, Cloud, Compass, Grid3X3, ListTodo, LocateFixed, LogOut, MapPin, Navigation, Plus, Repeat2, Search, Share2, Signpost, Sparkles, Tag, Trash2, UserRound, WalletCards, Wifi, Wine, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import BarSwipeApp from './BarSwipeApp';
import { firebaseConfigured, loadParkChiData, observeUser, saveParkChiData, signInWithGoogle, signOutUser, type SignedInUser } from './firebase';

type Tab = 'parked' | 'street' | 'renewals';
type ParkingSpot = { note: string; savedAt: string; moveBy?: string; latitude?: number; longitude?: number; photo?: string };
type StreetReminder = { id: string; title: string; details: string; date: string; repeat: boolean };
type Renewal = { id: string; kind: string; date: string; note: string };
type Snapshot = { spot: ParkingSpot | null; street: StreetReminder[]; renewals: Renewal[] };
type LauncherApp = { name: string; detail: string; icon: React.ReactNode; tone: string; ready: boolean; action?: () => void };
type ParkChiDocument = Document & { modelContext?: { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => unknown }, options?: { signal?: AbortSignal }) => void | Promise<void> } };

const STORAGE_KEY = 'parkchi.web.v1';
const STORAGE_OWNER_KEY = 'parkchi.web.owner.v1';
const emptySnapshot: Snapshot = { spot: null, street: [], renewals: [] };
const normalizeSnapshot = (value: unknown): Snapshot => {
  if (!value || typeof value !== 'object') return emptySnapshot;
  const saved = value as Partial<Snapshot>;
  return {
    spot: saved.spot && typeof saved.spot === 'object' ? saved.spot : null,
    street: Array.isArray(saved.street) ? saved.street : [],
    renewals: Array.isArray(saved.renewals) ? saved.renewals : [],
  };
};
const uid = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
const formatDate = (value: string, withTime = true) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(new Date(value));
const toInputDate = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/); let line = ''; let lineNumber = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y + lineNumber * lineHeight); line = word; lineNumber += 1;
      if (lineNumber === maxLines - 1) break;
    } else line = candidate;
  }
  if (lineNumber < maxLines) context.fillText(line, x, y + lineNumber * lineHeight);
}

async function createParkingShareCard(spot: ParkingSpot) {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Image creation is unavailable.');
  context.fillStyle = '#063d32'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#0a5647'; context.beginPath(); context.arc(1060, 55, 360, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#f7bd4c'; context.beginPath(); context.arc(94, 86, 46, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#063d32'; context.font = '800 52px system-ui'; context.textAlign = 'center'; context.fillText('P', 94, 105); context.textAlign = 'left';
  context.fillStyle = '#d9f3e8'; context.font = '700 30px system-ui'; context.fillText('PARKCHI', 164, 98);
  context.fillStyle = '#fffefa'; context.font = '800 68px system-ui'; context.fillText('My car is parked here', 70, 228);
  context.fillStyle = '#d9f3e8'; context.font = '500 38px system-ui'; drawWrappedText(context, spot.note || 'Saved parking location', 72, 310, 850, 52, 2);
  context.strokeStyle = '#f7bd4c'; context.lineWidth = 12; context.beginPath(); context.arc(1018, 302, 44, 0, Math.PI * 2); context.stroke(); context.beginPath(); context.moveTo(1018, 346); context.lineTo(1018, 452); context.stroke();
  context.fillStyle = '#f7bd4c'; context.beginPath(); context.arc(1018, 458, 20, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#a9cfc2'; context.font = '500 25px system-ui'; context.fillText(`Saved ${formatDate(spot.savedAt)}`, 72, 525);
  context.fillStyle = '#ffffff'; context.font = '650 24px system-ui'; context.fillText('Open the location from the shared message', 72, 574);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not create image.')), 'image/png'));
  return new File([blob], 'parkchi-parked-location.png', { type: 'image/png' });
}

async function prepareParkingPhoto(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('That photo could not be opened. Please choose another image.'));
      element.src = objectUrl;
    });
    const maxDimension = 1280;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo processing is unavailable in this browser.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let result = canvas.toDataURL('image/jpeg', 0.78);
    if (result.length > 2_500_000) result = canvas.toDataURL('image/jpeg', 0.58);
    if (result.length > 3_500_000) throw new Error('This photo is too large to sync. Please choose a smaller image.');
    return result;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function Home() {
  const [screen, setScreen] = useState<'home' | 'parkchi' | 'bars'>('home');
  const [user, setUser] = useState<SignedInUser | null>(null); const [authReady, setAuthReady] = useState(false); const [authNotice, setAuthNotice] = useState('');
  useEffect(() => observeUser((nextUser) => { setUser(nextUser); setAuthReady(true); }), []);
  async function handleSignIn() {
    setAuthNotice('');
    try { await signInWithGoogle(); }
    catch (error) { setAuthNotice(error instanceof Error ? error.message : 'Could not sign in with Google.'); }
  }
  async function handleSignOut() { await signOutUser(); setAuthNotice('Signed out. Your local copy stays on this device.'); }
  const account = { user, authReady, authNotice, onSignIn: handleSignIn, onSignOut: handleSignOut };
  if (screen === 'parkchi') return <ParkChiApp onHome={() => setScreen('home')} {...account} />;
  if (screen === 'bars') return <BarSwipeApp user={user} onHome={() => setScreen('home')} onSignIn={handleSignIn} />;
  return <AppLauncher onOpenParkChi={() => setScreen('parkchi')} onOpenBars={() => setScreen('bars')} {...account} />;
}

type AccountProps = { user: SignedInUser | null; authReady: boolean; authNotice: string; onSignIn: () => void; onSignOut: () => void };

function AccountControl({ user, authReady, onSignIn, onSignOut }: AccountProps) {
  if (!authReady) return <span className="account-loading">Checking account…</span>;
  return user ? <div className="account-menu"><span className="account-avatar">{(user.displayName || user.email || 'G').slice(0, 1).toUpperCase()}</span><span><strong>{user.displayName || 'Google user'}</strong><small>Synced with Firebase</small></span><button onClick={onSignOut} aria-label="Sign out"><LogOut size={17} /></button></div> : <button className="google-signin" onClick={onSignIn} disabled={!firebaseConfigured}><span className="google-logo">G</span> Sign in with Google</button>;
}

function AppLauncher({ onOpenParkChi, onOpenBars, ...account }: { onOpenParkChi: () => void; onOpenBars: () => void } & AccountProps) {
  const [query, setQuery] = useState(''); const [notice, setNotice] = useState('');
  const now = new Date(); const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const apps: LauncherApp[] = [
    { name: 'ParkChi', detail: 'Parking companion', icon: <CircleParking />, tone: 'parkchi', ready: true, action: onOpenParkChi },
    { name: 'BarSwipe', detail: 'Rank North Side bars', icon: <Wine />, tone: 'barswipe', ready: true, action: onOpenBars },
    { name: 'Chicago Events', detail: 'Find something fun', icon: <Compass />, tone: 'events', ready: false },
    { name: 'Budget', detail: 'Track your spending', icon: <WalletCards />, tone: 'budget', ready: false },
    { name: 'Tomorrow', detail: 'Plan your next day', icon: <ListTodo />, tone: 'tomorrow', ready: false },
    { name: 'Deals', detail: 'Save nearby', icon: <Tag />, tone: 'deals', ready: false },
    { name: 'Calendar', detail: 'See what is next', icon: <CalendarDays />, tone: 'calendar', ready: false },
  ];
  const visibleApps = apps.filter((app) => app.name.toLowerCase().includes(query.toLowerCase()));
  function openApp(app: LauncherApp) { if (app.ready && app.action) app.action(); else { setNotice(`${app.name} is coming soon.`); window.setTimeout(() => setNotice(''), 2200); } }
  return <main className="launcher-shell">
    <div className="wallpaper-orb orb-one" /><div className="wallpaper-orb orb-two" />
    <header className="launcher-status"><strong>{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</strong><span>My Apps</span><div><Wifi size={18} /><BatteryFull size={21} /></div></header>
    <section className="launcher-content">
      <div className="launcher-heading-row"><div className="launcher-heading"><p>{greeting}{account.user ? `, ${account.user.displayName?.split(' ')[0] || 'friend'}` : ''}</p><h1>What would you like to do?</h1></div><AccountControl {...account} /></div>
      {account.authNotice && <p className="auth-notice" role="status">{account.authNotice}</p>}
      {!firebaseConfigured && <p className="auth-setup-note"><Cloud size={16} /> Google sign-in will appear after Firebase is connected.</p>}
      <div className="launcher-widgets">
        <article className="city-widget"><div><span>CHICAGO</span><h2>Your city, simplified.</h2><p>Useful tools for everyday life, all in one place.</p></div><span className="city-star"><Sparkles size={26} /></span></article>
        <article className="date-widget"><span>{now.toLocaleDateString('en-US', { weekday: 'long' })}</span><strong>{now.getDate()}</strong><p>{now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p></article>
      </div>
      <label className="app-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search apps" /></label>
      <section className="apps-section" aria-labelledby="apps-title"><div className="section-title"><h2 id="apps-title">Apps</h2><span>{apps.filter((app) => app.ready).length} available</span></div><div className="app-grid">{visibleApps.map((app) => <button className="app-tile" key={app.name} onClick={() => openApp(app)}><span className={`app-icon ${app.tone}`}>{app.icon}</span><span className="app-name">{app.name}</span><small>{app.detail}</small><em className={app.ready ? 'ready' : ''}>{app.ready ? 'Open' : 'Coming soon'}</em></button>)}</div>{visibleApps.length === 0 && <div className="no-apps">No apps match “{query}”.</div>}</section>
    </section>
    <div className="launcher-dock"><button onClick={onOpenParkChi}><span className="dock-icon parkchi"><CircleParking /></span><small>ParkChi</small></button><span className="dock-divider" /><div><Grid3X3 size={20} /><span>More apps are on the way</span></div></div>
    {notice && <div className="launcher-notice" role="status">{notice}</div>}
  </main>;
}

function ParkChiApp({ onHome, ...account }: { onHome: () => void } & AccountProps) {
  const [tab, setTab] = useState<Tab>('parked');
  const [data, setData] = useState<Snapshot>(emptySnapshot);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<'spot' | 'street' | 'renewal' | null>(null);
  const [toast, setToast] = useState('');
  const [cloudReady, setCloudReady] = useState(false);

  useEffect(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) setData(normalizeSnapshot(JSON.parse(saved))); }
    catch { localStorage.removeItem(STORAGE_KEY); }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data, ready]);
  useEffect(() => {
    if (!ready || !account.user) { setCloudReady(false); return; }
    let active = true;
    void loadParkChiData<Snapshot>(account.user.uid).then((saved) => {
      if (!active) return;
      const localOwner = localStorage.getItem(STORAGE_OWNER_KEY);
      if (saved) {
        setData(normalizeSnapshot(saved));
      } else if (!localOwner || localOwner === 'guest' || localOwner === account.user!.uid) void saveParkChiData(account.user!.uid, data);
      else setData(emptySnapshot);
      localStorage.setItem(STORAGE_OWNER_KEY, account.user!.uid);
      setCloudReady(true);
    }).catch(() => notify('Cloud sync is temporarily unavailable.'));
    return () => { active = false; };
  }, [ready, account.user?.uid]);
  useEffect(() => {
    if (!ready || !cloudReady || !account.user) return;
    const timer = window.setTimeout(() => { void saveParkChiData(account.user!.uid, data).catch(() => notify('Cloud sync is temporarily unavailable.')); }, 450);
    return () => window.clearTimeout(timer);
  }, [data, ready, cloudReady, account.user?.uid]);
  useEffect(() => {
    const context = (document as ParkChiDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'save_parking_spot',
      title: 'Save parking spot',
      description: 'Save or update the user’s parked-car note and optional move-by time in ParkChi.',
      inputSchema: { type: 'object', properties: { note: { type: 'string' }, moveBy: { type: 'string', description: 'Optional ISO 8601 date-time' } }, required: ['note'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const values = input as { note?: unknown; moveBy?: unknown };
        if (typeof values.note !== 'string' || !values.note.trim()) throw new Error('A parking note is required.');
        if (values.moveBy !== undefined && (typeof values.moveBy !== 'string' || Number.isNaN(Date.parse(values.moveBy)))) throw new Error('moveBy must be a valid ISO date-time.');
        const spot: ParkingSpot = { note: values.note.trim(), savedAt: new Date().toISOString(), moveBy: values.moveBy as string | undefined };
        setData((current) => ({ ...current, spot }));
        setTab('parked');
        return { status: 'saved', note: spot.note, moveBy: spot.moveBy ?? null };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);
  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(''), 2600); }

  return (
    <main className="app-shell">
      <aside className="side-rail">
        <a className="brand" href="#top" aria-label="ParkChi home"><span className="brand-mark"><CircleParking size={25} strokeWidth={2.4} /></span><span>ParkChi</span></a>
        <button className="rail-home" onClick={onHome}><Grid3X3 size={18} /> All apps</button>
        <div className="rail-account"><AccountControl {...account} />{account.authNotice && <small>{account.authNotice}</small>}</div>
        <nav className="nav-stack" aria-label="Main navigation">
          <NavButton active={tab === 'parked'} icon={<CarFront />} label="Parked car" onClick={() => setTab('parked')} />
          <NavButton active={tab === 'street'} icon={<Signpost />} label="Street reminders" onClick={() => setTab('street')} />
          <NavButton active={tab === 'renewals'} icon={<CalendarClock />} label="Renewals" onClick={() => setTab('renewals')} />
        </nav>
        <div className="rail-note"><Sparkles size={18} /><p><strong>Made for Chicago</strong><br />{account.user ? 'Your parking details sync securely to your account.' : 'Sign in to sync your parking details across devices.'}</p></div>
      </aside>

      <section className="workspace" id="top">
        <button className="mobile-home" onClick={onHome}><Grid3X3 size={17} /> All apps</button>
        <header className="topbar">
          <div><p className="eyebrow">Chicago parking companion</p><h1>{tab === 'parked' ? 'Where’s your car?' : tab === 'street' ? 'Street reminders' : 'Vehicle renewals'}</h1></div>
          <button className="primary compact" onClick={() => setModal(tab === 'parked' ? 'spot' : tab === 'street' ? 'street' : 'renewal')}>
            {tab === 'parked' && data.spot ? 'Update spot' : <><Plus size={18} /> Add {tab === 'parked' ? 'spot' : 'reminder'}</>}
          </button>
        </header>
        {tab === 'parked' && <ParkingView spot={data.spot} onSave={() => setModal('spot')} onClear={() => { setData({ ...data, spot: null }); notify('Parking spot cleared'); }} />}
        {tab === 'street' && <StreetView items={data.street} onAdd={() => setModal('street')} onDelete={(id) => setData({ ...data, street: data.street.filter((item) => item.id !== id) })} />}
        {tab === 'renewals' && <RenewalsView items={data.renewals} synced={Boolean(account.user)} onAdd={() => setModal('renewal')} onDelete={(id) => setData({ ...data, renewals: data.renewals.filter((item) => item.id !== id) })} />}
      </section>

      <nav className="mobile-tabs" aria-label="Main navigation">
        <NavButton active={tab === 'parked'} icon={<CarFront />} label="Parked" onClick={() => setTab('parked')} />
        <NavButton active={tab === 'street'} icon={<Signpost />} label="Street" onClick={() => setTab('street')} />
        <NavButton active={tab === 'renewals'} icon={<CalendarClock />} label="Renewals" onClick={() => setTab('renewals')} />
      </nav>
      {modal === 'spot' && <SpotModal existing={data.spot} onClose={() => setModal(null)} onSave={(spot) => { setData({ ...data, spot }); setModal(null); notify('Parking spot saved'); }} />}
      {modal === 'street' && <StreetModal onClose={() => setModal(null)} onSave={(item) => { setData({ ...data, street: [...data.street, item].sort((a, b) => a.date.localeCompare(b.date)) }); setModal(null); notify('Street reminder added'); }} />}
      {modal === 'renewal' && <RenewalModal onClose={() => setModal(null)} onSave={(item) => { setData({ ...data, renewals: [...data.renewals, item].sort((a, b) => a.date.localeCompare(b.date)) }); setModal(null); notify('Renewal saved'); }} />}
      {toast && <div className="toast" role="status"><Check size={18} /> {toast}</div>}
    </main>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) { return <button type="button" className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>; }

function ParkingView({ spot, onSave, onClear }: { spot: ParkingSpot | null; onSave: () => void; onClear: () => void }) {
  const [showFullMap, setShowFullMap] = useState(false);
  const [sharing, setSharing] = useState(false); const [shareStatus, setShareStatus] = useState('');
  const latitude = spot?.latitude ?? 41.8781;
  const longitude = spot?.longitude ?? -87.6298;
  const mapDelta = spot?.latitude ? 0.012 : 0.075;
  const mapEmbed = `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - mapDelta}%2C${latitude - mapDelta * 0.62}%2C${longitude + mapDelta}%2C${latitude + mapDelta * 0.62}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  const directions = spot?.latitude && spot?.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}` : spot?.note ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.note)}` : '#';
  async function shareParkingSpot() {
    if (!spot?.latitude || !spot.longitude) { setShareStatus('Save an exact location before sharing.'); return; }
    setSharing(true); setShareStatus('');
    const mapUrl = `https://maps.apple.com/?ll=${spot.latitude},${spot.longitude}&q=${encodeURIComponent(spot.note || 'Parked car')}`;
    const message = `My car is parked${spot.note ? ` at ${spot.note}` : ' here'}. Open the location: ${mapUrl}`;
    try {
      const image = await createParkingShareCard(spot);
      const fileShare = { title: 'My parked car', text: message, files: [image] };
      if (navigator.share) {
        if (!navigator.canShare || navigator.canShare(fileShare)) await navigator.share(fileShare);
        else await navigator.share({ title: 'My parked car', text: message });
        setShareStatus('Shared from ParkChi.');
      } else {
        await navigator.clipboard.writeText(message); setShareStatus('Location message copied.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') setShareStatus('Share canceled.');
      else { try { await navigator.clipboard.writeText(message); setShareStatus('Location message copied.'); } catch { setShareStatus('Sharing is not available in this browser.'); } }
    } finally { setSharing(false); }
  }
  return <div className="parking-layout">
    <section className="map-card" aria-label="Interactive Chicago parking map">
      <iframe className="live-map" title="Interactive Chicago parking map" src={mapEmbed} loading="eager" referrerPolicy="strict-origin-when-cross-origin" />
      <div className="map-pill"><MapPin size={16} fill="currentColor" /> {spot?.latitude ? 'Your parked car' : 'Chicago parking pin'}</div>
      <button className="open-map" onClick={() => setShowFullMap(true)}><Navigation size={17} /> Open full map</button>
    </section>
    <aside className="spot-panel">{spot ? <><div className="status-line"><span className="check-badge"><Check size={17} /></span><div><p className="kicker">Car saved</p><p className="muted">{formatDate(spot.savedAt)}</p></div></div><h2>{spot.note || 'Saved parking location'}</h2>{spot.moveBy && <div className="alert-card"><Clock3 size={21} /><div><strong>Move your car by</strong><span>{formatDate(spot.moveBy)}</span></div></div>}{spot.photo && <img className="sign-photo" src={spot.photo} alt="Saved parking sign" />}<a className="primary full" href={directions} target="_blank" rel="noreferrer"><Navigation size={19} /> Get directions</a>{spot.latitude && spot.longitude && <button className="secondary full share-button" onClick={shareParkingSpot} disabled={sharing}><Share2 size={18} /> {sharing ? 'Preparing share…' : 'Share parked location'}</button>}{shareStatus && <p className="share-status" role="status">{shareStatus}</p>}<div className="split-actions"><button className="secondary" onClick={onSave}>Edit details</button><button className="danger" onClick={onClear}><Trash2 size={17} /> Clear</button></div></> : <><div className="empty-icon"><CarFront size={31} /></div><p className="kicker">Ready when you are</p><h2>Never lose your parking spot again.</h2><p className="muted body-copy">Save your location, add a note about the block, and set a reminder before the meter or restriction begins.</p><button className="primary full" onClick={onSave}><MapPin size={19} /> Save my parking spot</button></>}<p className="safety"><Bell size={15} /> Always check posted parking signs.</p></aside>
    {showFullMap && <div className="full-map-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowFullMap(false)}><section className="full-map-dialog" role="dialog" aria-modal="true" aria-labelledby="full-map-title"><header><div><p className="eyebrow">ParkChi map</p><h2 id="full-map-title">{spot?.latitude ? 'Your parked car' : 'Chicago'}</h2></div><button className="close-button" onClick={() => setShowFullMap(false)} aria-label="Close full map"><X size={21} /></button></header><div className="full-map-canvas"><iframe title="Full interactive Chicago parking map" src={mapEmbed} loading="eager" referrerPolicy="strict-origin-when-cross-origin" /></div></section></div>}
  </div>;
}

function StreetView({ items, onAdd, onDelete }: { items: StreetReminder[]; onAdd: () => void; onDelete: (id: string) => void }) { return <ListSurface icon={<Signpost size={30} />} title="Keep ahead of street cleaning" description="Save dates from signs near your regular parking spots. Schedules can change, so always verify the block before parking." empty={items.length === 0} onAdd={onAdd}>{items.map((item) => <article className="list-row" key={item.id}><DateTile value={item.date} /><div className="list-copy"><h3>{item.title}</h3><p>{formatDate(item.date)}</p>{item.details && <small>{item.details}</small>}</div>{item.repeat && <span className="repeat"><Repeat2 size={16} /> Weekly</span>}<button className="icon-danger" aria-label={`Delete ${item.title}`} onClick={() => onDelete(item.id)}><Trash2 size={17} /></button></article>)}</ListSurface>; }
function RenewalsView({ items, synced, onAdd, onDelete }: { items: Renewal[]; synced: boolean; onAdd: () => void; onDelete: (id: string) => void }) { return <ListSurface icon={<CalendarClock size={30} />} title="Put every deadline in one place" description={`Track city stickers, plates, permits, and emissions tests. ${synced ? 'Everything is synced to your account.' : 'Sign in to sync everything to your account.'}`} empty={items.length === 0} onAdd={onAdd}>{items.map((item) => <article className="list-row" key={item.id}><DateTile value={item.date} /><div className="list-copy"><h3>{item.kind}</h3><p>Due {formatDate(item.date, false)}</p>{item.note && <small>{item.note}</small>}</div><button className="icon-danger" aria-label={`Delete ${item.kind}`} onClick={() => onDelete(item.id)}><Trash2 size={17} /></button></article>)}</ListSurface>; }
function ListSurface({ icon, title, description, empty, onAdd, children }: { icon: React.ReactNode; title: string; description: string; empty: boolean; onAdd: () => void; children: React.ReactNode }) { return <div className="list-layout"><section className="intro-card"><div className="intro-icon">{icon}</div><p className="eyebrow">Plan ahead</p><h2>{title}</h2><p>{description}</p><button className="primary" onClick={onAdd}><Plus size={18} /> Add reminder</button></section><section className="items-card">{empty ? <div className="empty-state"><CalendarClock size={38} /><h3>Nothing due yet</h3><p>Your saved reminders will appear here in date order.</p><button className="text-button" onClick={onAdd}>Create your first reminder <ChevronRight size={17} /></button></div> : children}</section></div>; }
function DateTile({ value }: { value: string }) { const date = new Date(value); return <div className="date-tile"><span>{date.toLocaleDateString('en-US', { month: 'short' })}</span><strong>{date.getDate()}</strong></div>; }
function ModalFrame({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><div><p className="eyebrow">ParkChi</p><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="close-button" onClick={onClose} aria-label="Close"><X size={21} /></button></header>{children}</section></div>; }

function SpotModal({ existing, onClose, onSave }: { existing: ParkingSpot | null; onClose: () => void; onSave: (spot: ParkingSpot) => void }) {
  const [note, setNote] = useState(existing?.note || ''); const [moveBy, setMoveBy] = useState(existing?.moveBy || '');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(existing?.latitude && existing?.longitude ? { latitude: existing.latitude, longitude: existing.longitude } : null);
  const [locating, setLocating] = useState(false); const [locationMessage, setLocationMessage] = useState(coords ? 'Location is saved' : 'Add your location for one-tap directions'); const [photo, setPhoto] = useState(existing?.photo || '');
  const [processingPhoto, setProcessingPhoto] = useState(false); const [photoMessage, setPhotoMessage] = useState('');
  const [showLocationHelp, setShowLocationHelp] = useState(false); const [retryShouldSave, setRetryShouldSave] = useState(false);
  function finishSave(location: { latitude: number; longitude: number }) { onSave({ note: note.trim(), savedAt: new Date().toISOString(), moveBy: moveBy ? new Date(moveBy).toISOString() : undefined, ...location, photo: photo || undefined }); }
  function locate(afterCapture?: (location: { latitude: number; longitude: number }) => void) {
    if (!navigator.geolocation) { setLocationMessage('This browser does not support location.'); return; }
    setLocating(true); setLocationMessage('Getting an accurate GPS position…');
    navigator.geolocation.getCurrentPosition((position) => {
      const location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setCoords(location); setLocationMessage(`Location added • accurate to about ${Math.round(position.coords.accuracy)} m`); setLocating(false); afterCapture?.(location);
    }, (error) => {
      setLocationMessage(error.code === 1 ? 'Location access was blocked. Allow it in your browser settings, then try again.' : 'Could not get your location. Move near a window and try again.');
      if (error.code === 1) { setRetryShouldSave(Boolean(afterCapture)); setShowLocationHelp(true); }
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  function submit(event: FormEvent) { event.preventDefault(); if (coords) finishSave(coords); else locate(finishSave); }
  return <ModalFrame title={existing ? 'Update parking spot' : 'Save parking spot'} subtitle="Add enough detail to make the walk back effortless." onClose={onClose}>
    <form onSubmit={submit} className="form-stack"><label>Where did you park?<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="West side of Damen near Waveland" rows={3} autoFocus /></label><button type="button" className={`location-button ${coords ? 'complete' : ''}`} onClick={() => locate()} disabled={locating}><span>{coords ? <Check size={20} /> : <LocateFixed size={20} />}</span><div><strong>{locating ? 'Finding you…' : coords ? 'Location added' : 'Capture where I’m parked'}</strong><small>{locationMessage}</small></div><ChevronRight size={18} /></button><label>Move reminder <span className="optional">optional</span><input type="datetime-local" value={moveBy ? toInputDate(new Date(moveBy)) : ''} min={toInputDate(new Date())} onChange={(e) => setMoveBy(e.target.value)} /></label><label className="photo-picker"><input type="file" accept="image/*" disabled={processingPhoto} onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setProcessingPhoto(true); setPhotoMessage('Preparing photo for secure sync…'); try { setPhoto(await prepareParkingPhoto(file)); setPhotoMessage('Photo is ready to sync with your account.'); } catch (error) { setPhotoMessage(error instanceof Error ? error.message : 'Could not prepare that photo.'); } finally { setProcessingPhoto(false); } }} /><Camera size={20} /><span>{processingPhoto ? 'Preparing photo…' : photo ? 'Replace sign photo' : 'Add parking sign photo'}</span></label>{photoMessage && <small role="status">{photoMessage}</small>}{photo && <img className="photo-preview" src={photo} alt="Parking sign preview" />}<button className="primary full" type="submit" disabled={locating || processingPhoto}><MapPin size={19} /> {processingPhoto ? 'Preparing photo…' : locating ? 'Finding your location…' : coords ? 'Save parking spot' : 'Use my location & save'}</button></form>
    {showLocationHelp && <div className="permission-backdrop" role="presentation"><section className="permission-popup" role="alertdialog" aria-modal="true" aria-labelledby="permission-title"><button className="close-button permission-close" onClick={() => setShowLocationHelp(false)} aria-label="Close location help"><X size={20} /></button><div className="permission-icon"><LocateFixed size={29} /></div><p className="eyebrow">Location needed</p><h3 id="permission-title">Please allow location</h3><p>ParkChi needs your current position to put the parking pin in the right place.</p><p className="permission-tip">If the browser prompt does not reappear, open this site’s settings and change <strong>Location</strong> to <strong>Allow</strong>.</p><div className="permission-actions"><button className="primary full" onClick={() => { setShowLocationHelp(false); locate(retryShouldSave ? finishSave : undefined); }}><LocateFixed size={18} /> Request location again</button><button className="text-button" onClick={() => setShowLocationHelp(false)}>Not now</button></div></section></div>}
  </ModalFrame>;
}

function StreetModal({ onClose, onSave }: { onClose: () => void; onSave: (item: StreetReminder) => void }) {
  const [title, setTitle] = useState('Street cleaning'); const [details, setDetails] = useState(''); const [date, setDate] = useState(toInputDate(new Date(Date.now() + 86_400_000))); const [repeat, setRepeat] = useState(false);
  return <ModalFrame title="New street reminder" subtitle="Copy the date and details from the posted sign." onClose={onClose}><form className="form-stack" onSubmit={(e) => { e.preventDefault(); onSave({ id: uid(), title: title.trim(), details: details.trim(), date: new Date(date).toISOString(), repeat }); }}><label>Reminder title<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label><label>Block or sign details<textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder="Zone, side of street, or cross street" /></label><label>Date and time<input type="datetime-local" value={date} min={toInputDate(new Date())} onChange={(e) => setDate(e.target.value)} required /></label><label className="check-row"><input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} /><span>Repeat every week</span></label><button className="primary full"><Bell size={18} /> Add street reminder</button></form></ModalFrame>;
}

function RenewalModal({ onClose, onSave }: { onClose: () => void; onSave: (item: Renewal) => void }) {
  const [kind, setKind] = useState('City sticker'); const [date, setDate] = useState(toInputDate(new Date(Date.now() + 30 * 86_400_000)).slice(0, 10)); const [note, setNote] = useState(''); const options = useMemo(() => ['City sticker', 'License plate', 'Residential permit', 'Emissions test', 'Other'], []);
  return <ModalFrame title="New vehicle renewal" subtitle="Save the deadline now, and future you will thank you." onClose={onClose}><form className="form-stack" onSubmit={(e) => { e.preventDefault(); onSave({ id: uid(), kind, date: new Date(`${date}T12:00:00`).toISOString(), note: note.trim() }); }}><label>Renewal type<select value={kind} onChange={(e) => setKind(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label><label>Due date<input type="date" value={date} min={toInputDate(new Date()).slice(0, 10)} onChange={(e) => setDate(e.target.value)} required /></label><label>Note <span className="optional">optional</span><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Plate, permit zone, or other detail" /></label><button className="primary full"><CalendarClock size={18} /> Save renewal</button></form></ModalFrame>;
}
