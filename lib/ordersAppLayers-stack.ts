import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as cdk from 'aws-cdk-lib'

import { Construct } from 'constructs'

export class OrdersAppLayersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const ordersLayers = new lambda.LayerVersion(this, 'OrdersLayer', {
      code: lambda.Code.fromAsset('lambda/orders/layers/ordersLayer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
      layerVersionName: 'OrdersLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    new ssm.StringParameter(this, 'OrdersLayerVersionArn', {
      parameterName: 'OrdersLayerVersionArn',
      stringValue: ordersLayers.layerVersionArn,
    })

    const ordersApiLayers = new lambda.LayerVersion(this, 'OrdersApiLayer', {
      code: lambda.Code.fromAsset('lambda/orders/layers/ordersApiLayer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
      layerVersionName: 'OrdersApiLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    new ssm.StringParameter(this, 'OrdersApiLayerVersionArn', {
      parameterName: 'OrdersApiLayerVersionArn',
      stringValue: ordersApiLayers.layerVersionArn,
    })

    const ordersEventsLayers = new lambda.LayerVersion(this, 'OrdersEventsLayer', {
      code: lambda.Code.fromAsset('lambda/orders/layers/ordersEventsLayer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
      layerVersionName: 'OrdersEventsLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    new ssm.StringParameter(this, 'OrdersEventsLayerVersionArn', {
      parameterName: 'OrdersEventsLayerVersionArn',
      stringValue: ordersEventsLayers.layerVersionArn,
    })

    const ordersEventsRepositoryLayers = new lambda.LayerVersion(this, 'OrdersEventsRepositoryLayer', {
      code: lambda.Code.fromAsset('lambda/orders/layers/ordersEventsRepositoryLayer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
      layerVersionName: 'OrdersEventsRepositoryLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    new ssm.StringParameter(this, 'OrdersEventsRepositoryLayerVersionArn', {
      parameterName: 'OrdersEventsRepositoryLayerVersionArn',
      stringValue: ordersEventsRepositoryLayers.layerVersionArn,
    })
  }
}