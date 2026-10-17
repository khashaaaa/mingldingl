// Development only: in a release bundle __DEV__ is false and the gallery is never required.
export default __DEV__ ? require('@/features/dev/Gallery').default : () => null;
