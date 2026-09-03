'use client';

import { ArrowLeft, ChevronLeft, ChevronRight, Heart, MapPin, RotateCcw, Star, Users, Wine } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { observeBarRankings, saveBarRanking, type BarRanking, type SignedInUser } from './firebase';

type Props = { user: SignedInUser | null; onHome: () => void; onSignIn: () => void };
type Bar = { id: string; name: string; neighborhood: string; kind: string; address: string; blurb: string };

const bars: Bar[] = [
  { id: 'sparrow', name: 'Sparrow', neighborhood: 'Gold Coast', kind: 'Cocktail bar', address: '12 W Elm St', blurb: 'Art Deco room known for rum-forward cocktails.' },
  { id: 'zebra-lounge', name: 'Zebra Lounge', neighborhood: 'Gold Coast', kind: 'Piano bar', address: '1220 N State Pkwy', blurb: 'Tiny, energetic piano lounge in a historic building.' },
  { id: 'blue-door', name: 'Blue Door Kitchen & Garden', neighborhood: 'Gold Coast', kind: 'Restaurant bar', address: '52 W Elm St', blurb: 'Garden patio and polished neighborhood drinks.' },
  { id: 'butch-mcguires', name: "Butch McGuire's", neighborhood: 'Gold Coast', kind: 'Irish pub', address: '20 W Division St', blurb: 'Long-running Division Street pub with a festive crowd.' },
  { id: 'hopsmith', name: 'Hopsmith Tavern', neighborhood: 'Gold Coast', kind: 'Sports bar', address: '15 W Division St', blurb: 'Lively multi-level tavern for games and late nights.' },
  { id: 'the-lodge', name: 'The Lodge Tavern', neighborhood: 'Gold Coast', kind: 'Tavern', address: '21 W Division St', blurb: 'Classic Rush and Division late-night standby.' },
  { id: 'old-town-ale-house', name: 'Old Town Ale House', neighborhood: 'Old Town', kind: 'Dive bar', address: '219 W North Ave', blurb: 'Storied cash-only neighborhood dive with local character.' },
  { id: 'the-vig', name: 'The VIG', neighborhood: 'Old Town', kind: 'Sports bar', address: '1527 N Wells St', blurb: 'Stylish sports bar with brunch and a social crowd.' },
  { id: 'benchmark', name: 'Benchmark', neighborhood: 'Old Town', kind: 'Sports bar', address: '1510 N Wells St', blurb: 'Big screens and a retractable roof on Wells Street.' },
  { id: 'woodies-flat', name: "Woodie's Flat", neighborhood: 'Old Town', kind: 'Sports bar', address: '1535 N Wells St', blurb: 'Multi-floor game-day bar famous for wings.' },
  { id: 'corcorans', name: "Corcoran's Grill & Pub", neighborhood: 'Old Town', kind: 'Irish pub', address: '1615 N Wells St', blurb: 'Relaxed Irish pub across from Second City.' },
  { id: 'old-town-pour-house', name: 'Old Town Pour House', neighborhood: 'Old Town', kind: 'Beer bar', address: '1419 N Wells St', blurb: 'Large tap list and plenty of screens.' },
  { id: 'kingston-mines', name: 'Kingston Mines', neighborhood: 'Lincoln Park', kind: 'Blues club', address: '2548 N Halsted St', blurb: 'Late-night live blues on two stages.' },
  { id: 'delilahs', name: "Delilah's", neighborhood: 'Lincoln Park', kind: 'Rock bar', address: '2771 N Lincoln Ave', blurb: 'Punk-rock institution with a deep whiskey list.' },
  { id: 'aliveone', name: 'aliveOne', neighborhood: 'Lincoln Park', kind: 'Music bar', address: '2683 N Halsted St', blurb: 'Music-focused lounge with live sets and DJs.' },
  { id: 'burwood-tap', name: 'Burwood Tap', neighborhood: 'Lincoln Park', kind: 'Dive bar', address: '724 W Wrightwood Ave', blurb: 'Unpretentious neighborhood favorite with games.' },
  { id: 'kincades', name: "Kincade's Bar & Grill", neighborhood: 'Lincoln Park', kind: 'Sports bar', address: '950 W Armitage Ave', blurb: 'Casual local sports bar near the Armitage stop.' },
  { id: 'galway-arms', name: 'Galway Arms', neighborhood: 'Lincoln Park', kind: 'Irish pub', address: '2442 N Clark St', blurb: 'Cozy pub with a fireplace, patio, and live music.' },
  { id: 'cubby-bear', name: 'The Cubby Bear', neighborhood: 'Wrigleyville', kind: 'Sports & music bar', address: '1059 W Addison St', blurb: 'Large live-music and game-day venue across from Wrigley Field.' },
  { id: 'murphys-bleachers', name: "Murphy's Bleachers", neighborhood: 'Wrigleyville', kind: 'Sports bar', address: '3655 N Sheffield Ave', blurb: 'Iconic Cubs bar behind the center-field bleachers.' },
  { id: 'sluggers', name: 'Sluggers', neighborhood: 'Wrigleyville', kind: 'Sports bar', address: '3540 N Clark St', blurb: 'Dueling pianos, batting cages, and game-day crowds.' },
  { id: 'stretch', name: 'Stretch Bar & Grill', neighborhood: 'Wrigleyville', kind: 'Sports bar', address: '3485 N Clark St', blurb: 'High-energy Clark Street sports bar.' },
  { id: 'vines', name: 'Vines on Clark', neighborhood: 'Wrigleyville', kind: 'Patio bar', address: '3554 N Clark St', blurb: 'Spacious patio and a classic Wrigleyville atmosphere.' },
  { id: 'deuces', name: 'Deuce’s Major League Bar', neighborhood: 'Wrigleyville', kind: 'Sports bar', address: '3505 N Clark St', blurb: 'Baseball-themed bar with a large outdoor space.' },
];

