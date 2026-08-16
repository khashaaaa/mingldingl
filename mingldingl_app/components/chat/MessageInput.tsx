import { useState, useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';
import { XStack, Input } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS } from '../../lib/theme';
import { GameButton } from '../ui/GameButton';

interface Props { onSend: (text: string) => void; }

// iOS fires the 'will' events before the keyboard's own slide animation
// starts, which is what KeyboardAvoidingView's padding is internally synced
// to — using 'did' here would make this bar's own padding change lag a beat
// behind the parent's shift. Android has no 'will' events at all.
const SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

export function MessageInput({ onSend }: Props) {
  const [text, setText] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const showSub = Keyboard.addListener(SHOW_EVENT, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(HIDE_EVENT, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  function handleSend() {
    const t = text.trim();
    if (!t) return;
    Keyboard.dismiss();
    onSend(t);
    setText('');
  }

  return (
    <XStack
      paddingHorizontal="$3"
      paddingTop="$3"
      // Root layout only reserves the top safe-area edge (SafeAreaView
      // edges={['top']}) — every screen with content anchored to the
      // bottom has to add its own inset, same as the tab bar and
      // LootToast do. Without it this bar sat flush against the home
      // indicator / gesture bar with no breathing room.
      //
      // That inset is only needed while the keyboard is closed, though —
      // KeyboardAvoidingView's own bottom padding already lands this bar's
      // outer edge exactly at the keyboard's top edge once it's open, so
      // stacking insets.bottom on top of that just left a redundant gap of
      // empty panel color sitting between the send button and the keyboard
      // (up to ~34pt on a home-indicator device) instead of the button
      // sitting flush above it.
      paddingBottom={13 + (keyboardVisible ? 0 : insets.bottom)}
      gap="$2"
      backgroundColor={COLORS.panel}
      borderTopColor={COLORS.bronze}
      borderTopWidth={1}
    >
      <Input
        flex={1} height={52} value={text} onChangeText={setText}
        placeholder={i18n.t('type_message')} placeholderTextColor={COLORS.textDim as any}
        backgroundColor={COLORS.panelRaised} borderColor={COLORS.bronze} color={COLORS.text}
        fontFamily={FONTS.body as any}
        returnKeyType="send" onSubmitEditing={handleSend} blurOnSubmit={false}
      />
      <GameButton variant="primary" disabled={!text.trim()} onPress={handleSend}>
        {i18n.t('send')}
      </GameButton>
    </XStack>
  );
}
