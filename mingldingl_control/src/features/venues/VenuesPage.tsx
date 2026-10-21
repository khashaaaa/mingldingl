import { Link, useNavigate } from 'react-router';
import { Button } from '../../design/Button';
import { errorText } from '../../lib/api/client';
import { useAdminListVenues } from '../../lib/api/generated/engine';
import './venues.css';
import { Glyph } from '../../design/Glyph';

/** Partner venues (Figma S8 39:582): the places a meeting may be set. */
export function VenuesPage() {
  const navigate = useNavigate();
  const venues = useAdminListVenues();
  const rows = venues.data ?? [];

  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">Partner venues</h1>
      </div>
      <p className="venues-add">
        <Button kind="brass" onClick={() => navigate('/venues/new')}>
          <Glyph name="plus" /> Add a venue
        </Button>
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Kind</th>
            <th>District</th>
            <th>Rating</th>
            <th>Verified</th>
            <th>Listed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr
              key={v.id}
              data-venue-id={v.id}
              className={v.removed ? 'clickable muted' : 'clickable'}
              onClick={() => navigate(`/venues/${v.id}`)}
            >
              <td>
                <Link to={`/venues/${v.id}`}>{v.name}</Link>
              </td>
              <td>{v.kind}</td>
              <td>{v.district}</td>
              <td>{v.rating == null ? '—' : `${v.rating.toFixed(1)} (${v.ratings})`}</td>
              <td>{v.verified ? 'Yes' : 'No'}</td>
              <td>{v.removed ? 'Removed' : 'Yes'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {venues.isPending && <p className="state">Reading the list…</p>}
      {venues.isError && (
        <p role="alert" className="state danger">
          {errorText(venues.error)}
        </p>
      )}
      {venues.isSuccess && rows.length === 0 && <p className="state">No places are kept yet.</p>}
    </section>
  );
}
