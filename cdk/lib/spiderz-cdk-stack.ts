import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { WebSocketApi, WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Queue } from 'aws-cdk-lib/aws-sqs';

import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import path = require('path');

export class SpiderzCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const statusQueue = new Queue(this, 'user-status-queue', {
      visibilityTimeout: Duration.seconds(30),      // default,
      receiveMessageWaitTime: Duration.seconds(20), // default
    });

    const connectionsTable = new Table(this, 'WebsocketConnections', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      tableName: 'WebsocketConnections',
      partitionKey: {
        name: 'sessionId',
        type: AttributeType.STRING,
      }
    });

    connectionsTable.addGlobalSecondaryIndex({
      indexName: 'connections-by-room-id',
      partitionKey: {
        name: 'roomId',
        type: AttributeType.STRING
      }
    })

    const gameTable = new Table(this, 'Games', {
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
      tableName: 'Games',
      partitionKey: {
        name: 'gameId',
        type: AttributeType.STRING,
      }
    });

    const connectionLambda = new NodejsFunction(this, 'ConnectionHandlerLambda', {
      entry: "../src/lambda/connection-handler.ts",
      handler: "connectionHandler",
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(5),
      memorySize: 1024,
      functionName: "ConnectionHandler",
      description: "Handles the onConnect & onDisconnect events emitted by the WebSocket API Gateway",
      depsLockFilePath: path.join(__dirname, '..', '..', 'src', 'package-lock.json'),
      environment: {
        TABLE_NAME: connectionsTable.tableName,
        STATUS_QUEUE_URL: statusQueue.queueUrl,
      },
    });
    connectionsTable.grantFullAccess(connectionLambda);
    statusQueue.grantSendMessages(connectionLambda);

    const requestHandlerLambda = new NodejsFunction(this, 'RequestHandlerLambda', {
      entry: "../src/lambda/request-handler.ts",
      handler: "handleMessage",
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(300),
      memorySize: 1024,
      functionName: "RequestHandler",
      description: "Handles requests sent via websocket and stores (connectionId, chatId) tuple in DynamoDB.",
      depsLockFilePath: path.join(__dirname, '..', '..', 'src', 'package-lock.json'),
      environment: {
        TABLE_NAME: connectionsTable.tableName,
        GAME_TABLE_NAME: gameTable.tableName,
        STATUS_QUEUE_URL: statusQueue.queueUrl,
      },
    });
    statusQueue.grantSendMessages(requestHandlerLambda);
    connectionsTable.grantFullAccess(requestHandlerLambda);
    gameTable.grantFullAccess(requestHandlerLambda);

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
      stageName: 'play',
      autoDeploy: true,
    });

    const responseHandlerLambda = new NodejsFunction(this, 'ResponseHandlerLambda', {
      entry: "../src/lambda/response-handler.ts",
      handler: "handler",
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(5),
      memorySize: 1024,
      functionName: "ResponseHandler",
      description: "Gets invoked when a new event occurs.",
      depsLockFilePath: path.join(__dirname, '..', '..', 'src', 'package-lock.json'),
      environment: {
        TABLE_NAME: connectionsTable.tableName,
        API_GATEWAY_ENDPOINT: websocketStage.callbackUrl,
      },
    });
    connectionsTable.grantReadData(responseHandlerLambda);
    responseHandlerLambda.addEventSource(new SqsEventSource(statusQueue));
    statusQueue.grantConsumeMessages(responseHandlerLambda);

    // Create policy to allow Lambda function to use @connections API of API Gateway
    const allowConnectionManagementOnApiGatewayPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: [
        `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.apiId}/${websocketStage.stageName}/*`,
      ],
      actions: ['execute-api:ManageConnections'],
    });

    connectionsTable.grantFullAccess(responseHandlerLambda);
    responseHandlerLambda.addToRolePolicy(allowConnectionManagementOnApiGatewayPolicy);
    connectionsTable.grantReadData(responseHandlerLambda);

  }
}