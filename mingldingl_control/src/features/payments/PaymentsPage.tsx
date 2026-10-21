import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../../design/Button';
import { Glyph } from '../../design/Glyph';
import { ApiError, errorText } from '../../lib/api/client';
import {
  getAdminInvoiceQueryKey,
  getAdminPaymentsQueryKey,
  useAdminInvoice,
  useAdminPaymentHandled,
  useAdminPayments,
  useAdminRefundedByHand,
  useAdminRefundPayment,
} from '../../lib/api/generated/engine';
import type { AdminPaymentRow } from '../../lib/api/generated/model';
import { formatDateTime, tugrik } from '../../lib/format';
import '../users/users.css';
import './payments.css';

const FLOOR: Record<string, string> = { hall: 'The Hall', highTable: 'High Table', yard: 'The Yard' };
const STATE: Record<string, string> = {
  credited: 'Credited',
  needsAttention: 'Waiting on you',
  refunded: 'Refunded',
  handled: 'Handled',
  renews: 'Renews',
  ends: 'Will not renew',
  lapsed: 'Lapsed',
  open: 'Open',
  paid: 'Paid',
  cold: 'Went cold',
  refunding: 'Waiting on you',
};
const CHANNEL: Record<string, string> = { qpay: 'QPay', store: 'Google Play' };

/** "The Hall · 3 moons" (a store row has no cycle of its own). */
const what = (r: AdminPaymentRow) =>
  `${FLOOR[r.floor] ?? r.floor}${r.months ? ` · ${r.months} moon${r.months === 1 ? '' : 's'}` : ''}`;

/**
 * The coffers (Figma S8 218:984): this moon's money, members by floor, the payments that wait on a
 * keeper (paid but not credited — each must end refunded), and every payment. Live.
 */
export function PaymentsPage() {
  const payments = useAdminPayments();
  const v = payments.data;
  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">The coffers</h1>
        <p className="voice page-sub">
          Every payment, from Google Play and the web. Nothing paid is ever left hanging.
        </p>
      </div>
      {payments.isPending && <p className="state">Counting the coffers…</p>}
      {payments.isError && (
        <p role="alert" className="state danger">
          {errorText(payments.error)}
        </p>
      )}
      {v && (
        <>
          <div className="stats">
            <Stat label="This moon" value={tugrik(v.moonTotal)} note="credited on the web" />
            <Stat
              label="Members"
              value={String(v.members)}
              note={`Hall ${v.hallMembers} · High Table ${v.highTableMembers}`}
            />
            <Stat
              label="Needs attention"
              value={String(v.needsAttention)}
              note={v.attention[0] ? `oldest ${formatDateTime(v.attention[0].at)}` : 'none'}
            />
            <Stat label="Refunded" value={String(v.refundedThisMoon)} note="this moon" />
          </div>

          <h2 className="section-title">Needs attention</h2>
          {v.attention.length === 0 ? (
            <p className="state">Nothing waits on the keepers.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Amount</th>
                  <th>Why</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {v.attention.map((r) => (
                  <tr key={r.id} data-payment-id={r.id}>
                    <td>{formatDateTime(r.at)}</td>
                    <td>{r.accountId ? r.name : `${r.name} (gone)`}</td>
                    <td>{tugrik(r.amount)}</td>
                    <td>{r.note}</td>
                    <td>
                      <Link to={`/payments/${r.invoiceId}`} className="go">
                        Settle <Glyph name="chevron" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 className="section-title">All payments</h2>
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Floor</th>
                <th>Amount</th>
                <th>Channel</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {v.latest.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.at)}</td>
                  <td>{r.accountId ? <Link to={`/users/${r.accountId}`}>{r.name}</Link> : r.name}</td>
                  <td>{what(r)}</td>
                  <td>{r.channel === 'store' ? '—' : tugrik(r.amount)}</td>
                  <td>{CHANNEL[r.channel] ?? r.channel}</td>
                  <td>
                    {r.channel === 'qpay' ? (
                      <Link to={`/payments/${r.invoiceId}`}>{STATE[r.state] ?? r.state}</Link>
                    ) : (
                      (STATE[r.state] ?? r.state)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {v.latest.length === 0 && <p className="state">No payment yet.</p>}
        </>
      )}
    </section>
  );
}

/**
 * One invoice (Figma S8 218:1138): what happened to it, in order, and the way to settle a payment
 * that could not be credited — refund through QPay, or record a bank transfer QPay cannot make.
 */
export function InvoicePage() {
  const { id = '' } = useParams();
  const invoice = useAdminInvoice(id);
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [byHand, setByHand] = useState(false);
  const done = {
    mutation: {
      onSuccess: () => {
        setError(null);
        client.invalidateQueries({ queryKey: getAdminInvoiceQueryKey(id) });
        client.invalidateQueries({ queryKey: getAdminPaymentsQueryKey() });
      },
      onError: (e: unknown) => {
        if (e instanceof ApiError && e.code === 'payments.refund_by_hand') setByHand(true);
        setError(errorText(e));
      },
    },
  };
  const refund = useAdminRefundPayment(done);
  const manual = useAdminRefundedByHand(done);
  const handled = useAdminPaymentHandled(done);

  if (invoice.isPending) return <p className="state">Opening the invoice…</p>;
  if (invoice.isError)
    return (
      <p role="alert" className="state danger">
        {errorText(invoice.error)}
      </p>
    );
  const v = invoice.data;
  const open = v.payments.find((p) => p.state === 'needsAttention');
  return (
    <section>
      <Link to="/payments" className="back label">
        <Glyph name="back" /> The coffers
      </Link>
      <div className="page-head">
        <h1 className="page-title">
          Invoice {v.id.slice(-9, -5)}·{v.id.slice(-4)}
        </h1>
        <p className="voice page-sub">
          {v.name} · {FLOOR[v.floor]} for {v.months} moon{v.months === 1 ? '' : 's'} · QPay
        </p>
      </div>
      <div className="stats">
        <Stat label="Amount" value={tugrik(v.amount)} note="QPay" />
        <Stat
          label="Floor"
          value={FLOOR[v.floor] ?? v.floor}
          note={`${v.months} moon${v.months === 1 ? '' : 's'}`}
        />
        <Stat label="Status" value={STATE[v.state] ?? v.state} note={open ? 'paid, not credited' : ''} />
        <Stat
          label="Account"
          value={v.accountGone ? 'Burned' : 'Here'}
          note={v.accountGone ? 'the money must go back' : ''}
        />
      </div>
      <h2 className="section-title">What happened</h2>
      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>What</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {v.events.map((e, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: events never reorder
            <tr key={i}>
              <td>{formatDateTime(e.at)}</td>
              <td>{e.what}</td>
              <td>{e.by}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && (
        <p role="alert" className="state danger">
          {error}
        </p>
      )}
      {open && (
        <div className="payment-actions">
          <Button onClick={() => handled.mutate({ id: open.id })} disabled={handled.isPending}>
            Mark as handled
          </Button>
          {byHand ? (
            <Button kind="brass" onClick={() => manual.mutate({ id: open.id })} disabled={manual.isPending}>
              I returned {tugrik(open.amount)} by bank transfer
            </Button>
          ) : (
            <Button kind="brass" onClick={() => refund.mutate({ id: open.id })} disabled={refund.isPending}>
              Refund {tugrik(open.amount)}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="muted stat-note">{note || '—'}</div>
    </div>
  );
}
