import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AvatarFrame } from '@/design/components/AvatarFrame';
import { Button } from '@/design/components/Button';
import { ChoiceCard } from '@/design/components/ChoiceCard';
import { Dialog } from '@/design/components/Dialog';
import { GemBadge, TIERS } from '@/design/components/GemBadge';
import { CornerCaps, Fastener } from '@/design/components/Hardware';
import { InkLink } from '@/design/components/InkLink';
import { Input } from '@/design/components/Input';
import { NameTitle } from '@/design/components/NameTitle';
import { PhotoTile } from '@/design/components/PhotoTile';
import { PickRow } from '@/design/components/PickRow';
import { PointsCounter } from '@/design/components/PointsCounter';
import { RoomHeader } from '@/design/components/RoomHeader';
import { SettingRow } from '@/design/components/SettingRow';
import { Sheet } from '@/design/components/Sheet';
import { StateBlock } from '@/design/components/StateBlock';
import { StepLadder } from '@/design/components/StepLadder';
import { TabBar } from '@/design/components/TabBar';
import { TextArea } from '@/design/components/TextArea';
import { Toast } from '@/design/components/Toast';
import { Toggle } from '@/design/components/Toggle';
import { Txt } from '@/design/components/Txt';
import { XpBar } from '@/design/components/XpBar';
import { dimension } from '@/design/tokens';

