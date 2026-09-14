import { Component, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { StateBlock } from './ui/StateBlock';
import { GameButton } from './ui/GameButton';
import { i18n } from '../lib/i18n';
import { SPACE, SURFACE } from '../lib/theme';
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

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
          <StateBlock
            tone="danger"
            icon="alert-circle-outline"
            title={i18n.t('error_boundary_title')}
            body={i18n.t('error_boundary_message')}
          >
            <GameButton onPress={this.reset}>{i18n.t('error_boundary_retry')}</GameButton>
          </StateBlock>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SURFACE.ground,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.xl,
  },
});
