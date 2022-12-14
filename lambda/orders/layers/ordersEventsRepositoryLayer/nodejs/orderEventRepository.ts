import { DocumentClient } from "aws-sdk/clients/dynamodb";

export interface OrderEventDdb {
  pk: string;
  sk: string;
  ttl: number;
  email: string;
  requestId: string;
  eventType: string;
  createdAt: number;
  info: {
    orderId: string,
    productCodes: string[],
    messageId: string,
  }
}

export class OrderEventRepository {
  constructor(private ddbClient: DocumentClient, private eventsDdb: string) { }

  createOrderEvent(orderEvent: OrderEventDdb) {
    return this.ddbClient.put({
      TableName: this.eventsDdb,
      Item: orderEvent
    }).promise()
  }
}