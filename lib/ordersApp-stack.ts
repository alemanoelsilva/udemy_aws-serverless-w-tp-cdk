import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as dynamoDB from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as cdk from 'aws-cdk-lib'

import { Construct } from 'constructs'

interface OrdersAppStackProps extends cdk.StackProps {
  productsDdb: dynamoDB.Table
}

export class OrdersAppStack extends cdk.Stack {
  readonly ordersHandler: lambdaNodeJS.NodejsFunction

  constructor(scope: Construct, id: string, props: OrdersAppStackProps) {
    super(scope, id, props)

    const ordersDdb = new dynamoDB.Table(this, 'OrdersDdb', {
      tableName: 'orders',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      partitionKey: {
        name: 'pk',
        type: dynamoDB.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: dynamoDB.AttributeType.STRING,
      },
      billingMode: dynamoDB.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
    })

    //! orders layers
    const ordersLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersLayerVersionArn')
    const ordersLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersLayerVersionArn', ordersLayerArn)

    //! orders api layers
    const ordersApiLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersApiLayerVersionArn')
    const ordersApiLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersApiLayerVersionArn', ordersApiLayerArn)

    //! product layers
    const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn')
    const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn)

    //*! lambda to create orders
    this.ordersHandler = new lambdaNodeJS.NodejsFunction(this, 'OrdersFunction', {
      functionName: 'OrdersFunction',
      entry: 'lambda/orders/ordersFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment: {
        ORDERS_DDB: ordersDdb.tableName,
        PRODUCTS_DDB: props.productsDdb.tableName,
      },
      // adding layers
      layers: [ordersLayer, productsLayer, ordersApiLayer],
      // adding tracing to see on xray
      tracing: lambda.Tracing.ACTIVE,
      // more logs data
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_143_0,
    })

    //* granting permission to lambda function access (read/write) the dynamo table
    ordersDdb.grantReadWriteData(this.ordersHandler)
    //* granting permission to lambda function access (only read) the dynamo table
    props.productsDdb.grantReadData(this.ordersHandler)
  }
}
