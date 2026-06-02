export type ChatThreadType = 'direct' | 'group' | 'village' | 'kyaghanda' | 'support';

export type ChatThreadContract = {
  id: string;
  type: ChatThreadType;
  title: string;
  members: Record<string, boolean>;
  orderId?: string;
  productId?: string;
  updatedAt: number;
};

export type ChatMessageContract = {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  type?: 'text' | 'order' | 'village_share' | 'payment' | 'system';
  createdAt: number;
  status: 'queued' | 'sent' | 'delivered' | 'read';
};
