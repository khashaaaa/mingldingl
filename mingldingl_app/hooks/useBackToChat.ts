import { useNavigation, useRouter } from 'expo-router';
import { backToChat } from '../lib/navigation';

/** The route beneath this screen in its stack, read at press time. */
export function useBackToChat(matchId: string): () => void {
  const router = useRouter();
  const navigation = useNavigation();
  return () => {
    const state = navigation.getState();
    const previous = state && state.index > 0 ? state.routes[state.index - 1]?.name : undefined;
    backToChat(router, previous, matchId);
  };
}
