import { Context, SNSEvent, SNSMessage } from 'aws-lambda';
import { AWSError, DynamoDB } from 'aws-sdk';
import { PromiseResult } from 'aws-sdk/lib/request';
import * as AWSXRay from 'aws-xray-sdk';
import { Envelope, OrderEvent } from '/opt/nodejs/ordersEventsLayer';
import { OrderEventDdb, OrderEventRepository } from '/opt/nodejs/ordersEventsRepositoryLayer';

// capture everything
AWSXRay.captureAWS(require('aws-sdk'));

const eventsDdb = process.env.EVENTS_DDB!

const ddbClient = new DynamoDB.DocumentClient()
const orderEventsRepository = new OrderEventRepository(ddbClient, eventsDdb)

export async function handler(event: SNSEvent, context: Context): Promise<void> {
  //* running all promises in parallel
  const promises: Promise<PromiseResult<DynamoDB.DocumentClient.PutItemOutput, AWSError>>[] = []

  event.Records.forEach((record) => {
    promises.push(createEvent(record.Sns))
  })

  await Promise.all(promises)
}

function createEvent(body: SNSMessage) {
  const envelope = JSON.parse(body.Message) as Envelope
  const event = JSON.parse(envelope.data) as OrderEvent

  console.log(`Order event - MessageId: ${body.MessageId}`)

  const timestamp = Date.now()
  const ttl = ~~(timestamp / 1000 + 5 * 60)

  const orderEventDdb: OrderEventDdb = {
    pk: `#order_${event.orderId}`,
    sk: `${envelope.eventType}#${timestamp}`,
    ttl,
    email: event.email,
    createdAt: timestamp,
    requestId: event.requestId,
    eventType: envelope.eventType,
    info: {
      orderId: event.orderId,
      productCodes: event.productCodes,
      messageId: body.MessageId
    }
  }

  return orderEventsRepository.createOrderEvent(orderEventDdb)
}