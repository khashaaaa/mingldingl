import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export function ContentPageEdit() {
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();

  // No GET-by-slug endpoint — the list is tiny (3 fixed pages), so find the
  // one we want client-side rather than adding a backend endpoint for it.
  const { data: pages, isLoading } = useQuery({
    queryKey: queryKeys.content,
    queryFn: () => apiClient.content.list(),
  });
  const page = pages?.find((p) => p.slug === slug);

  const [titleEn, setTitleEn] = useState('');
  const [titleMn, setTitleMn] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [bodyMn, setBodyMn] = useState('');

  useEffect(() => {
    if (page) {
      setTitleEn(page.titleEn ?? '');
      setTitleMn(page.titleMn ?? '');
      setBodyEn(page.bodyEn ?? '');
      setBodyMn(page.bodyMn ?? '');
    }
  }, [page]);

  const save = useMutation({
    mutationFn: () => apiClient.content.update(slug ?? '', { titleEn, titleMn, bodyEn, bodyMn }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.content });
      toast({ description: 'Saved.' });
    },
    onError: () => toast({ variant: 'destructive', description: 'Save failed — try again.' }),
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (!page) return <p className="text-destructive text-sm">Page not found.</p>;

  return (
    <div>
      <Link to="/content" className="text-primary mb-4 inline-block text-sm hover:underline">
        ← Back to content pages
      </Link>
      <h1 className="mb-4 text-lg font-semibold">/{slug}</h1>

      <Card>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Title (English)</Label>
                <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Title (Mongolian)</Label>
                <Input value={titleMn} onChange={(e) => setTitleMn(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Body (English)</Label>
              <Textarea className="h-48" value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Body (Mongolian)</Label>
              <Textarea className="h-48" value={bodyMn} onChange={(e) => setBodyMn(e.target.value)} />
            </div>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
