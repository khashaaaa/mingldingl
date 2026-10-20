import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../design/Button';
import { errorText } from '../../lib/api/client';
import {
  adminAdjustScore,
  adminClearUserFlag,
  adminClearUserText,
  adminDeleteUserNow,
  adminGiveFloor,
  adminLiftSuspension,
  adminRemoveUserPhoto,
  adminSignOutUser,
  adminSuspendUser,
  getAdminGetUserQueryKey,
  getAdminUserPaymentsQueryKey,
} from '../../lib/api/generated/engine';
import type { AdminUserDetail } from '../../lib/api/generated/model';

export type HandAction =
  | { kind: 'suspend' | 'lift' | 'signOut' | 'delete' | 'floor' | 'adjust' | 'clearFlag' }
  | { kind: 'clear'; field: 'name' | 'tale' }
  | { kind: 'photo'; photoId: string };

const TITLE: Record<HandAction['kind'], string> = {
  suspend: 'Suspend',
  lift: 'Lift the suspension',
  signOut: 'Sign out everywhere',
  delete: 'Delete now',
  floor: 'Give a floor',
  adjust: 'Adjust score',
  clear: 'Clear',
  photo: 'Remove a portrait',
  clearFlag: 'Clear the device flag',
};

const BODY: Record<HandAction['kind'], string> = {
  suspend:
    'Suspend signs them out everywhere, severs their bonds and hides them from everyone. It can be lifted.',
  lift: 'They may sign in again as themselves. Bonds severed by the suspension stay severed.',
  signOut: 'Every device they are signed in on is signed out; they sign in again with a code.',
  delete:
    'Delete now burns the character at once — portraits, letters, bonds — for a legal request. It cannot be undone. A suspended character, or one with reports still open, also leaves its number barred.',
  floor:
    'A gift from the keepers, for testers, reviewers or amends. It shows as given by the keepers and never renews.',
  adjust:
    'Undo a mistaken penalty or a bug. Points move the gem; reputation only orders Seek and is never shown.',
  clear:
    'A cleared name becomes “Аянчин” until they choose another; a cleared tale sends them back to write a new one.',
  photo:
    'The portrait goes at once. Below the minimum, they are asked for another before they return to the world.',
  clearFlag:
    'You looked at the shared device and found nothing wrong — a phone bought second-hand, a sibling’s phone. The flag goes; nothing else changes.',
};

/**
 * The keeper's hand (Figma S8 266:2253–266:14979): one dialog for every action on a person, each
 * asking for the reason the audit log keeps beside it.
 */
export function KeeperDialog({
  user,
  action,
  onClose,
}: {
  user: AdminUserDetail;
  action: HandAction;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [floor, setFloor] = useState<'hall' | 'highTable'>('hall');
  const [days, setDays] = useState('30');
  const [points, setPoints] = useState('0');
  const [reputation, setReputation] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = user.accountId;
  const name = user.profile?.name ?? user.phone;
  const danger = action.kind === 'suspend' || action.kind === 'delete';
  const title =
    action.kind === 'clear'
      ? `Clear the ${action.field}`
      : action.kind === 'suspend'
        ? `Suspend ${name}?`
        : action.kind === 'delete'
          ? `Delete ${name} now?`
          : TITLE[action.kind];

  // Escape closes it, as Cancel does.
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = { reason: reason.trim() };
      if (action.kind === 'delete') {
        await adminDeleteUserNow(id, r);
        navigate('/users');
        return;
      }
      const detail =
        action.kind === 'suspend'
          ? await adminSuspendUser(id, r)
          : action.kind === 'lift'
            ? await adminLiftSuspension(id, r)
            : action.kind === 'signOut'
              ? await adminSignOutUser(id, r)
              : action.kind === 'clear'
                ? await adminClearUserText(id, { field: action.field, ...r })
                : action.kind === 'photo'
                  ? await adminRemoveUserPhoto(id, action.photoId, r)
                  : action.kind === 'clearFlag'
                    ? await adminClearUserFlag(id, r)
                    : action.kind === 'floor'
                      ? await adminGiveFloor(id, { floor, days: Number(days), ...r })
                      : await adminAdjustScore(id, {
                          points: Number(points),
                          reputation: Number(reputation),
                          ...r,
                        });
      client.setQueryData(getAdminGetUserQueryKey(id), detail);
      client.invalidateQueries({ queryKey: getAdminUserPaymentsQueryKey(id) });
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="scrim">
      <form className="dialog" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit}>
        <h2 className="section-title">{title}</h2>
        <p className="voice">{BODY[action.kind]}</p>
        {action.kind === 'floor' && (
          <>
            <Field label="Floor">
              <select className="input" value={floor} onChange={(e) => setFloor(e.target.value as 'hall')}>
                <option value="hall">The Hall</option>
                <option value="highTable">The High Table</option>
              </select>
            </Field>
            <Field label="Days">
              <input
                className="input"
                type="number"
                min={1}
                max={366}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                required
              />
            </Field>
          </>
        )}
        {action.kind === 'adjust' && (
          <>
            <Field label="Points (+ or −)">
              <input
                className="input"
                type="number"
                min={-10000}
                max={10000}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </Field>
            <Field label="Reputation (+ or −)">
              <input
                className="input"
                type="number"
                min={-100}
                max={100}
                value={reputation}
                onChange={(e) => setReputation(e.target.value)}
              />
            </Field>
          </>
        )}
        <Field label="Reason (written in the audit log)">
          <input
            className="input"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </Field>
        {error && (
          <p role="alert" className="state danger">
            {error}
          </p>
        )}
        <div className="hand-row">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            kind={danger ? 'danger' : 'brass'}
            type="submit"
            disabled={busy || reason.trim().length === 0}
          >
            {action.kind === 'clear' ? `Clear the ${action.field}` : TITLE[action.kind]}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the child
    <label className="field">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