const barPhotos: Record<string, string> = {
  'sparrow': 'https://platform.chicago.eater.com/wp-content/uploads/sites/17/chorus/uploads/chorus_asset/file/12627299/img_9498_23139811422_o.0.0.0.jpg?quality=90&strip=all',
  'zebra-lounge': 'https://www.chicagogenx.com/wp-content/uploads/2018/07/zebra-lounge-chicago-crowd-1024x768.jpg',
  'blue-door': 'https://cdn.choosechicago.com/uploads/2020/01/Blue-Door-Kitchen-patio_photo-by-Skylar-Taft-2048x1350.png',
  'butch-mcguires': 'https://img.restaurantguru.com/w550/h367/r840-Butch-McGuires-exterior.jpg',
  'hopsmith': 'https://assets0.dostuffmedia.com/uploads/aws_asset/aws_asset/8060564/9704418a-0940-43ef-8d73-fd86c26b13b3.jpg',
  'the-lodge': 'https://lodgetavern.com/wp-content/uploads/2022/10/LMG-2.jpeg',
  'old-town-ale-house': 'https://cst.brightspotcdn.com/dims4/default/a2c3ebd/2147483647/strip/true/crop/3000x2000%2B0%2B0/resize/1680x1120%21/quality/90/?url=https%3A%2F%2Fcdn.vox-cdn.com%2Fuploads%2Fchorus_asset%2Ffile%2F22695483%2Fmerlin_78234025.jpg',
  'the-vig': 'https://images.squarespace-cdn.com/content/v1/54b05553e4b0dae84244c6fd/1547579253265-FSAS39A3P8OT3VGDABN2/theVig_restaurant_008.jpg',
  'benchmark': 'https://popmenucloud.com/uobmcwft/e2b76487-92ba-4a92-aaf1-377aea387144.jpg',
  'woodies-flat': 'https://assets.simpleviewinc.com/simpleview/image/upload/c_fit%2Cw_1800%2Ch_800/crm/chicago/WF25-Event-Space-Interiors-529_A5CE040B-0D7F-42D4-B812C63C4AEE7105_616be94c-df30-4184-803d5da0288f83f0.jpg',
  'corcorans': 'https://corcoransoldtown.com/wp-content/uploads/2024/05/438958929_985751246725033_426583504860778106_n.jpg',
  'old-town-pour-house': 'https://www.chicagofoodmagazine.com/content/images/media-3979/OTPH.Chicago.Exterior.0571.jpg',
  'kingston-mines': 'https://kingstonmines.com/wp-content/uploads/2018/10/ChicagoKingstonMines-1-1.png',
  'delilahs': 'https://www.lincolnparkchamber.com/wp-content/uploads/2022/07/zgi5_QVk.jpg',
  'aliveone': 'https://static.wixstatic.com/media/0d50a1_1fe86d366ee34fd5a312acda76e90d6c~mv2.jpg',
  'burwood-tap': 'https://www.burwoodtap.com/wp-content/uploads/2017/02/Gallery.png',
  'kincades': 'https://static.spotapps.co/spots/8d/2c98c6934a42d49c89c69be92ad624/full',
  'galway-arms': 'https://static.spotapps.co/website_images/ab_websites/13555_website_v1/share_image.jpg',
  'cubby-bear': 'https://popmenucloud.com/atlkmxog/c7881fb3-ca86-43ae-b6dd-d8706c4f9401.jpg',
  'murphys-bleachers': 'https://murphysbleachers.com/wp-content/uploads/2022/04/IMG_6806-1-scaled.jpg',
  'sluggers': 'https://img.p2bars.com/d17/2507/229002502278988.webp',
  'stretch': 'https://static1.squarespace.com/static/5c6619808dfc8cbc417289f4/t/5e7f563a075b346ec3cad014/1585403454005/Untitled+design-12.png?format=1500w',
  'vines': 'https://res.cloudinary.com/the-infatuation/image/upload/c_fill,w_1200,ar_4:3,g_center,f_auto/cms/guides/best-bars-wrigleyville/Vines-On-Clark',
  'deuces': 'https://media.timeout.com/images/105870789/image.jpg',
};

