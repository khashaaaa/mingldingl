import { create } from 'zustand';

interface Notice {
  title: string;
  message: string;
}

interface NoticeState {
  notice: Notice | null;
  dismiss: () => void;
}

/**
 * The app-wide "that failed" notice, drawn by the root layout in the kit's own `AlertModal`.
 * The query and mutation caches used to raise these with `Alert.alert`, which on Android is the
 * stock grey system dialog: the one screen element in the app that looked like another app.
 */
export const useNoticeStore = create<NoticeState>()((set) => ({
  notice: null,
  dismiss: () => set({ notice: null }),
}));

/** Callable outside React (the caches are). A notice already showing is not replaced. */
export function showNotice(title: string, message: string): void {
  if (useNoticeStore.getState().notice) return;
  useNoticeStore.setState({ notice: { title, message } });
}
