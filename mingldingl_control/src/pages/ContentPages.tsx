import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function ContentPages() {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.content,
    queryFn: () => apiClient.content.list(),
  });

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Content Pages</h1>
      <p className="text-muted-foreground mb-4 text-sm">Terms, Privacy, and in-app Guides — served to the app instead of bundled.</p>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn't load content pages.</p>}

      {data && (
        <Card className="gap-0 py-0">
          {data.map((page, i) => (
            <div key={page.slug}>
              {i > 0 && <Separator />}
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{page.titleEn}</p>
                  <p className="text-muted-foreground text-xs">
                    /{page.slug} — updated {page.updatedAt && new Date(page.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button asChild variant="link" size="sm">
                  <Link to={`/content/${page.slug}`}>Edit</Link>
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
