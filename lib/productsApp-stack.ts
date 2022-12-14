import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as dynamoDB from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'

import { Construct } from 'constructs'

interface ProductsAppStackProps extends cdk.StackProps {
  eventsDdb: dynamoDB.Table
}

export class ProductsAppStack extends cdk.Stack {
  readonly productsFetchHandler: lambdaNodeJS.NodejsFunction
  readonly productsAdminHandler: lambdaNodeJS.NodejsFunction
  readonly productsDdb: dynamoDB.Table

  constructor(scope: Construct, id: string, props: ProductsAppStackProps) {
    super(scope, id, props)

    //* dynamo table
    this.productsDdb = new dynamoDB.Table(this, "ProductsDdb", {
      tableName: 'products',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'id',
        type: dynamoDB.AttributeType.STRING,
      },
      billingMode: dynamoDB.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
    })

    //! Layers
    //* products layer (getting the parameter created at productsAppLayers-stack.ts)
    const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn')
    const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn)
    //* product events layer (getting the parameter created at productsAppLayers-stack.ts)
    const productEventsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductEventsLayerVersionArn')
    const productEventsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductEventsLayerVersionArn', productEventsLayerArn)

    //*! lambda to fetch products
    this.productsFetchHandler = new lambdaNodeJS.NodejsFunction(this, 'ProductsFetchFunction', {
      functionName: 'ProductsFetchFunction',
      entry: 'lambda/products/productsFetchFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment: {
        PRODUCTS_DDB: this.productsDdb.tableName,
      },
      // adding layers
      layers: [productsLayer],
      // adding tracing to see on xray
      tracing: lambda.Tracing.ACTIVE,
      // more logs data
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_143_0,
    })

    //* granting permission to lambda function access (read) the dynamo table
    this.productsDdb.grantReadData(this.productsFetchHandler)

    //*! lambda to create events about the products
    const productEventsHandler = new lambdaNodeJS.NodejsFunction(this, 'ProductEventsFunction', {
      functionName: 'ProductEventsFunction',
      entry: 'lambda/products/productEventsFunction.ts',
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
      layers: [productEventsLayer],
      // adding tracing to see on xray
      tracing: lambda.Tracing.ACTIVE,
      // more logs data
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_143_0,
    })

    //* granting permission to lambda function access (write) the dynamo table
    props.eventsDdb.grantWriteData(productEventsHandler)

    //* creating a custom policy to specify the access rule
    const eventsDdbPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:PutItem'],
      resources: [props.eventsDdb.tableArn],
      conditions: {
        ['ForAllValues:StringLike']: {
          'dynamodb:LeadingKeys': ['#product*']
        }
      }
    })

    productEventsHandler.addToRolePolicy(eventsDdbPolicy)

    //*! lambda to manage the products (Admin)
    this.productsAdminHandler = new lambdaNodeJS.NodejsFunction(this, 'ProductsAdminFunction', {
      functionName: 'ProductsAdminFunction',
      entry: 'lambda/products/productsAdminFunction.ts',
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      bundling: {
        minify: true,
        sourceMap: false,
      },
      environment: {
        PRODUCTS_DDB: this.productsDdb.tableName,
        PRODUCT_EVENTS_FUNCTION_NAME: productEventsHandler.functionName,
      },
      // adding layers
      layers: [productsLayer, productEventsLayer],
      // adding tracing to see on xray
      tracing: lambda.Tracing.ACTIVE,
      // more logs data
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_143_0,
    })

    //* granting permission to lambda function access (write) the dynamo table
    this.productsDdb.grantWriteData(this.productsAdminHandler)
    //* granting permission to lambda function (admin) access another lambda function by invoke (events)
    productEventsHandler.grantInvoke(this.productsAdminHandler)
  }
}
