import { useSyncExternalStore } from 'react';
import { NavLink, Outlet } from 'react-router';
import type { GlyphName } from '../../design/art';
import { Button } from '../../design/Button';
import { Glyph } from '../../design/Glyph';
import { liveState } from '../../lib/live';
import { session } from '../../lib/session';
import './shell.css';

/** The S8 sidebar, in Figma's order. */
const NAV: { to: string; label: string; glyph: GlyphName }[] = [
  { to: '/dashboard', label: 'Dashboard', glyph: 'hearth' },
  { to: '/stats', label: 'Analytics', glyph: 'tally' },
  { to: '/users', label: 'Users', glyph: 'person' },
  { to: '/reports', label: 'Reports', glyph: 'shield' },
  { to: '/deletions', label: 'Deletions', glyph: 'frost' },
  { to: '/payments', label: 'Payments', glyph: 'chest' },
  { to: '/venues', label: 'Venues', glyph: 'cup' },
  { to: '/threads', label: 'Fated Threads', glyph: 'thread' },
  { to: '/square', label: 'Town Square', glyph: 'stage' },
  { to: '/config', label: 'Config', glyph: 'scales' },
  { to: '/codex', label: 'Codex pages', glyph: 'book' },
  { to: '/wanderings', label: 'Wanderings', glyph: 'map' },
  { to: '/audit', label: 'Audit log', glyph: 'scroll' },
  { to: '/ops', label: 'Ops', glyph: 'forge' },
];

const LIVE_LABEL = { off: 'offline', connecting: 'connecting', live: 'live', reconnecting: 'reconnecting' };

export function Shell() {
  const live = useSyncExternalStore(liveState.subscribe, liveState.get);
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-name">MinglDingl</div>
          <div className="label">The Keepers</div>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="nav-item">
              <Glyph name={n.glyph} />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="page">
        <header className="page-bar">
          <span className="label live" data-testid="live-state" data-state={live}>
            <span className="live-dot" />
            {LIVE_LABEL[live]}
          </span>
          <span className="label">Keeper · signed in</span>
          <Button kind="quiet" onClick={() => session.clear()}>
            <Glyph name="door" />
            Leave
          </Button>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
