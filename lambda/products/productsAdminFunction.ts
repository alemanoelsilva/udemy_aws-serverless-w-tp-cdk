import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB, Lambda } from 'aws-sdk'
import { ProductEvent, ProductEventType } from "./layers/productEventsLayer/nodejs/productEvents";

import * as AWSXRay from 'aws-xray-sdk'

// capture everything
AWSXRay.captureAWS(require('aws-sdk'))

const productsDdb = process.env.PRODUCTS_DDB!
const productEventsFunctionName = process.env.PRODUCT_EVENTS_FUNCTION_NAME!
const ddbClient = new DynamoDB.DocumentClient()
const lambdaClient = new Lambda()

const productRepository = new ProductRepository(ddbClient, productsDdb)

const toJSON = (obj: any) => JSON.stringify(obj)
const getProductFromEvent = (str: string | null) => JSON.parse(str!) as Product

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod

  const lambdaRequestID = context.awsRequestId
  const apiRequestID = event.requestContext.requestId

  console.log(`API Gateway RequestId: ${apiRequestID} - Lambda RequestId: ${lambdaRequestID}`)

  if (event.resource === '/products') {
    if (method === 'POST') {
      console.log('POST')
      const product = getProductFromEvent(event.body)

      const productCreated = await productRepository.create(product)
      await sendProductEvent(productCreated, ProductEventType.CREATED, 'fake_email@gmail.com', lambdaRequestID)

      return {
        statusCode: 201,
        body: toJSON(productCreated)
      }
    }
  } else if (event.resource === '/products/{id}') {
    const productId = event.pathParameters?.id as string
    if (method === 'PUT') {
      console.log(`PUT /products/${productId}`)

      const product = getProductFromEvent(event.body)

      try {
        const productUpdated = await productRepository.updateProductById(productId, product)
        await sendProductEvent(productUpdated, ProductEventType.UPDATED, 'fake_email@gmail.com', lambdaRequestID)

        return {
          statusCode: 200,
          body: toJSON(productUpdated)
        }
      } catch (ConditionalCheckFailedException) {
        return {
          statusCode: 404,
          body: toJSON({
            message: 'Product not found'
          }),
        };
      }
    } else if (method === 'DELETE') {
      console.log(`DELETE /products/${productId}`)

      try {
        const product = await productRepository.deleteProductById(productId)
        await sendProductEvent(product, ProductEventType.DELETED, 'fake_email@gmail.com', lambdaRequestID)

        return {
          statusCode: 200,
          body: toJSON(product)
        }
      } catch (error) {
        console.error((<Error>error).message)

        return {
          statusCode: 404,
          body: toJSON({
            message: (<Error>error).message
          }),
        };
      }
    }
  }

  return {
    statusCode: 400,
    body: toJSON({
      message: 'Bad request'
    })
  }
}

function sendProductEvent(product: Product, eventType: ProductEventType, email: string, lambdaRequestId: string) {
  const event: ProductEvent = {
    email,
    eventType,
    productCode: product.code,
    productId: product.id,
    productPrice: product.price,
    requestId: lambdaRequestId,
  }

  return lambdaClient.invoke({
    FunctionName: productEventsFunctionName,
    Payload: toJSON(event),
    // wait the lambda finish to continue working
    // InvocationType: 'RequestResponse',
    // Does not wait the lambda finish to continue working
    InvocationType: 'Event',
  }).promise()
}