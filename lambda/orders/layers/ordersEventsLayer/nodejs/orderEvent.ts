export enum OrderEventType {
  CREATED = 'CREATED',
  DELETED = 'DELETED',
}

export interface Envelope {
  eventType: OrderEventType;
  data: string;
}

export interface OrderEvent {
  orderId: string;
  email: string;
  billing: {
    payment: string;
    totalPrice: number;
  },
  shipping: {
    type: string;
    carrier: string;
  },
  productCodes: string[];
  requestId: string;
}