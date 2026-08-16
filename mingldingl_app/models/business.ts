import type { components } from '../lib/api/api.generated';

export interface Business {
  id: string;
  name: string;
  category: string;
  city: string;
  district: string;
  description: string;
  photoUrls: string[];
  operatingHours: string;
  isVerified: boolean;
  isFeatured: boolean;
  averageRating: number;
  ratingCount: number;
}

export function parseBusiness(d: components['schemas']['BusinessResponse']): Business {
  return {
    id: d.id ?? '',
    name: d.name ?? '',
    category: d.category ?? '',
    city: d.city ?? '',
    district: d.district ?? '',
    description: d.description ?? '',
    photoUrls: d.photoUrls ?? [],
    operatingHours: d.operatingHours ?? '',
    isVerified: d.isVerified ?? false,
    isFeatured: d.isFeatured ?? false,
    averageRating: d.averageRating ?? 0,
    ratingCount: d.ratingCount ?? 0,
  };
}
