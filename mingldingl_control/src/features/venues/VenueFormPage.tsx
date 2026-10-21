import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../../design/Button';
import { errorText } from '../../lib/api/client';
import { API_URL } from '../../lib/api/config';
import {
  adminAddVenuePhoto,
  adminCreateVenue,
  adminRemoveVenue,
  adminRemoveVenuePhoto,
  adminUpdateVenue,
  getAdminGetVenueQueryKey,
  getAdminListVenuesQueryKey,
  useAdminGetVenue,
} from '../../lib/api/generated/engine';
import type { AdminVenueView, VenueWriteRequest } from '../../lib/api/generated/model';
import './venues.css';
import { Glyph } from '../../design/Glyph';

const KINDS = ['Cafe', 'Restaurant', 'Bar', 'Entertainment', 'Outdoor', 'Culture'];
const EMPTY: VenueWriteRequest = {
  name: '',
  nameMn: null,
  kind: 'Cafe',
  district: 'Sükhbaatar (UB)',
  address: '',
  hours: null,
  description: null,
  addressMn: null,
  hoursMn: null,
  descriptionMn: null,
  verified: true,
};

type City = { name: string; kind: string; region: string };

/** Add or edit a partner venue (Figma S8 39:667), its photos, and take it off the list. */
export function VenueFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const venue = useAdminGetVenue(id ?? '', { query: { enabled: !isNew } });
  return isNew ? (
    <VenueForm />
  ) : venue.data ? (
    <VenueForm venue={venue.data} />
  ) : (
    <p className="state">Reading the place…</p>
  );
}

function VenueForm({ venue }: { venue?: AdminVenueView }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [form, setForm] = useState<VenueWriteRequest>(venue ? toRequest(venue) : EMPTY);
  useEffect(() => {
    if (venue) setForm(toRequest(venue));
  }, [venue]);
  const cities = useQuery({
    queryKey: ['/geo/cities'],
    queryFn: async () => (await (await fetch(`${API_URL}/geo/cities`)).json()) as City[],
    staleTime: Number.POSITIVE_INFINITY,
  });
  const refresh = (saved?: AdminVenueView) => {
    if (saved) client.setQueryData(getAdminGetVenueQueryKey(saved.id), saved);
    return client.invalidateQueries({ queryKey: getAdminListVenuesQueryKey() });
  };
  const save = useMutation({
    mutationFn: (data: VenueWriteRequest) =>
      venue ? adminUpdateVenue(venue.id, data) : adminCreateVenue(data),
    onSuccess: async (saved) => {
      await refresh(saved);
      if (!venue) navigate(`/venues/${saved.id}`, { replace: true });
    },
  });
  const remove = useMutation({
    mutationFn: () => adminRemoveVenue(venue?.id ?? ''),
    onSuccess: async () => {
      await refresh();
      navigate('/venues');
    },
  });
  const addPhoto = useMutation({
    mutationFn: (file: File) => adminAddVenuePhoto(venue?.id ?? '', { file }),
    onSuccess: refresh,
  });
  const dropPhoto = useMutation({
    mutationFn: (photoId: string) => adminRemoveVenuePhoto(venue?.id ?? '', photoId),
    onSuccess: refresh,
  });
  const error = [save, remove, addPhoto, dropPhoto].find((m) => m.error)?.error;
  const set = <K extends keyof VenueWriteRequest>(k: K, v: VenueWriteRequest[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(form);
  };

  return (
    <section>
      <Link to="/venues" className="back label">
        <Glyph name="back" /> Venues
      </Link>
      <div className="page-head">
        <h1 className="page-title">{venue ? venue.name : 'A new venue'}</h1>
        <p className="voice page-sub">{venue ? 'Edit a partner venue' : 'Add a partner venue'}</p>
      </div>
      <form className="venue-form" onSubmit={submit}>
        <Field label="Name">
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </Field>
        <Field label="Kind">
          <select className="input" value={form.kind} onChange={(e) => set('kind', e.target.value)}>
            {KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </Field>
        <Field label="District">
          <select className="input" value={form.district} onChange={(e) => set('district', e.target.value)}>
            {(cities.data ?? [{ name: form.district, kind: '', region: '' }]).map((c) => (
              <option key={c.name} value={c.name}>
                {c.kind === 'district' ? `${c.name} · ${c.region}` : c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Address">
          <input
            className="input"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            required
          />
        </Field>
        <Field label="Hours">
          <input
            className="input"
            value={form.hours ?? ''}
            placeholder="09:00–22:00"
            onChange={(e) => set('hours', e.target.value || null)}
          />
        </Field>
        <Field label="Description">
          <textarea
            className="input venue-description"
            value={form.description ?? ''}
            maxLength={400}
            onChange={(e) => set('description', e.target.value || null)}
          />
        </Field>
        <Field label="Name (Mongolian)">
          <input
            className="input"
            value={form.nameMn ?? ''}
            placeholder="— waiting for a native speaker —"
            onChange={(e) => set('nameMn', e.target.value || null)}
          />
        </Field>
        <Field label="Address (Mongolian)">
          <input
            className="input"
            value={form.addressMn ?? ''}
            maxLength={160}
            onChange={(e) => set('addressMn', e.target.value || null)}
          />
        </Field>
        <Field label="Hours (Mongolian)">
          <input
            className="input"
            value={form.hoursMn ?? ''}
            maxLength={60}
            placeholder="Өдөржин · 08:00–22:00"
            onChange={(e) => set('hoursMn', e.target.value || null)}
          />
        </Field>
        <Field label="Description (Mongolian)">
          <textarea
            className="input venue-description"
            value={form.descriptionMn ?? ''}
            maxLength={400}
            onChange={(e) => set('descriptionMn', e.target.value || null)}
          />
        </Field>
        <label className="venue-check label">
          <input
            type="checkbox"
            checked={form.verified}
            onChange={(e) => set('verified', e.target.checked)}
          />
          Verified by the keepers
        </label>
        {error && (
          <p role="alert" className="danger">
            {errorText(error)}
          </p>
        )}
        <div className="venue-actions">
          <Button kind="brass" type="submit" disabled={save.isPending}>
            Save
          </Button>
          {venue && !venue.removed && (
            <Button kind="quiet" onClick={() => remove.mutate()} disabled={remove.isPending}>
              Take it off the list
            </Button>
          )}
        </div>
      </form>
      {venue && (
        <div className="venue-photos">
          <h2 className="label">Photos ({venue.photos.length} of 4)</h2>
          <ul>
            {venue.photos.map((p) => (
              <li key={p.id}>
                <img src={p.url} alt="" />
                <Button kind="quiet" onClick={() => dropPhoto.mutate(p.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          {venue.photos.length < 4 && (
            <label className="btn venue-upload">
              Add a photo
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) addPhoto.mutate(file);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>
      )}
    </section>
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

const toRequest = (v: AdminVenueView): VenueWriteRequest => ({
  name: v.name,
  nameMn: v.nameMn ?? null,
  kind: v.kind,
  district: v.district,
  address: v.address,
  hours: v.hours ?? null,
  description: v.description ?? null,
  addressMn: v.addressMn ?? null,
  hoursMn: v.hoursMn ?? null,
  descriptionMn: v.descriptionMn ?? null,
  verified: v.verified,
});