/** Development only: every component and variant on one scroll, to compare with Figma page 06. */
export default function Gallery() {
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [pick, setPick] = useState(1);
  const [tab, setTab] = useState('seek');
  const [points, setPoints] = useState(880);
  const [lever, setLever] = useState(true);
  return (
    <ScrollView
      contentContainerStyle={[
        styles.page,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 },
      ]}
    >
      <Section title="Button">
        <Button label="Summon" onPress={() => {}} />
        <Button label="Summon" onPress={() => {}} disabled />
        <Button label="Kindling" onPress={() => {}} loading />
        <Button label="Sever" onPress={() => {}} kind="danger" />
        <Button label="Write to the keepers" onPress={() => {}} kind="plain" />
        <Button label="Waiting" onPress={() => {}} kind="plain" loading />
        <Button label="Continue" onPress={() => {}} block />
      </Section>
      <Section title="Toggle / Setting Row">
        <Toggle label="Pause profile" value={lever} onChange={setLever} />
        <Toggle label="Sound" value={!lever} onChange={(v) => setLever(!v)} />
        <SettingRow
          glyph="moon"
          title="Pause profile"
          subtitle="Hidden from Seek; your bonds go on"
          control={<Toggle label="Pause profile" value={lever} onChange={setLever} />}
        />
        <SettingRow
          glyph="seal"
          title="Your sigil"
          subtitle="Your proven number"
          value="+976 8858 ····"
          onPress={() => {}}
        />
      </Section>
      <Section title="Ink Link">
        <InkLink label="Read the codex" onPress={() => {}} />
        <InkLink label="Read the codex" onPress={() => {}} disabled />
      </Section>
      <Section title="Input / Text Area">
        <Input label="Your name" value="" placeholder="What the hold calls you" onChangeText={() => {}} />
        <Input
          label="Your name"
          value="M"
          onChangeText={() => {}}
          error="A name must be at least two letters."
        />
        <Input label="Your name" value="Saruul" onChangeText={() => {}} disabled />
        <TextArea
          label="Your tale"
          value="I keep a falcon and read old maps by candlelight."
          onChangeText={() => {}}
          maxLength={300}
        />
      </Section>
      <Section title="Choice Card">
        <ChoiceCard
          glyph="knot"
          title="Bond"
          body="A partner to build a life with."
          selected={pick === 1}
          onPress={() => setPick(1)}
        />
        <ChoiceCard
          glyph="thread"
          title="Fate"
          body="Open to where it leads."
          selected={pick === 2}
          onPress={() => setPick(2)}
        />
      </Section>
      <Section title="Pick Row">
        <View style={{ alignSelf: 'stretch', marginHorizontal: -dimension.sizeGutter }}>
          <PickRow kind="group" label="Provinces" />
          <PickRow label="Bayangol" onPress={() => {}} />
          <PickRow label="Khan-Uul" selected onPress={() => {}} />
        </View>
      </Section>
      <Section title="Toast">
        <Toast kind="info" message="Saruul answered the icebreaker" />
        <Toast kind="reward" message="Seven dawns — a bonus" />
        <Toast kind="error" message="No connection — check your network." />
      </Section>
      <Section title="Hardware">
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Fastener kind="rivet" />
          <Fastener kind="screwA" />
          <Fastener kind="screwB" />
          <Fastener kind="screwC" />
          <Fastener kind="screwD" />
        </View>
        <View style={{ width: 120, height: 60 }}>
          <CornerCaps />
        </View>
      </Section>
      <Section title="State Block">
        <StateBlock kind="empty" title="The tavern is empty" body="No one here yet." />
        <StateBlock kind="waiting" title="Not yet" body="This part of the hold opens soon." />
        <StateBlock
          kind="error"
          title="The path falters"
          body="Something broke between here and the hold."
          action={{ label: 'Try again', onPress: () => {} }}
        />
        <StateBlock
          kind="offline"
          title="The road is broken"
          body="No connection."
          action={{ label: 'Try again', onPress: () => {} }}
        />
      </Section>
      <Section title="Room Header">
        <View style={{ alignSelf: 'stretch', marginHorizontal: -dimension.sizeGutter }}>
          <RoomHeader
            title="The Hearth"
            onBack={() => {}}
            action={{ glyph: 'more', label: 'More', onPress: () => {} }}
          />
        </View>
      </Section>
      <Section title="Tab Bar">
        <View style={{ alignSelf: 'stretch', marginHorizontal: -dimension.sizeGutter }}>
          <TabBar tabs={GALLERY_TABS} active={tab} onPress={setTab} />
        </View>
      </Section>
      <Section title="Step Ladder">
        <StepLadder step={1} total={6} />
        <StepLadder step={3} total={6} />
        <StepLadder step={6} total={6} />
      </Section>
      <Section title="Photo Tile">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <PhotoTile state="empty" onPress={() => {}} />
          <PhotoTile state="filled" photo={SAMPLE_PHOTO} onLongPress={() => {}} />
          <PhotoTile state="uploading" progress={0.6} />
          <PhotoTile state="uploading" uri={SAMPLE_PHOTO.url} />
          <PhotoTile state="failed" onRetry={() => {}} />
        </View>
      </Section>
      <Section title="Avatar Frame">
        <View style={{ flexDirection: 'row', gap: 24 }}>
          <AvatarFrame state="sealed" photo={SAMPLE_PHOTO} label="Sealed" />
          <AvatarFrame state="revealed" photo={SAMPLE_PHOTO} label="Revealed" />
          <AvatarFrame state="mine" photo={null} label="Mine" />
        </View>
      </Section>
      <Section title="Gem Badge">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
          {TIERS.map((t) => (
            <GemBadge key={t} tier={t} />
          ))}
        </View>
      </Section>
      <Section title="Points Counter / XP Bar">
        <PointsCounter value={points} />
        <PointsCounter value={12345} />
        <Button label="+ 17 points" onPress={() => setPoints((p) => p + 17)} />
        <XpBar points={points} progress={0.75} next={{ points: 120, tier: 'Ruby' }} />
        <XpBar points={0} progress={0} next={{ points: 100, tier: 'Opal' }} />
      </Section>
      <Section title="Name">
        <NameTitle name="Мөнхболд" text="Мөнхболд, 31" />
        <NameTitle name="Saruul" text="Saruul, 28" />
      </Section>
      <Section title="Sheet / Dialog">
        <Button label="Open sheet" onPress={() => setSheet(true)} />
        <Button label="Open dialog" onPress={() => setDialog(true)} />
      </Section>
      <Sheet open={sheet} title="Swear your oath" onClose={() => setSheet(false)}>
        <Txt variant="bodyM" color="textOnParchment" align="center">
          An oath tells the hold what you seek.
        </Txt>
        <Button label="Swear" onPress={() => setSheet(false)} />
      </Sheet>
      <Dialog
        open={dialog}
        title="Sever this bond?"
        body="The letters will close and neither of you can summon the other again."
        confirm={{ label: 'Sever', onPress: () => setDialog(false), danger: true }}
        cancel={{ label: 'Keep the bond', onPress: () => setDialog(false) }}
      />
    </ScrollView>
  );
}

const GALLERY_TABS = [
  { key: 'seek', label: 'Seek', glyph: 'fire' },
  { key: 'quests', label: 'Quest Log', glyph: 'letters' },
  { key: 'missions', label: 'Missions', glyph: 'scroll' },
  { key: 'square', label: 'Square', glyph: 'stage' },
  { key: 'character', label: 'Character', glyph: 'person' },
] as const;

/** A public sample, so the filled states show a real image and its ThumbHash. */
const SAMPLE_PHOTO = {
  id: 'gallery-sample',
  url: 'https://picsum.photos/id/1027/360/480',
  thumbHash: '1QcSHQRnh493V4dIh4eXh1h4kJUI',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Txt variant="labelM" color="textMuted">
        {title}
      </Txt>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: dimension.sizeGutter, gap: dimension.space7 },
  section: { gap: dimension.space4, alignItems: 'flex-start' },
});
