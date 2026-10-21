import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/design/components/Button';
import { Overlay } from '@/design/components/Overlay';
import { Txt } from '@/design/components/Txt';
import { color, dimension } from '@/design/tokens';
import { t } from '@/lib/i18n';

/**
 * Takes a portrait with the app's own camera, on the selfie lens. The phone's camera app was asked
 * for the front lens and opened the back one anyway (Samsung ignores the request).
 */
export function PortraitCamera({
  open,
  onClose,
  onTaken,
}: {
  open: boolean;
  onClose: () => void;
  onTaken: (shot: { base64: string; uri: string }) => void;
}) {
  const insets = useSafeAreaInsets();
  const [perm, askPerm] = useCameraPermissions();
  const lens = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && perm && !perm.granted && perm.canAskAgain) askPerm();
  }, [open, perm, askPerm]);
  useEffect(() => {
    if (!open) setReady(false);
  }, [open]);

  const take = async () => {
    setBusy(true);
    const shot = await lens.current
      ?.takePictureAsync({ base64: true, quality: 0.85, shutterSound: false })
      .catch(() => null);
    setBusy(false);
    if (!shot?.base64) return;
    onClose();
    onTaken({ base64: shot.base64, uri: shot.uri });
  };

  const seeing = perm?.granted === true;
  return (
    <Overlay open={open} onBack={onClose}>
      <View
        style={[styles.room, { paddingTop: insets.top, paddingBottom: insets.bottom + dimension.space4 }]}
      >
        {seeing ? (
          <View style={styles.lens}>
            <CameraView
              ref={lens}
              style={StyleSheet.absoluteFill}
              facing="front"
              animateShutter={false}
              onCameraReady={() => setReady(true)}
            />
          </View>
        ) : (
          <View style={[styles.lens, styles.closed]}>
            <Txt variant="bodyL" color="textSecondary" align="center">
              {t('face.cameraDenied')}
            </Txt>
          </View>
        )}
        <View style={styles.actions}>
          {seeing ? (
            <Button block label={t('photos.shoot')} loading={busy} disabled={!ready} onPress={take} />
          ) : (
            <Button
              block
              label={t('face.allowCamera')}
              onPress={() => (perm?.canAskAgain === false ? Linking.openSettings() : askPerm())}
            />
          )}
          <Button block kind="plain" label={t('common.cancel')} onPress={onClose} />
        </View>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  room: { ...StyleSheet.absoluteFill, backgroundColor: color.bgScrim, paddingHorizontal: dimension.space4 },
  lens: {
    flex: 1,
    marginTop: dimension.space4,
    borderRadius: dimension.radiusLg,
    borderWidth: 1,
    borderColor: color.borderBrass,
    overflow: 'hidden',
    backgroundColor: color.bgSunken,
  },
  closed: { justifyContent: 'center', padding: dimension.space4 },
  actions: { marginTop: dimension.space4, gap: dimension.space3 },
});
