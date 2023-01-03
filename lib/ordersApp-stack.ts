import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as dynamoDB from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as cdk from 'aws-cdk-lib'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as lambdaEventSource from 'aws-cdk-lib/aws-lambda-event-sources'

import { Construct } from 'constructs'

interface OrdersAppStackProps extends cdk.StackProps {
  productsDdb: dynamoDB.Table,
  eventsDdb: dynamoDB.Table,
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
      //* on demand
      // billingMode: dynamoDB.BillingMode.PAY_PER_REQUEST,
    })

    //! orders layers
    const ordersLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersLayerVersionArn')
    const ordersLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersLayerVersionArn', ordersLayerArn)

    //! orders api layers
    const ordersApiLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersApiLayerVersionArn')
    const ordersApiLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersApiLayerVersionArn', ordersApiLayerArn)

    //! orders events layers
    const ordersEventsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersEventsLayerVersionArn')
    const ordersEventsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersEventsLayerVersionArn', ordersEventsLayerArn)

    //! orders events repository layers
    const ordersEventsRepositoryLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersEventsRepositoryLayerVersionArn')
    const ordersEventsRepositoryLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersEventsRepositoryLayerVersionArn', ordersEventsRepositoryLayerArn)

    //! product layers
    const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn')
    const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn)

    //! order Topic
    const ordersTopic = new sns.Topic(this, 'OrderEventsTopic', {
      displayName: 'Order events topic',
      topicName: 'order-events'
    })

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
        ORDER_EVENTS_TOPIC_ARN: ordersTopic.topicArn,
      },
      // adding layers
      layers: [ordersLayer, productsLayer, ordersApiLayer, ordersEventsLayer],
      // adding tracing to see on xray
      tracing: lambda.Tracing.ACTIVE,
      // more logs data
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_143_0,
    })

    //* granting permission to lambda function access (read/write) the dynamo table
    ordersDdb.grantReadWriteData(this.ordersHandler)
    //* granting permission to lambda function access (only read) the dynamo table
    props.productsDdb.grantReadData(this.ordersHandler)
    //* granting permission to lambda function publish message on sns topic
    ordersTopic.grantPublish(this.ordersHandler)

    //*! lambda to create order events
    const orderEventsHandler = new lambdaNodeJS.NodejsFunction(this, 'OrderEventsFunction', {
      functionName: 'OrderEventsFunction',
      entry: 'lambda/orders/orderEventsFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment: {
        EVENTS_DDB: props.eventsDdb.tableName,
      },
      // adding layers
      layers: [ordersEventsLayer, ordersEventsRepositoryLayer],
      // adding tracing to see on xray
      tracing: lambda.Tracing.ACTIVE,
      // more logs data
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_143_0,
    })

    //* granting permission to sns topic call lambda (adding subscription)
    ordersTopic.addSubscription(new subs.LambdaSubscription(orderEventsHandler))

    //* creating a custom policy to specify the access rule
    const eventsDdbPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:PutItem'],
      resources: [props.eventsDdb.tableArn],
      conditions: {
        ['ForAllValues:StringLike']: {
          'dynamodb:LeadingKeys': ['#order_*']
        }
      }
    })

    orderEventsHandler.addToRolePolicy(eventsDdbPolicy)

    //*! lambda to payment
    const billingHandler = new lambdaNodeJS.NodejsFunction(this, 'BillingFunction', {
      functionName: 'BillingFunction',
      entry: 'lambda/orders/billingFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      // adding tracing to see on xray
      tracing: lambda.Tracing.ACTIVE,
      // more logs data
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_143_0,
    })

    //* add subscription with filter, triggered only when eventType is ORDER_CREATED
    ordersTopic.addSubscription(new subs.LambdaSubscription(billingHandler, {
      filterPolicy: {
        eventType: sns.SubscriptionFilter.stringFilter({
          allowlist: ['ORDER_CREATED']
        })
      }
    }))

    //! SQS DLQ
    const orderEventsDlq = new sqs.Queue(this, 'OrderEventsDlq', {
      queueName: 'order-events-dlq',
      retentionPeriod: cdk.Duration.days(10),
    })

    //! SQS
    const orderEventsQueue = new sqs.Queue(this, 'OrderEventsQueue', {
      queueName: 'order-events',
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: orderEventsDlq,
      }
    })

    //* adding a new subscription to consume the ordersTopic message filtered by ORDER_CREATED eventType
    ordersTopic.addSubscription(new subs.SqsSubscription(orderEventsQueue, {
      filterPolicy: {
        eventType: sns.SubscriptionFilter.stringFilter({
          allowlist: ['ORDER_CREATED']
        })
      }
    }))

    //*! lambda to send email
    const orderEmailHandler = new lambdaNodeJS.NodejsFunction(this, 'OrderEmailFunction', {
      functionName: 'OrderEmailFunction',
      entry: 'lambda/orders/orderEmailFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      layers: [ordersEventsLayer],
      // adding tracing to see on xray
      tracing: lambda.Tracing.ACTIVE,
      // more logs data
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_143_0,
    })

    //* adding the origin of the data where the lambda will fetch it
    orderEmailHandler.addEventSource(new lambdaEventSource.SqsEventSource(orderEventsQueue, {
      batchSize: 5,
      enabled: true,
      maxBatchingWindow: cdk.Duration.minutes(1),
    }))
    //* giving access to lambda consume message from the Queue
    orderEventsQueue.grantConsumeMessages(orderEmailHandler)
  }
}
