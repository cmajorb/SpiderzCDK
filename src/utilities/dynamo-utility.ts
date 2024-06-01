import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DBClient, Client, CanvasData, CANVAS_SIZES, Game, GameData, Spider } from '../models/socket-event';
import GameUtils from './game-utility';
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
                UpdateExpression: "set connectionId = :con, roomId = :room",
                ExpressionAttributeValues: {
                ":con": connectionId,
                ":room": "DEFAULT"
                },
                ReturnValues: "ALL_NEW",
            }));
            return resp;
    }

    async updateGame(gameObject: Game) {
        console.log("Updating game " + gameObject.gameId);
        var resp = await this.dynamoDbClient.send(new UpdateCommand({
                TableName: process.env.GAME_TABLE_NAME!,
                Key: {
                    gameId: gameObject.gameId
                },
                UpdateExpression: "set gameObject = :game",
                ExpressionAttributeValues: {
                ":game": JSON.stringify(gameObject)
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

    async getClientsByRoom(roomId, limit: number):Promise<DBClient[]> {
        var command = new QueryCommand({
            TableName: process.env.TABLE_NAME!,
            IndexName: 'connections-by-room-id',
            KeyConditionExpression: 'roomId = :c',
            ExpressionAttributeValues: {
              ':c': roomId,
            },
            ProjectionExpression: 'sessionId, clientName',
            Limit: limit
          });

        const { Items: clients } = await this.dynamoDbClient.send(command);
        return clients as DBClient[];
    }

    async changeRoomAndUpdateName(sessionId, newRoom, clientName) {
        var resp = await this.dynamoDbClient.send(new UpdateCommand({
            TableName: process.env.TABLE_NAME!,
            Key: {
                sessionId: sessionId
            },
            UpdateExpression: "set roomId = :room, clientName = :clientName",
            ExpressionAttributeValues: {
                ":room": newRoom,
                ":clientName": clientName,
            },
            ReturnValues: "ALL_NEW",
        }));
        return resp;
    }

    async changeRooms(sessionId, newRoom) {
        var resp = await this.dynamoDbClient.send(new UpdateCommand({
            TableName: process.env.TABLE_NAME!,
            Key: {
                sessionId: sessionId
            },
            UpdateExpression: "set roomId = :room",
            ExpressionAttributeValues: {
                ":room": newRoom
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

      async getGameById(gameId: string): Promise<Game> {
        console.log("Getting game " + gameId);
        const { Items: connections } = await this.dynamoDbClient.send(new QueryCommand({
            TableName: process.env.GAME_TABLE_NAME!,
            KeyConditionExpression: 'gameId = :game',
            ExpressionAttributeValues: {
                ':game': gameId,
            },
            ProjectionExpression: 'gameObject',
            }));
  
        return JSON.parse(connections!.map((c: any) => c.gameObject)[0]) as Game;
      }

      async createRoom(clients: DBClient[]) {
        var roomId = crypto.randomBytes(16).toString("hex");
        const waitingRoom = "waitRoom" + clients.length;
        var spiders: Spider[] = [];

        for (let i = 0; i < clients.length ; i++) {
            console.log(clients[i].sessionId);
            const updateCommand = new UpdateCommand({
                TableName: process.env.TABLE_NAME!,
                Key: {
                    sessionId: clients[i].sessionId
                },
                UpdateExpression: "set roomId = :roomId",
                ConditionExpression: "roomId= :waitingRoom",
                ExpressionAttributeValues: {
                    ":roomId": roomId,
                    ":waitingRoom": waitingRoom
                }
            });
            spiders.push(new Spider(clients[i].sessionId,clients[i].clientName,i,false));

            try {
                await this.dynamoDbClient.send(updateCommand);
                console.log(`Added ${clients[i].sessionId} to room ${roomId}`);
            } catch (error) {
                if (error.name === 'ConditionalCheckFailedException') {
                    console.log(`Session ${clients[i].sessionId} was modified by another process.`);
                } else {
                    console.error(`Error updating ${clients[i].sessionId}:`, error);
                }
            }
        }
        const canvasId = clients.length - 1;
        var canvasData = new CanvasData({
            randomDensity: 0.25,
            sections: CANVAS_SIZES[canvasId][0],
            size: CANVAS_SIZES[canvasId][1],
            gapSize: CANVAS_SIZES[canvasId][2],
            spiderSize: CANVAS_SIZES[canvasId][2]/10
          });

        var edges = GameUtils.linearRender(canvasData.sections,canvasData.size)
        var nodesAndEdges = GameUtils.randomGenerate(canvasData.sections,canvasData.size,canvasData.randomDensity,edges,spiders.length)
        var currentPlayer = spiders[0];
        currentPlayer.activeTurn= true;

        var gameData = new GameData({
            playerData: spiders,
            gameState: 1,
            nodes: nodesAndEdges[0],
            edges: nodesAndEdges[1],
            winner: "",
            currentPlayer: currentPlayer,
            turnCount: 0
        });

        var game = new Game({
            gameId: roomId,
            gameData: gameData,
            canvasData: canvasData,
        });
        await this.dynamoDbClient.send(new PutCommand({
            TableName: process.env.GAME_TABLE_NAME!,
            Item: {
              gameId: game.gameId,
              gameObject: JSON.stringify(game)
            },
          }));

        return roomId;
    }
}

