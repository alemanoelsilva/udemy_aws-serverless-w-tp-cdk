import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { v4 as uuid } from 'uuid'
import { Order, OrderProduct, OrderRepository } from '/opt/nodejs/ordersLayer';
import {
  OrderRequest,
  OrderQueryType,
  OrderProductResponse,
  OrderResponse,
  PaymentType,
  ShippingType,
  CarrierType,
} from '/opt/nodejs/ordersApiLayer';
import { Product, ProductRepository } from '/opt/nodejs/productsLayer';
import { DynamoDB, SNS } from 'aws-sdk';
import { OrderEvent, Envelope, OrderEventType } from '/opt/nodejs/ordersEventsLayer';

import * as AWSXRay from 'aws-xray-sdk';

// capture everything
AWSXRay.captureAWS(require('aws-sdk'));

const ordersDdb = process.env.ORDERS_DDB!;
const productsDdb = process.env.PRODUCTS_DDB!;
const orderEventsTopicArn = process.env.ORDER_EVENTS_TOPIC_ARN!;

const ddbClient = new DynamoDB.DocumentClient();
const snsClient = new SNS();

const orderRepository = new OrderRepository(ddbClient, ordersDdb);
const productRepository = new ProductRepository(ddbClient, productsDdb);

const toJSON = (obj: any) => JSON.stringify(obj);

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

  if (method === 'GET') {
    console.log('GET');

    const orders: Order[] = [];

    if (event.queryStringParameters) {
      const { email, orderId } = event.queryStringParameters as OrderQueryType;

      if (email) {
        if (orderId) {
          //* filter by email and orderId
          try {
            const data = await orderRepository.getOrder(email, orderId);
            orders.push(data);
          } catch (error) {
            console.error((<Error>error).message);

            return {
              statusCode: 404,
              body: toJSON({
                message: (<Error>error).message,
              }),
            };
          }
        } else {
          //* filter by email only
          const data = await orderRepository.getOrdersByEmail(email);
          orders.push(...data);
        }
      }
    } else {
      //* get all orders
      const data = await orderRepository.getAllOrders();
      orders.push(...data);
    }

    return {
      statusCode: 200,
      body: toJSON(orders.map(covertToOrderResponse)),
    };
  } else if (method === 'POST') {
    console.log('POST');

    const orderRequest = JSON.parse(event.body!) as OrderRequest;
    const products = await productRepository.getProductsByIds(
      orderRequest.productIds
    );

    if (products.length !== orderRequest.productIds.length) {
      //? number of products are different
      return {
        statusCode: 400,
        body: toJSON({
          message: 'some product was not found',
        }),
      };
    }

    const order = buildOrder(orderRequest, products);
    // const orderCreated = await orderRepository.createOrder(order);
    // const eventResult = await sendOrderEvent(orderCreated, OrderEventType.CREATED, lambdaRequestID)

    const [orderCreated, eventResult] = await Promise.all([
      orderRepository.createOrder(order),
      sendOrderEvent(order, OrderEventType.CREATED, lambdaRequestID)
    ])

    console.log(`Order created event sent - OrderId: ${orderCreated.sk} - MessageId: ${eventResult.MessageId}`)

    return {
      statusCode: 200,
      body: toJSON(covertToOrderResponse(orderCreated)),
    };
  } else if (method === 'DELETE') {
    const { email, orderId } = event.queryStringParameters as OrderQueryType;
    console.log('DELETE', { email, orderId });

    try {
      const orderDeleted = await orderRepository.deleteOrder(email, orderId);

      const eventResult = await sendOrderEvent(orderDeleted, OrderEventType.DELETED, lambdaRequestID)
      console.log(`Order deleted event sent - OrderId: ${orderDeleted.sk} - MessageId: ${eventResult.MessageId}`)

      return {
        statusCode: 200,
        body: toJSON(covertToOrderResponse(orderDeleted)),
      };
    } catch (error) {
      console.error((<Error>error).message);

      return {
        statusCode: 404,
        body: toJSON({
          message: (<Error>error).message,
        }),
      };
    }
  }

  return {
    statusCode: 400,
    body: toJSON({
      message: 'Bad request',
    }),
  };
}

function sendOrderEvent(order: Order, eventType: OrderEventType, lambdaRequestId: string) {
  const orderEvent: OrderEvent = {
    email: order.pk,
    orderId: order.sk!,
    billing: {
      payment: order.billing.payment,
      totalPrice: order.billing.totalPrice,
    },
    shipping: {
      carrier: order.shipping.carrier,
      type: order.shipping.type,
    },
    requestId: lambdaRequestId,
    productCodes: order.products.map(product => product.code)

  }

  const envelope: Envelope = {
    eventType,
    data: toJSON(orderEvent)
  }

  return snsClient.publish({
    TopicArn: orderEventsTopicArn,
    Message: toJSON(envelope),
    MessageAttributes: { // to filter message
      eventType: {
        DataType: 'String',
        StringValue: eventType,
      }
    }
  }).promise()
}

function covertToOrderResponse(order: Order): OrderResponse {
  const orderProducts: OrderProductResponse[] = order.products.map(
    (product: OrderProduct) => ({
      code: product.code,
      price: product.price,
    })
  );

  const orderResponse: OrderResponse = {
    email: order.pk,
    id: order.sk!,
    createdAt: order.createdAt!,
    products: orderProducts,
    billing: {
      payment: order.billing.payment as PaymentType,
      totalPrice: order.billing.totalPrice,
    },
    shipping: {
      type: order.shipping.type as ShippingType,
      carrier: order.shipping.carrier as CarrierType,
    },
  };

  return orderResponse;
}

function buildOrder(orderRequest: OrderRequest, products: Product[]): Order {
  let totalPrice = 0;

  const orderProducts: OrderProductResponse[] = products.map(
    (product: Product) => {
      totalPrice += product.price;
      return {
        code: product.code,
        price: product.price,
      };
    }
  );

  const order: Order = {
    pk: orderRequest.email,
    sk: uuid(),
    createdAt: Date.now(),
    billing: {
      payment: orderRequest.payment,
      totalPrice,
    },
    shipping: {
      type: orderRequest.shipping.type,
      carrier: orderRequest.shipping.carrier,
    },
    products: orderProducts,
  };

  return order;
}
