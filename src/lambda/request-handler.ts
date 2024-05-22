import generateLambdaProxyResponse from './utils';
import { SocketEvent } from '../models/socket-event';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { APIGatewayProxyEvent } from 'aws-lambda';

const AWSXRay = require('aws-xray-sdk-core');
const SQS = AWSXRay.captureAWSv3Client(new SQSClient());

export async function handleMessage(event: APIGatewayProxyEvent) {
  console.log('Received event ', event);
  var val = JSON.parse(event.body || "") as SocketEvent;
  try {
    if(val.type == "click") {
        val.connectionId = event.requestContext.connectionId!;
        const command = new SendMessageCommand({
            QueueUrl: process.env.STATUS_QUEUE_URL,
            MessageBody: JSON.stringify(val),
            MessageAttributes: {
                Type: {
                    StringValue: 'SocketEvent',
                    DataType: 'String',
                },
            },
        });
        let sqsResults = await SQS.send(command);
        console.log(sqsResults);
    } else {
        console.log("Unrecognized type: " + val.type);
    }
} catch (error: any) {
    console.log("Failed to push to SQS");
    var body = error.stack || JSON.stringify(error, null, 2);
    console.log(body);
    return generateLambdaProxyResponse(500, 'Error');
}
  return generateLambdaProxyResponse(200, 'Ok');
}