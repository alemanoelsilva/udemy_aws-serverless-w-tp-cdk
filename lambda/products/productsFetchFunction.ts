import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod

  const lambdaRequestID = context.awsRequestId
  const apiRequestID = event.requestContext.requestId

  console.log(`API Gateway RequestId: ${apiRequestID} - Lambda RequestId: ${lambdaRequestID}`)

  if (event.resource === '/products') {
    if (method === 'GET') {
      console.log('GET')

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'GET Products - OK'
        })
      }
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify({
      message: 'Bad request'
    })
  }
}