export default function BarSwipeApp({ user, onHome, onSignIn }: Props) {
  const [view, setView] = useState<'swipe' | 'community'>('swipe');
  const [rankings, setRankings] = useState<BarRanking[]>([]);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const dragStart = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0); const [exiting, setExiting] = useState(false);
  useEffect(() => user ? observeBarRankings(setRankings) : undefined, [user?.uid]);
  const mine = useMemo(() => new Map(rankings.filter((rating) => rating.uid === user?.uid).map((rating) => [rating.barId, rating])), [rankings, user?.uid]);
  const remaining = bars.filter((bar) => !mine.has(bar.id)); const current = remaining[0];
  const community = useMemo(() => [...rankings].sort((a, b) => b.updatedAt - a.updatedAt), [rankings]);
  async function rank(score: number) {
    if (!user || !current || busy) return;
    setBusy(true); setNotice('');
    try {
      await saveBarRanking(user, { barId: current.id, barName: current.name, neighborhood: current.neighborhood, score });
      const saved: BarRanking = { uid: user.uid, displayName: user.displayName || user.email?.split('@')[0] || 'Chicago user', barId: current.id, barName: current.name, neighborhood: current.neighborhood, score, updatedAt: Date.now() };
      setRankings((items) => [...items.filter((item) => item.uid !== user.uid || item.barId !== current.id), saved]);
    }
    catch { setNotice('Could not save that ranking. Please try again.'); }
    finally { setBusy(false); }
  }
  async function swipe(score: number, direction: -1 | 1) {
    if (!current || busy || exiting) return;
    setExiting(true); setDragX(direction * Math.max(window.innerWidth, 700));
    await new Promise((resolve) => window.setTimeout(resolve, 240));
    await rank(score); setDragX(0); setExiting(false);
  }
  if (!user) return <main className="bars-shell bars-gate"><button className="bars-back" onClick={onHome}><ArrowLeft size={18} /> All apps</button><section><span className="bars-logo"><Wine /></span><p className="bars-kicker">North Side picks</p><h1>Swipe your way to a better night out.</h1><p>Sign in to rank bars and see what everyone else picked.</p><button className="bars-signin" onClick={onSignIn}>Sign in with Google</button></section></main>;
  return <main className="bars-shell">
    <header className="bars-header"><button className="bars-back" onClick={onHome}><ArrowLeft size={18} /> All apps</button><div className="bars-title"><span className="bars-logo"><Wine /></span><strong>BarSwipe</strong><small>North Side Chicago</small></div><span className="bars-person">{user.displayName || user.email}</span></header>
    <nav className="bars-tabs"><button className={view === 'swipe' ? 'active' : ''} onClick={() => setView('swipe')}><Heart size={17} /> Swipe</button><button className={view === 'community' ? 'active' : ''} onClick={() => setView('community')}><Users size={17} /> Who ranked what</button></nav>
    {view === 'swipe' ? <section className="swipe-stage">
      <div className="swipe-progress"><span>{mine.size} of {bars.length} ranked</span><div><i style={{ width: `${mine.size / bars.length * 100}%` }} /></div></div>
      {current ? <article className={`bar-card ${exiting ? 'exiting' : ''}`} style={{ transform: `translateX(${dragX}px) rotate(${dragX / 22}deg)`, opacity: exiting ? 0 : Math.max(.62, 1 - Math.abs(dragX) / 650) }} onPointerDown={(event) => { if (busy || exiting) return; dragStart.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (dragStart.current !== null && !exiting) setDragX(event.clientX - dragStart.current); }} onPointerUp={(event) => { if (dragStart.current === null) return; const distance = event.clientX - dragStart.current; dragStart.current = null; if (distance > 100) void swipe(5, 1); else if (distance < -100) void swipe(1, -1); else setDragX(0); }} onPointerCancel={() => { dragStart.current = null; setDragX(0); }}>
        <div className="swipe-stamp dislike" style={{ opacity: Math.max(0, -dragX / 120) }}>PASS</div><div className="swipe-stamp like" style={{ opacity: Math.max(0, dragX / 120) }}>LOVE</div>
        <div className="bar-photo" style={{ backgroundImage: `linear-gradient(180deg, transparent 20%, rgba(15,5,20,.84)), url(${barPhotos[current.id]})` }}><span>{current.neighborhood}</span><div><p>{current.kind}</p><h1>{current.name}</h1><small><MapPin size={14} /> {current.address}</small></div></div>
        <div className="bar-details"><p>{current.blurb}</p><small>Swipe left or right, or tap a rating.</small></div>
        <div className="rating-actions" aria-label={`Rate ${current.name}`}>{[1,2,3,4,5].map((score) => <button key={score} disabled={busy || exiting} onClick={() => void swipe(score, score < 3 ? -1 : 1)} aria-label={`${score} out of 5 stars`}><Star size={20} fill={score >= 4 ? 'currentColor' : 'none'} /><span>{score}</span></button>)}</div>
        <div className="swipe-hints"><span><ChevronLeft /> Not for me</span><span>Love it <ChevronRight /></span></div>
      </article> : <div className="bars-complete"><Heart size={42} /><h2>You ranked the whole list.</h2><p>Your picks are saved to your account.</p><button onClick={() => setView('community')}><Users size={18} /> See community rankings</button></div>}
      {notice && <p className="bars-error">{notice}</p>}
    </section> : <Community rankings={community} />}
  </main>;
}

function Community({ rankings }: { rankings: BarRanking[] }) {
  const [filter, setFilter] = useState('All'); const neighborhoods = ['All', 'Gold Coast', 'Old Town', 'Lincoln Park', 'Wrigleyville'];
  const visible = rankings.filter((ranking) => filter === 'All' || ranking.neighborhood === filter);
  return <section className="community-view"><header><div><p className="bars-kicker">Live community feed</p><h1>Who ranked what</h1></div><span>{visible.length} rankings</span></header><div className="neighborhood-filters">{neighborhoods.map((item) => <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div><div className="ranking-list">{visible.length ? visible.map((ranking) => <article key={`${ranking.barId}-${ranking.uid}`}><span className="rank-avatar">{ranking.displayName.slice(0,1).toUpperCase()}</span><div><strong>{ranking.displayName}</strong><p>ranked <b>{ranking.barName}</b></p><small>{ranking.neighborhood}</small></div><span className="rank-score"><Star size={18} fill="currentColor" /> {ranking.score}/5</span></article>) : <div className="rank-empty"><RotateCcw size={32} /><h2>No rankings here yet.</h2><p>Be the first to swipe on a bar.</p></div>}</div></section>;
}
