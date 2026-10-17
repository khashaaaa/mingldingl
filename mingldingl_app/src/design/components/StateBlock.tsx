import { View } from 'react-native';
import type { ArtName } from '../art/manifest';
import { dimension } from '../tokens';
import { Art } from './Art';
import { InkLink } from './InkLink';
import { Txt } from './Txt';

const ART_FOR: Record<'empty' | 'waiting' | 'error' | 'offline', ArtName> = {
  empty: 'state_empty',
  waiting: 'state_waiting',
  error: 'state_error',
  offline: 'state_offline',
};

/** What a place shows when it has nothing, is waiting, failed, or has lost the road. */
export function StateBlock({
  kind,
  title,
  body,
  action,
}: {
  kind: keyof typeof ART_FOR;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        gap: 14,
        paddingVertical: dimension.space6,
        paddingHorizontal: dimension.sizeGutter,
      }}
    >
      <Art name={ART_FOR[kind]} style={{ width: 160, height: 120 }} />
      <Txt
        variant="displayM"
        color={kind === 'error' ? 'textDanger' : 'textPrimary'}
        engraved
        align="center"
        accessibilityRole="header"
      >
        {title}
      </Txt>
      {body ? (
        <Txt variant="bodyM" color="textSecondary" align="center">
          {body}
        </Txt>
      ) : null}
      {action ? <InkLink label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}
