import { Banner } from '@/design/components/Banner';
import { t } from '@/lib/i18n';
import { useRoadCut } from '@/lib/live/road';

/** "The road is cut" (Figma 36:535), shown only while the live connection is down. */
export function RoadNotice() {
  return useRoadCut() ? <Banner clasp text={t('offline.road')} /> : null;
}
