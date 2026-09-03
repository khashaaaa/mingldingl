import { useState, useEffect } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { i18n } from '../../lib/i18n';
import { COLORS, SPACE } from '../../lib/theme';
import { GameButton } from '../ui/GameButton';
import { TextField } from '../ui/TextField';

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
    <View style={[styles.bar, { paddingBottom: SPACE.md + (keyboardVisible ? 0 : insets.bottom) }]}>
      <TextField
        value={text} onChangeText={setText}
        placeholder={i18n.t('type_message')}
        maxLength={MAX_MESSAGE_LENGTH}
        // A 2000-character limit on a fixed single line meant you could not see what you had
        // typed. Grows with the message and then scrolls internally.
        multiline
        minHeight={52}
        maxHeight={132}
        style={styles.field}
        blurOnSubmit={false}
      />
      <GameButton variant="primary" disabled={!text.trim()} onPress={handleSend}>
        {i18n.t('send')}
      </GameButton>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.md,
    alignItems: 'flex-end',
    gap: SPACE.sm,
    backgroundColor: COLORS.panel,
    borderTopColor: COLORS.bronze,
    borderTopWidth: 1,
  },
  field: { flex: 1, paddingVertical: SPACE.sm, backgroundColor: COLORS.panelRaised },
});
