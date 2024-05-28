// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Payload } from "./payload"
export const CANVAS_SIZES = [[6,5,30],[10,9,30],[12,11,25],[14,13,25]];

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


export class GameData {
    constructor(source: Partial<GameData>) {
        Object.assign(this, source);
    }
    public gameState: number;
    public playerData: Spider[];
}

export class CanvasData {
    constructor(source: Partial<CanvasData>) {
        Object.assign(this, source);
    }
    public RandomDensity: number;
    public Sections: number;
    public Size: number;
    public GapSize: number;
    public SpiderSize: number;
}

export enum EventType {
    RegisterError = "register error",
    Joining = "joining",
    ConfirmSession = "confirm session",
    Register = "register",
    StartSession = "start-session",
    Paired = "paired"
}