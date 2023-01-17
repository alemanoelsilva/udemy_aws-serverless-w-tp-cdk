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

  async getOrderEventsByEmail(email: string) {
    const data = await this.ddbClient.query({
      TableName: this.eventsDdb,
      IndexName: 'emailIndex',
      KeyConditionExpression: 'email = :email AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':email': email,
        ':prefix': 'ORDER_',
      },
    }).promise()

    return data.Items as OrderEventDdb[]
  }

  async getOrderEventsByEmailAndEventType(email: string, eventType: string) {
    const data = await this.ddbClient.query({
      TableName: this.eventsDdb,
      IndexName: 'emailIndex',
      KeyConditionExpression: 'email = :email AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':email': email,
        ':prefix': eventType,
      },
    }).promise()

    return data.Items as OrderEventDdb[]
  }
}