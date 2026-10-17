import { useLocalSearchParams } from 'expo-router';
import { SigilVerify } from '@/features/settings/Sigil';

export default function SigilVerifyRoute() {
  const { phone = '' } = useLocalSearchParams<{ phone: string }>();
  return <SigilVerify phone={phone} />;
}
