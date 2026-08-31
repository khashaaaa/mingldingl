import { useState } from 'react';
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

type ContentPage = NonNullable<Awaited<ReturnType<typeof apiClient.content.list>>>[number];

export function ContentPageEdit() {
  const { slug } = useParams<{ slug: string }>();

  const { data: pages, isLoading } = useQuery({
    queryKey: queryKeys.content,
    queryFn: () => apiClient.content.list(),
  });
  const page = pages?.find((p) => p.slug === slug);

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (!page) return <p className="text-destructive text-sm">Page not found.</p>;

  return <ContentPageEditForm key={slug} slug={slug ?? ''} page={page} />;
}

function ContentPageEditForm({ slug, page }: { slug: string; page: ContentPage }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [titleEn, setTitleEn] = useState(page.titleEn ?? '');
  const [titleMn, setTitleMn] = useState(page.titleMn ?? '');
  const [bodyEn, setBodyEn] = useState(page.bodyEn ?? '');
  const [bodyMn, setBodyMn] = useState(page.bodyMn ?? '');

  const save = useMutation({
    mutationFn: () => apiClient.content.update(slug, { titleEn, titleMn, bodyEn, bodyMn }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.content });
      toast({ description: 'Saved.' });
    },
    onError: () => toast({ variant: 'destructive', description: 'Save failed — try again.' }),
  });

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
