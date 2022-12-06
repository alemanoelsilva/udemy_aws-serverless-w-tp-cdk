import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { Product, ProductRepository } from "/opt/nodejs/productsLayer";
import { DynamoDB } from 'aws-sdk'

import * as AWSXRay from 'aws-xray-sdk' 

// capture everything
AWSXRay.captureAWS(require('aws-sdk'))

const productsDdb = process.env.PRODUCTS_DDB!
const ddbClient = new DynamoDB.DocumentClient()

const productRepository = new ProductRepository(ddbClient, productsDdb)

const toJSON = (obj: Product | Product[] | { message: string }) => JSON.stringify(obj)

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;

  const lambdaRequestID = context.awsRequestId;
  const apiRequestID = event.requestContext.requestId;

  console.log(
    `API Gateway RequestId: ${apiRequestID} - Lambda RequestId: ${lambdaRequestID}`
  );

  if (event.resource === "/products") {
    if (method === "GET") {
      console.log("GET");

      const products = await productRepository.getAllProducts()

      return {
        statusCode: 200,
        body: toJSON(products),
      };
    }
  } else if (event.resource === "/products/{id}") {
    const productId = event.pathParameters?.id as string;
    console.log(`GET /products/${productId}`);

    try {
      const product = await productRepository.getProductById(productId)

      return {
        statusCode: 200,
        body: toJSON(product),
      };
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

  return {
    statusCode: 400,
    body: toJSON({
      message: "Bad request",
    }),
  };
}
