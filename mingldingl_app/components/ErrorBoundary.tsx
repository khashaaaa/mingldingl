import { Component, type ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GameButton } from './ui/GameButton';
import { i18n } from '../lib/i18n';
import { COLORS, FONTS, SPACE } from '../lib/theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Last-resort safety net: catches any uncaught render/lifecycle error in the
// screen tree it wraps and shows a recoverable fallback instead of taking the
// whole app down to a white screen / force-close.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('ErrorBoundary caught a crash:', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>{i18n.t('error_boundary_title')}</Text>
          <Text style={styles.message}>{i18n.t('error_boundary_message')}</Text>
          <GameButton onPress={this.reset}>{i18n.t('error_boundary_retry')}</GameButton>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.xl,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.goldBright,
    textAlign: 'center',
    marginBottom: SPACE.md,
  },
  message: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textDim,
    textAlign: 'center',
    marginBottom: SPACE.xl,
  },
});
