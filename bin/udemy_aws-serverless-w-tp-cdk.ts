#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack'
import { ECommerceApiStack } from '../lib/eCommerceAPI-stack'
import { ProductsAppLayersStack } from '../lib/productsAppLayers-stack'
import { EventsDdbStack } from '../lib/eventsDdb-stack'
import { OrdersAppLayersStack } from '../lib/ordersAppLayers-stack'
import { OrdersAppStack } from '../lib/ordersApp-stack'

const app = new cdk.App();

//! configuration
const env: cdk.Environment = {
  account: '509965907258',
  region: 'us-east-1',
}

const tags = {
  cost: 'ECommerce',
  team: 'Udemy_AWSServerlessWTPAndCDK'
}

const props = { tags, env }

//! events stack
const eventsDdbStack = new EventsDdbStack(app, 'EventsDdb', props)

//! product stack
const productsAppLayersStack = new ProductsAppLayersStack(app, 'ProductsAppLayers', props)
const productsAppStack = new ProductsAppStack(app, 'ProductsApp', {
  ...props,
  eventsDdb: eventsDdbStack.table,
})
productsAppStack.addDependency(productsAppLayersStack)
productsAppStack.addDependency(eventsDdbStack)

//! order stack
const ordersAppLayersStack = new OrdersAppLayersStack(app, 'OrdersAppLayers', props)
const ordersAppStack = new OrdersAppStack(app, 'OrdersApp', {
  ...props,
  productsDdb: productsAppStack.productsDdb,
  eventsDdb: eventsDdbStack.table,
})
ordersAppStack.addDependency(productsAppStack)
ordersAppStack.addDependency(ordersAppLayersStack)
ordersAppStack.addDependency(eventsDdbStack)

//! api gateway stack
const eCommerceApiStack = new ECommerceApiStack(app, 'ECommerceApi', {
  ...props,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  productsFetchHandler: productsAppStack.productsFetchHandler,
  ordersHandler: ordersAppStack.ordersHandler,
})
eCommerceApiStack.addDependency(productsAppStack)
eCommerceApiStack.addDependency(ordersAppStack)