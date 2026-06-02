export type FppProjectStatus = 'draft' | 'active' | 'funded' | 'completed';

export type FppProjectContract = {
  id: string;
  title: string;
  area: 'education' | 'health' | 'peace' | 'jobs' | 'community';
  targetAmount: number;
  collectedAmount: number;
  currency: string;
  status: FppProjectStatus;
};
