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
  }
}