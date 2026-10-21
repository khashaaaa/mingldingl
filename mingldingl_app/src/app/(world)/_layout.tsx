import { Stack } from 'expo-router';
import { RestWatch } from '@/features/system/Rest';
import { roomLayout } from '@/features/world/RoomLayout';
import { WorldWatch } from '@/features/world/WorldWatch';

export const unstable_settings = { initialRouteName: '(tabs)' };

/** A screen in the world that throws shows "The path falters" in its place. */
export { Fault as ErrorBoundary } from '@/features/system/Fault';

export default function WorldLayout() {
  return (
    <>
      <Stack
        screenLayout={roomLayout}
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <WorldWatch />
      <RestWatch />
    </>
  );
}
