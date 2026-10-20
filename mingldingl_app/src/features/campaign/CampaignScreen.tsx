import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { FillArt } from '@/design/components/Art';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { useGetBond, useGetCampaign } from '@/lib/api/generated/engine';
import { t } from '@/lib/i18n';
import { Scene } from '../common/Scene';
import { WanderingEntry } from '../wanderings/WanderingEntry';
import { RoadRows } from './RoadRows';

/** The Campaign (Figma 33:1929): the bond's map of the Deep and how many chambers the pair has cleared. */
export default function CampaignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useGetCampaign(id).data;
  const bond = useGetBond(id).data;
  return (
    <Scene header={<RoomHeader title={t('room.campaign')} onBack={() => router.back()} />}>
      <View accessible accessibilityRole="image" accessibilityLabel={t('campaign.map')} style={styles.map}>
        <FillArt name="campaign_map" />
      </View>
      {c ? (
        <View style={styles.words}>
          <Txt variant="labelM" color="textAccent" align="center">
            {t('campaign.cleared', { n: c.cleared, total: c.chambers.length }).toUpperCase()}
          </Txt>
          <Txt variant="voiceM" color="textSecondary" align="center">
            {t('campaign.body')}
          </Txt>
        </View>
      ) : null}
      <WanderingEntry bondId={id} />
      <View style={styles.rows}>
        <RoadRows bondId={id} name={bond?.other.name ?? ''} />
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({
  // FillArt measures the box; an Image alone keeps its source width and sits off-centre
  map: { alignSelf: 'stretch', aspectRatio: 350 / 520, overflow: 'hidden' },
  words: { gap: 6 },
  // Rows run edge to edge, past the Scene's gutter.
  rows: { marginHorizontal: -dimension.sizeGutter },
});
