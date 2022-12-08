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
    //* [POST] /products
    productsResource.addMethod('POST', productsAdminIntegration)

    //* [PUT] /products/{id}
    productIdResource.addMethod('PUT', productsAdminIntegration)

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
    //* [POST] /orders
    ordersResource.addMethod('POST', ordersIntegration)
  }
}