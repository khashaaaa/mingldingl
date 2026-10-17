import { createContext, type ReactNode, useContext, useEffect, useId, useMemo, useState } from 'react';
import { BackHandler, Keyboard, StyleSheet, View } from 'react-native';

type Api = { set: (id: string, node: ReactNode | null) => void };
const OverlayContext = createContext<Api | null>(null);

/**
 * Sheets and dialogs render here, inside the app's own edge-to-edge window, above every screen
 * (React Native's Modal opens a separate window that stops short of the Android navigation bar).
 */
export function OverlayHost({ children }: { children: ReactNode }) {
  const [layers, setLayers] = useState<[string, ReactNode][]>([]);
  const api = useMemo<Api>(
    () => ({
      set: (id, node) =>
        setLayers((prev) => {
          const rest = prev.filter(([k]) => k !== id);
          return node === null ? rest : [...rest, [id, node]];
        }),
    }),
    [],
  );
  return (
    <OverlayContext.Provider value={api}>
      {children}
      {layers.length > 0 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {layers.map(([id, node]) => (
            <View key={id} style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {node}
            </View>
          ))}
        </View>
      )}
    </OverlayContext.Provider>
  );
}

/**
 * Shows `node` in the overlay while `open`; the Android back button calls `onBack`. Without a host
 * (component tests) it renders in place.
 */
export function Overlay({
  open,
  onBack,
  children,
}: {
  open: boolean;
  onBack: () => void;
  children: ReactNode;
}) {
  const api = useContext(OverlayContext);
  const id = useId();
  useEffect(() => {
    if (!api) return;
    api.set(id, open ? children : null);
  });
  useEffect(() => () => api?.set(id, null), [api, id]);
  useEffect(() => {
    if (!open) return;
    // Whatever opens above the screen (a ceremony, a sheet) must not sit under the keyboard of a
    // field left focused below it.
    Keyboard.dismiss();
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [open, onBack]);
  if (api) return null;
  return open ? <View style={StyleSheet.absoluteFill}>{children}</View> : null;
}
