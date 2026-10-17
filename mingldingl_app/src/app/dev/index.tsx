// Development only: in a release bundle __DEV__ is false and the tools are never required.
export default __DEV__ ? require('@/features/dev/DevMenu').default : () => null;
