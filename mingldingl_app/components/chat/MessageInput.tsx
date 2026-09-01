import { useState, useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';
import { XStack, Input } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS } from '../../lib/theme';
import { GameButton } from '../ui/GameButton';

interface Props { onSend: (text: string) => void; }

/** Mirrors FieldLimits.MessageContent on the engine. */
const MAX_MESSAGE_LENGTH = 2000;

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
    // Deliberately no Keyboard.dismiss() — pairs with blurOnSubmit={false} so the composer
    // stays open for the next message. The field is multiline, so Return inserts a newline and
    // sending is the button's job.
    onSend(t);
    setText('');
  }

  return (
    <XStack
      paddingHorizontal="$3"
      paddingTop="$3"

      paddingBottom={13 + (keyboardVisible ? 0 : insets.bottom)}
      alignItems="flex-end"
      gap="$2"
      backgroundColor={COLORS.panel}
      borderTopColor={COLORS.bronze}
      borderTopWidth={1}
    >
      <Input
        flex={1} value={text} onChangeText={setText}
        placeholder={i18n.t('type_message')} placeholderTextColor={COLORS.textDim as any}
        backgroundColor={COLORS.panelRaised} borderColor={COLORS.bronze} color={COLORS.text}
        fontFamily={FONTS.body as any}
        maxLength={MAX_MESSAGE_LENGTH}
        // A 2000-character limit on a fixed single line meant you could not see what you had
        // typed. Grows with the message and then scrolls internally.
        multiline
        textAlignVertical="top"
        minHeight={52}
        maxHeight={132}
        paddingTop="$2"
        blurOnSubmit={false}
      />
      <GameButton variant="primary" disabled={!text.trim()} onPress={handleSend}>
        {i18n.t('send')}
      </GameButton>
    </XStack>
  );
}
