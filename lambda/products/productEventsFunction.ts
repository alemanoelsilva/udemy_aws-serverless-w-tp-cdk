import { Callback, Context } from "aws-lambda";
import { ProductEvent } from "./layers/productEventsLayer/nodejs/productEvents";
import { DynamoDB } from 'aws-sdk'

import * as AWSXRay from 'aws-xray-sdk'
import { timeStamp } from "console";

// capture everything
AWSXRay.captureAWS(require('aws-sdk'))

const eventsDdb = process.env.EVENTS_DDB!
const ddbClient = new DynamoDB.DocumentClient()

const toJSON = (obj: any) => JSON.stringify(obj)

export async function handler(event: ProductEvent, context: Context, callback: Callback): Promise<void> {
  console.log(`Lambda RequestId: ${context.awsRequestId}`)

  await createEvent(event)

  callback(null, toJSON({
    productEventCreated: true,
    message: 'OK'
  }))
}

function createEvent(event: ProductEvent) {
  // in milliseconds
  const timestamp = Date.now()
  // convert to seconds and sum 5 minutes, rounding ~~
  const ttl = ~~(timestamp / 1000 + 5 + 60)

  return ddbClient.put({
    TableName: eventsDdb,
    Item: {
      pk: `#product_${event.productCode}`,
      sk: `${event.eventType}#${timestamp}`,
      email: event.email,
      createdAt: timeStamp,
      requestId: event.requestId,
      eventType: event.eventType,
      info: {
        productId: event.productId,
        price: event.productPrice,
      },
      ttl,
    },
  }).promise()
}