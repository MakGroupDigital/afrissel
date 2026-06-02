export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected';
export type BusinessDomainCategory = 'commerce' | 'payment' | 'logistics' | 'services' | 'abc_media';

export type IdentityProfileContract = {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  kycStatus?: KycStatus;
  businessCategories?: BusinessDomainCategory[];
};
