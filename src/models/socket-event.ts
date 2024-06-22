// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Payload } from "./payload"
export const CANVAS_SIZES = [[6,5,30],[10,9,30],[12,11,25],[14,13,25]];
export const NEUTRAL_COLOR = "#c0c0c0";
export const COLORS = ["#FF0000","#0000FF","#FFFF00","#00FF00"];
export const VALID_COLOR = "#e0bfff";
export const ADJECTIVES = ['Bored','Friendly','Gorgeous','Feral','Wispy','Burnt','Hollow',
'Youthful','Nurturing','Quiet','Lame','Curt','Billowing','Mature',
'Jealous','Delicate','Pouting','Sinister','Angelic','Caramelized',
'Toxic','Questing','Humiliating','Girly','Manly','Cozy','Putrid','Amazed',
'Wilted','Witty'];
export const NOUNS = ['Alligator','Bert','Candlestick','Doghouse','Emer','Foghorn','Gardener',
'Huckleberry','Igloo','Jack','Karen','Love','Macaroni','Nucklebones','Oculus',
'Popcorn','Questions','Raccoon','Stampede','Tazer','Uzi','Vat','Water',
'Xenophobe','Yak','Zero'];

export class SocketEvent extends Payload {
    constructor(init?:Partial<SocketEvent>) {
        super("SocketEvent");
        Object.assign(this, init);
    } 
    public connectionId!: string;
    public sessionId!: string;
    public eventType!: string;
    public eventBody!: Object;
    public eventDate!: Date;
    public roomId!: string;
}

export class Client {
    public name!: string;
    public sessionId!: string;
    public connectionId!: string;
    public gameSize!: number;
    public state!: number;
    public waitTime!: number;
}

export class DBClient {
    public sessionId!: string;
    public roomId!: string;
    public connectionId!: string;
    public clientName!: string;
    public ttl!: number;
}

export class Game {
    constructor(source: Partial<Game>) {
        Object.assign(this, source);
    }
    public gameId: string;
    public gameData: GameData;
    public canvasData: CanvasData;
}

export class Spider {
    constructor(id,name,number,isComputer) {
        this.position = 0;
        this.id = id;
        this.activeTurn = false;
        this.name = name;
        this.isTrapped = false;
        this.number = number;
        this.isComputer = isComputer;
    }
    public position: number;
    public id: string;
    public activeTurn: boolean;
    public name: string;
    public isTrapped: boolean;
    public number: number;
    public isComputer: boolean;
}

export type Edge = [number, number];
export type Node = [number, string];

export class MapNode {
    constructor(edges,layer,position) {
        this.edges = edges;
        this.children = [];
        this.layer = layer;
        this.value = -1;
        this.position = position;
      }
      public edges: Edge[];
      public children: MapNode[];
      public layer: number;
      public value: number;
      public position: number;
}

export class GameData {
    constructor(source: Partial<GameData>) {
        Object.assign(this, source);
    }
    public gameState: number;
    public playerData: Spider[];
    public nodes: Node[];
    public edges: Edge[];
    public winner: string;
    public turnCount: number;
    public currentPlayer: Spider;
    public gameTree: MapNode|null;
}

export class CanvasData {
    constructor(source: Partial<CanvasData>) {
        Object.assign(this, source);
    }
    public randomDensity: number;
    public sections: number;
    public size: number;
    public gapSize: number;
    public spiderSize: number;
}

export enum EventType {
    RegisterError = "register error",
    Joining = "joining",
    ConfirmSession = "confirm session",
    Register = "register",
    StartSession = "start-session",
    Paired = "paired",

    State = "state",
    StartGame = "start game",
    PlayerConnect = "player connect",
    InitGame = "init",
    MakeMove = "make move",
    NoResponse = "no response",
    EndGame = "end game",
}