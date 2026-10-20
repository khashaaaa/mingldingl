// Keeps the Android download small. Calls use plain audio and video, so Agora's optional
// extensions (≈30 MB of native code per CPU type) stay out; echo cancellation, noise suppression
// and the hardware video encoder stay in. Store and preview builds carry only the ARM CPUs; a
// development build keeps every CPU type so the x86_64 emulator still runs it.
const { withGradleProperties } = require('expo/config-plugins');

const AGORA_EXTRAS = [
  'audio_beauty',
  'clear_vision',
  'content_inspect',
  'face_capture',
  'face_detection',
  'lip_sync',
  'screen_capture',
  'segmentation',
  'spatial_audio',
  'video_av1_encoder',
  'video_quality_analyzer',
];

function set(props, key, value) {
  const at = props.find((p) => p.type === 'property' && p.key === key);
  if (at) at.value = value;
  else props.push({ type: 'property', key, value });
}

module.exports = function withLeanAndroid(config) {
  return withGradleProperties(config, (c) => {
    set(c.modResults, 'android.packagingOptions.excludes', AGORA_EXTRAS.map((n) => `**/libagora_${n}_extension.so`).join(','));
    if (['preview', 'production'].includes(process.env.EAS_BUILD_PROFILE))
      set(c.modResults, 'reactNativeArchitectures', 'armeabi-v7a,arm64-v8a');
    return c;
  });
};
