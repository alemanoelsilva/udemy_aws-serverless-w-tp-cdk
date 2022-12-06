#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack'
import { ECommerceApiStack } from '../lib/eCommerceAPI-stack'
import { ProductsAppLayersStack } from '../lib/productsAppLayers-stack'
import { EventsDdbStack } from '../lib/eventsDdb-stack'

const app = new cdk.App();

const env: cdk.Environment = {
  account: '509965907258',
  region: 'us-east-1',
}

const tags = {
  cost: 'ECommerce',
  team: 'Udemy_AWSServerlessWTPAndCDK'
}

const props = { tags, env }

const eventsDdbStack = new EventsDdbStack(app, 'EventsDdb', props)

const productsAppLayersStack = new ProductsAppLayersStack(app, 'ProductsAppLayers', props)
const productsAppStack = new ProductsAppStack(app, 'ProductsApp', {
  ...props,
  eventsDdb: eventsDdbStack.table,
})
productsAppStack.addDependency(productsAppLayersStack)
productsAppStack.addDependency(eventsDdbStack)

const eCommerceApiStack = new ECommerceApiStack(app, 'ECommerceApi', {
  ...props,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  productsFetchHandler: productsAppStack.productsFetchHandler,
})
eCommerceApiStack.addDependency(productsAppStack)