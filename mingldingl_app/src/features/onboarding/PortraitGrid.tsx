import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Dialog } from '@/design/components/Dialog';
import { InkLink } from '@/design/components/InkLink';
import { PhotoTile } from '@/design/components/PhotoTile';
import { Row } from '@/design/components/Row';
import { Sheet } from '@/design/components/Sheet';
import { Txt } from '@/design/components/Txt';
import { color, dimension } from '@/design/tokens';
import { t } from '@/lib/i18n';
import { errorText } from './Onboarding';
import { PortraitCamera } from './PortraitCamera';
import type { usePortraits } from './usePortraits';

/**
 * Six slots: portraits in order, then the ones uploading, then empty frames. Hold a portrait to lift
 * it and tap where it goes; tap one to remove it. `note` sits under the grid (the onboarding counter,
 * Edit's reorder hint). Shared by onboarding step 3 and Edit your character.
 */
export function PortraitGrid({
  portraits: p,
  max,
  note,
}: {
  portraits: ReturnType<typeof usePortraits>;
  max: number;
  note: string;
}) {
  const [lifted, setLifted] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [shooting, setShooting] = useState(false);
  const empty = Math.max(0, max - p.photos.length - p.pending.length);

  const tapPhoto = (id: string, index: number) => {
    if (!lifted) return setOpen(id);
    if (lifted !== id) p.move(lifted, index);
    setLifted(null);
  };

  return (
    <>
      <View style={styles.grid}>
        {p.photos.map((photo, i) => (
          <View key={photo.id} style={[styles.slot, lifted === photo.id && styles.lifted]}>
            <PhotoTile
              state="filled"
              photo={photo}
              local={p.local[photo.id]}
              label={t('photo.portraitAt', { n: i + 1, total: p.photos.length })}
              onPress={() => tapPhoto(photo.id, i)}
              onLongPress={() => setLifted(photo.id)}
            />
          </View>
        ))}
        {p.pending.map((x) => (
          <View key={x.key} style={styles.slot}>
            {x.status === 'failed' ? (
              <PhotoTile state="failed" uri={x.uri} onRetry={() => p.retry(x.key)} />
            ) : (
              <PhotoTile state="uploading" uri={x.uri} />
            )}
          </View>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: empty frames have no identity
          <View key={i} style={styles.slot}>
            <PhotoTile state="empty" onPress={() => setChoosing(true)} />
          </View>
        ))}
      </View>
      <Txt variant="labelS" color="textMuted">
        {note}
      </Txt>
      {lifted ? (
        <Txt variant="bodyS" color="textSecondary" accessibilityLiveRegion="polite">
          {t('photos.placeHint')}
        </Txt>
      ) : null}
      {p.pending.some((x) => x.status === 'failed') ? (
        <Txt variant="bodyS" color="textDanger" accessibilityLiveRegion="polite">
          {t('photos.uploadFailed')}
        </Txt>
      ) : null}
      {p.denied ? (
        <View style={styles.denied}>
          <Txt variant="bodyS" color="textDanger" accessibilityLiveRegion="polite">
            {t('photos.permissionDenied')}
          </Txt>
          <InkLink align="start" label={t('photos.openSettings')} onPress={() => Linking.openSettings()} />
        </View>
      ) : null}
      {p.error ? (
        <Txt variant="bodyS" color="textDanger" accessibilityLiveRegion="polite">
          {errorText(p.error)}
        </Txt>
      ) : null}

      <Sheet kind="menu" open={choosing} title={t('photo.add')} onClose={() => setChoosing(false)}>
        <View style={styles.menu}>
          <Row
            glyph="eye"
            title={t('photos.fromCamera')}
            onPress={() => {
              setChoosing(false);
              setShooting(true);
            }}
          />
          <Row
            glyph="frame"
            title={t('photos.fromLibrary')}
            onPress={() => {
              setChoosing(false);
              p.add();
            }}
          />
        </View>
      </Sheet>
      <PortraitCamera open={shooting} onClose={() => setShooting(false)} onTaken={p.addTaken} />
      <Dialog
        open={open !== null}
        title={t('photos.removeTitle')}
        body={t('photos.removeBody')}
        seal={false}
        confirm={{
          label: t('photos.remove'),
          danger: true,
          onPress: () => {
            if (open) p.remove(open);
            setOpen(null);
          },
        }}
        cancel={{ label: t('common.cancel'), onPress: () => setOpen(null) }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: dimension.space3 },
  slot: {
    borderRadius: dimension.radiusSm,
    borderWidth: dimension.strokeHairline,
    borderColor: 'transparent',
  },
  lifted: { borderColor: color.borderGold, transform: [{ scale: 1.04 }] },
  denied: { gap: dimension.space2, alignItems: 'flex-start' },
  menu: { alignSelf: 'stretch' },
});
