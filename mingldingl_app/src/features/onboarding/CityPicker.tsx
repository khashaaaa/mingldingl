import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { Glyph } from '@/design/components/Art';
import { InkLink } from '@/design/components/InkLink';
import { Overlay } from '@/design/components/Overlay';
import { PickRow } from '@/design/components/PickRow';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { boxShadow } from '@/design/effects';
import { color, dimension, type } from '@/design/tokens';
import { useGetCities } from '@/lib/api/generated/engine';
import type { CityView } from '@/lib/api/generated/model';
import { tPlace as placeName, t } from '@/lib/i18n';
import { CAPITAL, type CityRow, cityRows, nearestCity } from './cities';

/**
 * Where the person lives, over the whole screen: search, then one list — Ulaanbaatar first among the
 * provinces, opening to its districts (open from the start when the person already lives there). "Use my location" asks once and picks the nearest listed place; refused, it says so
 * and the list stays.
 */
export function CityPicker({
  open,
  room,
  selected,
  onPick,
  onClose,
}: {
  open: boolean;
  /** The Room Header's title — the room the picker opened from. */
  room: string;
  selected: string | null;
  onPick: (c: CityView) => void;
  onClose: () => void;
}) {
  const cities = useGetCities({ query: { enabled: open } }).data ?? [];
  const [query, setQuery] = useState('');
  const list = useRef<FlatList<CityRow>>(null);
  // A new search starts at its best match, not wherever the last scroll left the list.
  const search = (q: string) => {
    setQuery(q);
    list.current?.scrollToOffset({ offset: 0, animated: false });
  };
  // Opened from a form, the keys of the field before (the tale) would stay up over the list.
  useEffect(() => {
    if (open) Keyboard.dismiss();
  }, [open]);
  const [denied, setDenied] = useState(false);
  const [locating, setLocating] = useState(false);
  const [capitalOpen, setCapitalOpen] = useState<boolean | null>(null);
  const livesInCapital = cities.some((c) => c.name === selected && c.region === CAPITAL);

  const locate = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return setDenied(true);
      setDenied(false);
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
      const near = nearestCity(cities, pos.coords.latitude, pos.coords.longitude);
      if (near) onPick(near);
    } catch {
      setDenied(true);
    } finally {
      setLocating(false);
    }
  };

  const rows = cityRows(cities, query, capitalOpen ?? livesInCapital);

  return (
    <Overlay open={open} onBack={onClose}>
      <View style={styles.screen} accessibilityViewIsModal>
        <RoomHeader title={room} onBack={onClose} />
        <View style={styles.top}>
          <Txt variant="displayM" engraved accessibilityRole="header">
            {t('city.title')}
          </Txt>
          <View style={styles.search}>
            <Glyph name="eye" size={20} tint="textMuted" />
            {/* Uncontrolled: the overlay hands its content a new value one render late, and a
                controlled field reset the keyboard's text in that gap and lost a key ("uul" → "ul"). */}
            <TextInput
              onChangeText={search}
              placeholder={t('city.search')}
              accessibilityLabel={t('city.search')}
              placeholderTextColor={color.textMuted}
              selectionColor={color.accentGold}
              autoCorrect={false}
              returnKeyType="search"
              style={[type.bodyM, styles.searchText]}
            />
          </View>
          {denied ? (
            <Txt variant="voiceM" color="textDanger" accessibilityLiveRegion="polite">
              {t('city.locationDenied')}
            </Txt>
          ) : (
            <View style={styles.locate}>
              <InkLink align="start" label={t('city.useLocation')} onPress={locate} disabled={locating} />
            </View>
          )}
        </View>
        <FlatList
          ref={list}
          data={rows}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          keyExtractor={(r: CityRow) => `${r.kind}:${r.city.name}`}
          ListEmptyComponent={
            query.trim() && cities.length > 0 ? (
              <Txt
                variant="voiceM"
                color="textSecondary"
                style={styles.none}
                accessibilityLiveRegion="polite"
              >
                {t('city.noMatch', { query: query.trim() })}
              </Txt>
            ) : null
          }
          renderItem={({ item: r }) =>
            r.kind === 'capital' ? (
              <PickRow
                label={placeName(r.city.name)}
                selected={livesInCapital}
                expanded={r.open}
                onPress={() => setCapitalOpen(!r.open)}
              />
            ) : r.kind === 'whole' ? (
              <PickRow
                label={t('city.wholeCapital')}
                nested
                selected={r.city.name === selected}
                onPress={() => onPick(r.city)}
              />
            ) : (
              <PickRow
                label={r.label}
                nested={r.nested}
                selected={r.city.name === selected}
                onPress={() => onPick(r.city)}
              />
            )
          }
        />
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bgBase },
  top: { paddingHorizontal: dimension.sizeGutter, paddingTop: dimension.space3, gap: dimension.space4 },
  search: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space3,
    paddingHorizontal: dimension.space4,
    backgroundColor: color.bgSunken,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderHairline,
    borderRadius: dimension.radiusSm,
    boxShadow: boxShadow('insetCarved'),
  },
  searchText: { flex: 1, color: color.textPrimary, paddingVertical: 0 },
  none: { paddingHorizontal: dimension.sizeGutter, paddingTop: dimension.space4 },
  locate: { alignItems: 'flex-start', paddingBottom: dimension.space2 },
});
