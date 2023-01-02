import * as dynamoDB from 'aws-cdk-lib/aws-dynamodb'
import * as cdk from 'aws-cdk-lib'

import { Construct } from 'constructs'

export class EventsDdbStack extends cdk.Stack {
  readonly table: dynamoDB.Table

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    //* dynamo table
    this.table = new dynamoDB.Table(this, "EventsDdb", {
      tableName: 'events',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'pk',
        type: dynamoDB.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: dynamoDB.AttributeType.STRING,
      },
      // indicate to dynamo the field to consider when deleting the register, based on ttl
      timeToLiveAttribute: 'ttl',
      billingMode: dynamoDB.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
    })

    const readScale = this.table.autoScaleReadCapacity({
      maxCapacity: 2,
      minCapacity: 1,
    })
    readScale.scaleOnUtilization({
      // target percentage to scale up + scaleOutCooldown prop
      targetUtilizationPercent: 50,
      // time to wait to come back to default
      scaleInCooldown: cdk.Duration.seconds(60),
      // time to wait to scale up
      scaleOutCooldown: cdk.Duration.seconds(60),
    })

    const writeScale = this.table.autoScaleWriteCapacity({
      maxCapacity: 4,
      minCapacity: 1,
    })
    writeScale.scaleOnUtilization({
      targetUtilizationPercent: 30,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    })
  }
}
