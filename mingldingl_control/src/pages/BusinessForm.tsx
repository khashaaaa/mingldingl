import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { serverError } from '@/lib/apiError';

// The vocabulary the venues actually use, and the one the app's Mission Board maps to icons
// (mingldingl_app/app/(tabs)/activity.tsx). The old list shared only 'Cafe' with the real data, so
// editing any other venue opened this form with an empty category select.
const CATEGORIES = ['Cafe', 'Restaurant', 'Bar', 'Entertainment', 'Outdoor', 'Culture'];

type BusinessDetail = Awaited<ReturnType<typeof apiClient.business.detail>>;

export function BusinessForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const { data: existing, isLoading } = useQuery({
    queryKey: queryKeys.businessDetail(id ?? ''),
    queryFn: () => apiClient.business.detail(id ?? ''),
    enabled: isEditing,
  });

  if (isEditing && isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>;

  return <BusinessFormFields key={id ?? 'new'} id={id} existing={existing} />;
}

function BusinessFormFields({ id, existing }: { id?: string; existing?: BusinessDetail }) {
  const isEditing = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState(existing?.category ?? CATEGORIES[0]);
  const [city, setCity] = useState(existing?.city ?? '');
  const [district, setDistrict] = useState(existing?.district ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [photoUrlsText, setPhotoUrlsText] = useState((existing?.photoUrls ?? []).join('\n'));
  const [operatingHours, setOperatingHours] = useState(existing?.operatingHours ?? '');
  const [isVerified, setIsVerified] = useState(existing?.isVerified ?? false);
  const [isFeatured, setIsFeatured] = useState(existing?.isFeatured ?? false);
  const [error, setError] = useState<string | null>(null);

  function currentPayload() {
    return {
      name,
      category,
      city,
      district,
      description,
      photoUrls: photoUrlsText.split('\n').map((s) => s.trim()).filter(Boolean),
      operatingHours,
      isVerified,
      isFeatured,
    };
  }

  const save = useMutation({
    mutationFn: () =>
      isEditing ? apiClient.business.update(id!, currentPayload()) : apiClient.business.create(currentPayload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business'] });
      if (isEditing) qc.invalidateQueries({ queryKey: queryKeys.businessDetail(id!) });
      navigate('/business');
    },
    onError: (err) => setError(serverError(err, 'Save failed — check the fields and try again.')),
  });

  return (
    <div>
      <Link to="/business" className="text-primary mb-4 inline-block text-sm hover:underline">
        ← Back to businesses
      </Link>
      <h1 className="mb-4 text-lg font-semibold">{isEditing ? 'Edit Business' : 'New Business'}</h1>

      <Card>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              save.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input required value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>District</Label>
                <Input value={district} onChange={(e) => setDistrict(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea className="h-24" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Photo URLs (one per line)</Label>
              <Textarea className="h-20" value={photoUrlsText} onChange={(e) => setPhotoUrlsText(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Operating Hours</Label>
              <Input value={operatingHours} onChange={(e) => setOperatingHours(e.target.value)} placeholder="9am-9pm" />
            </div>
            <div className="flex gap-6">
              <Label className="font-normal">
                <Checkbox checked={isVerified} onCheckedChange={(v) => setIsVerified(v === true)} />
                Verified
              </Label>
              <Label className="font-normal">
                <Checkbox checked={isFeatured} onCheckedChange={(v) => setIsFeatured(v === true)} />
                Featured
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
              {error && <span className="text-destructive text-sm">{error}</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
