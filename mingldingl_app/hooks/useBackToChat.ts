import { useNavigation, useRouter } from 'expo-router';
import { backToChat } from '../lib/navigation';

/** "Back to chat" against the stack this screen sits in, read at press time. */
export function useBackToChat(matchId: string): () => void {
  const router = useRouter();
  const navigation = useNavigation();
  return () => backToChat(router, navigation.getState(), matchId);
}
