import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DBClient, Client } from '../models/socket-event';
const crypto = require("crypto");

export default class DynamoDBUtil {
    private client: DynamoDBClient
    private dynamoDbClient: DynamoDBDocumentClient;

    constructor() {
        this.client = new DynamoDBClient({});
        this.dynamoDbClient = DynamoDBDocumentClient.from(this.client);
    }

    async updateConnectionId(sessionId, connectionId) {
        var resp = await this.dynamoDbClient.send(new UpdateCommand({
                TableName: process.env.TABLE_NAME!,
                Key: {
                    sessionId: sessionId
                },
                UpdateExpression: "set connectionId = :con",
                ExpressionAttributeValues: {
                ":con": connectionId,
                },
                ReturnValues: "ALL_NEW",
            }));
            return resp;
    }

    async getClientById(sessionId):Promise<DBClient|undefined> {
        if(sessionId == null) {
            return;
        }
        const { Items: results } = await this.dynamoDbClient.send(new QueryCommand({
            TableName: process.env.TABLE_NAME!,
            KeyConditionExpression: 'sessionId = :c',
            ExpressionAttributeValues: {
              ':c': sessionId,
            },
            // ProjectionExpression: 'connectionId',
            Limit: 1
          }));
    
          const clients: DBClient[] = results as DBClient[];
          return clients[0]
    }

    async getClientCountByRoom(roomId):Promise<Number> {
        const { Items: waitingRoomConnections } = await this.dynamoDbClient.send(new QueryCommand({
            TableName: process.env.TABLE_NAME!,
            IndexName: 'connections-by-room-id',
            KeyConditionExpression: 'roomId = :c',
            ExpressionAttributeValues: {
              ':c': roomId,
            },
            ProjectionExpression: 'sessionId',
            // Limit: +client.gameSize
          }));
          const clients: String[] = waitingRoomConnections as String[];
          return clients.length;
    }

    async changeRooms(client: Client, newRoom) {
        var resp = await this.dynamoDbClient.send(new UpdateCommand({
            TableName: process.env.TABLE_NAME!,
            Key: {
                sessionId: client.sessionId
            },
            UpdateExpression: "set roomId = :room",
            ExpressionAttributeValues: {
                ":room": newRoom,
            },
            ReturnValues: "ALL_NEW",
        }));
        return resp;
    }

    async createClient(connectionId) {
        var newClient = new Client();
        newClient.sessionId = crypto.randomBytes(16).toString("hex");
        newClient.connectionId = connectionId;
        newClient.state = 1;
        console.log("creating new client:");
        console.log(newClient);
    
        const oneHourFromNow = Math.round(Date.now() / 1000 + 3600);
        await this.dynamoDbClient.send(new PutCommand({
          TableName: process.env.TABLE_NAME!,
          Item: {
            sessionId: newClient.sessionId,
            roomId: 'DEFAULT',
            connectionId: connectionId,
            ttl: oneHourFromNow,
          },
        }));
    
    
        return newClient;
    }

    async deactivateConnection(sessionId: string): Promise<any> {
        console.log("Deactiving " + sessionId);
        var resp = await this.dynamoDbClient.send(new UpdateCommand({
            TableName: process.env.TABLE_NAME!,
            Key: {
                sessionId: sessionId
            },
            UpdateExpression: "set roomId = :room",
            ExpressionAttributeValues: {
                ":room": "INACTIVE",
            },
            ReturnValues: "ALL_NEW",
        }));
        console.log(resp);
        return resp;
      }

      async getConnections(senderConnectionId: string, roomId: string): Promise<DBClient[]> {
        const { Items: connections } = await this.dynamoDbClient.send(new QueryCommand({
          TableName: process.env.TABLE_NAME!,
          IndexName: 'connections-by-room-id',
          KeyConditionExpression: 'roomId = :c',
          ExpressionAttributeValues: {
            ':c': roomId,
          },
          ProjectionExpression: 'connectionId, sessionId',
        }));
        return connections as DBClient[];
          // .map((c: any) => c.connectionId);
          // .filter((connectionId: string) => connectionId !== senderConnectionId);
      }

}

