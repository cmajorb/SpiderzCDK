// import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { WebSocketApi, WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

import {
  CfnOutput, Duration, RemovalPolicy, Stack, StackProps
} from 'aws-cdk-lib';
import path = require('path');

export class SpiderzCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const connectionLambda = new NodejsFunction(this, 'ConnectionHandlerLambda', {
      entry: "../src/lambda/connection-handler.ts",
      handler: "connectionHandler",
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(5),
      memorySize: 1024,
      tracing: Tracing.ACTIVE,
      functionName: "ConnectionHandler",
      description: "Handles the onConnect & onDisconnect events emitted by the WebSocket API Gateway",
      depsLockFilePath: path.join(__dirname, '..', '..', 'src', 'package-lock.json'),
      environment: {},
    });

    const requestHandlerLambda = new NodejsFunction(this, 'RequestHandlerLambda', {
      entry: "../src/lambda/request-handler.ts",
      handler: "handleMessage",
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(5),
      memorySize: 1024,
      tracing: Tracing.ACTIVE,
      functionName: "RequestHandler",
      description: "Handles requests sent via websocket and stores (connectionId, chatId) tuple in DynamoDB. Sends ChatMessageReceived events to EventBridge.",
      depsLockFilePath: path.join(__dirname, '..', '..', 'src', 'package-lock.json'),
      environment: {},
    });


    const webSocketApi = new WebSocketApi(this, 'WebsocketApi', {
      apiName: 'WebSocketApi',
      description: 'A regional Websocket API for the multi-region chat application.',
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration('connectionIntegration', connectionLambda),
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration('disconnectIntegration', connectionLambda),
      },
      defaultRouteOptions: {
        integration: new WebSocketLambdaIntegration('defaultIntegration', requestHandlerLambda),
      },
    });

    const websocketStage = new WebSocketStage(this, 'WebsocketStage', {
      webSocketApi,
      stageName: 'chat',
      autoDeploy: true,
    });

  }
}