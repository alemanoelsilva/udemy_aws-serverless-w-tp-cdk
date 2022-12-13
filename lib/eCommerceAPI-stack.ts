import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as cwlogs from 'aws-cdk-lib/aws-logs'

import * as cdk from 'aws-cdk-lib'

import { Construct } from 'constructs'


interface ECommerceApiStackProps extends cdk.StackProps {
  productsFetchHandler: lambdaNodeJS.NodejsFunction
  productsAdminHandler: lambdaNodeJS.NodejsFunction
  ordersHandler: lambdaNodeJS.NodejsFunction
}

export class ECommerceApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ECommerceApiStackProps) {
    super(scope, id, props)

    const logGroup = new cwlogs.LogGroup(this, 'ECommerceApiLogs')
    const api = new apigateway.RestApi(this, 'ECommerceApi', {
      restApiName: 'ECommerceApi',
      cloudWatchRole: true,
      deployOptions: {
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          caller: true,
          user: true,
        })
      }
    })

    this.createProductsService(props, api)
    this.createOrdersService(props, api)
  }

  private createProductsService(props: ECommerceApiStackProps, api: apigateway.RestApi) {
    const productsFetchIntegration = new apigateway.LambdaIntegration(props.productsFetchHandler)

    // adding /products to resource
    const productsResource = api.root.addResource('products')
    // adding the param {id} to /products resource
    const productIdResource = productsResource.addResource('{id}')

    //! MAPPING routes to GET
    //* [GET] /products
    productsResource.addMethod('GET', productsFetchIntegration)

    //* [GET] /products/{id}
    productIdResource.addMethod('GET', productsFetchIntegration)

    //! MAPPING routes to POST/PUT/DELETE
    const productsAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler)

    //* request validator
    const productRequestValidator = new apigateway.RequestValidator(this, 'ProductRequestValidator', {
      restApi: api,
      requestValidatorName: 'Product request validator',
      validateRequestBody: true,
    })

    //* request product model
    const productModel = new apigateway.Model(this, 'ProductModel', {
      modelName: 'ProductModel',
      restApi: api,
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          productName: {
            type: apigateway.JsonSchemaType.STRING
          },
          code: {
            type: apigateway.JsonSchemaType.STRING
          },
          model: {
            type: apigateway.JsonSchemaType.STRING
          },
          productUrl: {
            type: apigateway.JsonSchemaType.STRING
          },
          price: {
            type: apigateway.JsonSchemaType.NUMBER
          },
        },
        required: ['productName', 'code', 'price']
      }
    })

    //* [POST] /products
    productsResource.addMethod('POST', productsAdminIntegration, {
      requestValidator: productRequestValidator,
      requestModels: {
        'application/json': productModel
      }
    })

    //* [PUT] /products/{id}
    productIdResource.addMethod('PUT', productsAdminIntegration, {
      requestValidator: productRequestValidator,
      requestModels: {
        'application/json': productModel
      }
    })

    //* [DELETE] /products/{id}
    productIdResource.addMethod('DELETE', productsAdminIntegration)
  }

  private createOrdersService(props: ECommerceApiStackProps, api: apigateway.RestApi) {
    const ordersIntegration = new apigateway.LambdaIntegration(props.ordersHandler)

    //! adding /orders to resource
    const ordersResource = api.root.addResource('orders')

    //! MAPPING routes to GET
    //* [GET] /orders
    //* [GET] /orders?email=XXX
    //* [GET] /orders?email=XXX&orderId=123
    ordersResource.addMethod('GET', ordersIntegration)

    //! MAPPING routes to DELETE
    //* [DELETE] /orders?email=XXX&orderId=123
    ordersResource.addMethod('DELETE', ordersIntegration, {
      requestParameters: {
        'method.request.querystring.email': true,
        'method.request.querystring.orderId': true,
      },
      requestValidator: new apigateway.RequestValidator(this, 'OrderDeletionValidator', {
        restApi: api,
        requestValidatorName: 'orderDeletionValidator',
        validateRequestParameters: true,
      })
    })

    //! MAPPING routes to POST
    //* request validator
    const orderRequestValidator = new apigateway.RequestValidator(this, 'OrderRequestValidator', {
      restApi: api,
      requestValidatorName: 'Order request validator',
      validateRequestBody: true,
    })

    //* request order model
    const orderModel = new apigateway.Model(this, 'OrderModel', {
      modelName: 'OrderModel',
      restApi: api,
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          email: {
            type: apigateway.JsonSchemaType.STRING
          },
          productIds: {
            type: apigateway.JsonSchemaType.ARRAY,
            minItems: 1,
            items: {
              type: apigateway.JsonSchemaType.STRING
            }
          },
          payment: {
            type: apigateway.JsonSchemaType.STRING,
            enum: ['CASH', 'DEBIT_CARD', 'CREDIT_CARD']
          }
        },
        required: ['email', 'productIds', 'payment']
      }
    })

    //* [POST] /orders
    ordersResource.addMethod('POST', ordersIntegration, {
      requestValidator: orderRequestValidator,
      requestModels: {
        'application/json': orderModel
      }
    })
  }
}