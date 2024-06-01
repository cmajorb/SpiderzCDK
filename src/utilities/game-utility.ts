import { Edge, Node, NEUTRAL_COLOR, VALID_COLOR, Game, COLORS } from '../models/socket-event';

export default class GameUtils {
    static linearRender(sections: number,rings: number) {
        var edges: Edge[] = [];
        var currentIndex;
        for(var r = 0; r < rings; r++) {
          for(var t = 1; t <= sections; t++) {
            currentIndex = (r*sections)+t;
            if(t==sections) {
              edges.push([currentIndex,currentIndex-(sections-1)]); //right
            } else {
              edges.push([currentIndex,currentIndex+1]); //right
            }
            if(t==1) {
              edges.push([currentIndex,currentIndex+(sections-1)]); //left
            } else {
              edges.push([currentIndex,currentIndex-1]); //left
            }
            if(r==0){
              edges.push([999,currentIndex]); //down
            } else {
              edges.push([currentIndex,currentIndex-sections]); //down
            }
            if(r==rings-1) {
              edges.push([currentIndex,0]); //up
            } else {
              edges.push([currentIndex,currentIndex+sections]); //up
            }
          }
        }
        return edges;
      
      }

      static randomGenerate(sections: number, rings: number, randomDensity: number,edges: Edge[], numPlayer: number): [Node[], Edge[]] {
        //randomly fill tiles
        var isValid = false;
        var newedges: Edge[] = [];

        var nodesList: Node[] = [];
        var originalEdges: Edge[] = [];

        while(!isValid) {
          originalEdges = [...edges];
          nodesList= [];
          for(var i = 0;i<(sections*rings)*randomDensity; i++) {
            var randomNode = Math.floor(Math.random() * sections * rings)+1;
            nodesList.push([randomNode,NEUTRAL_COLOR]);
            originalEdges = this.removeAllEdges(randomNode,originalEdges);
            newedges = [...originalEdges]; //investigate
          }
          var bestPathLengths: number[] = [];
          for(var i = 0;i<numPlayer;i++) {
            var allShortPaths: number[][] = [];
            isValid = this.testMap(sections,rings,newedges,allShortPaths);
            if(isValid) {
              var bestPath: number[] = allShortPaths.sort(this.sortFunction)[0];
              bestPathLengths.push(bestPath.length);
              while(bestPath.length > 1) {
                this.removeAllEdges(bestPath.pop()!,newedges);
              }
              if(bestPathLengths[i]>bestPathLengths[0]+1) {
                     isValid = false;
              }
            } else {
              break;
            }
          }
        }
        return [nodesList,originalEdges];
      }

      static removeAllEdges(key: number,edges: Edge[]){
        for(var i = edges.length-1; i>=0; i--) {
          if(edges[i][0]==key || edges[i][1]==key) {
            edges.splice(i,1);
          }
        }
        return edges;
      }

      static testMap(sections: number, rings: number, newedges: Edge[],allShortPaths: number[][]) {
        var validPaths = 0;
        var shortPath: number[]|-1;
        for(var i = (sections*rings)-1; i>=(sections*rings)-sections; i--) {
            shortPath = this.shortestPath(i,sections*rings,newedges);
            if(shortPath != -1) {
              allShortPaths.push(shortPath);
              validPaths++;
            }
        }
        if(validPaths>0) {
          return true;
        } else {
          return false;
        }
      }

      static shortestPath(src: number, numVertices: number, edges: Edge[]): number[]|-1 {
        var queue: number[] = [];
        var visited: boolean[] = [];
        var pred: number[] = [];
        var dist: number[] = [];
        var path: number[] = [];
        for (var i = 0; i <= numVertices+1; i++) {
              visited.push(false);
              dist.push(9999);
              pred.push(-1);
        }
        visited[src] = true;
        dist[src] = 0;
        queue.push(src);
      
        while (queue.length != 0) {
              var u = queue.shift();
              for (var i = 0; i < edges.length; i++) {
                if(edges[i][1] == u) {
                  var destination = edges[i][0];
                  if(destination==999) {
                    destination = numVertices+1;
                  }
                  if(visited[destination] == false) {
                      visited[destination] = true;
                      dist[destination] = dist[u] + 1;
                      pred[destination] = u;
                      queue.push(destination);
                  }
                }
              }
          }
          var crawl = numVertices+1;
          path.push(999)
          if(pred[crawl] == -1) {
            return -1;
          }
          while (pred[crawl] != -1) {
            path.push(pred[crawl]);
            crawl = pred[crawl];
          }
          return path;
      }

      static sortFunction(a, b) {
        if (a[0] === b[0]) {
            return 0;
        }
        else {
            return (a[0] < b[0]) ? -1 : 1;
        }
    }

    static getValidMoves(position,edges) {
        var nodes: Node[] = [];
        for(var i = 0; i < edges.length; i++) {
          if(edges[i][1] == position) {
            nodes.push([edges[i][0],VALID_COLOR]);
          }
        }
        return nodes;
      }

      static checkAdjacent(fromNode,toNode,edges) {
        for(var i = 0; i<edges.length; i++) {
          if(edges[i][0]==toNode && edges[i][1]==fromNode) {
            return true;
          }
        }
        return false;
      }

      static removeEdge(key,edges){
        if(key==999) {
          return edges;
        }
        for(var i = edges.length-1; i >= 0; i--) {
          if(edges[i][0]==key) {
            edges.splice(i,1);
          }
        }
        return edges;
      }

    static isTrapped(position,size,edges) {
        if(this.shortestPath(position,size,edges) == -1) {
          return true;
        } else {
          return false;
        }
      }

    //checks if player is trapped and deactivates them if so
    static checkTraps(gameObject: Game) {
        var game = gameObject.gameData;
        for(var i = 0;i<game.playerData.length;i++) {
        game.playerData[i].isTrapped = this.isTrapped(game.playerData[i].position,gameObject.canvasData.size*gameObject.canvasData.sections,game.edges);
        }
    }

    static remainingTiles(src: number,numVertices: number,edges: Edge[]) {
        var queue: number[] = [];
        var visited: Boolean[] = [];
        var tiles: number[] = [];
        for (var i = 0; i <= numVertices; i++) {
              visited.push(false);
        }
        visited[src] = true;
        queue.push(src);
        while (queue.length != 0) {
              var u = queue.shift();
              for (var i = 0; i < edges.length; i++) {
                if(edges[i][1] == u) {
                   if(visited[edges[i][0]] == false) {
                      visited[edges[i][0]] = true;
                      queue.push(edges[i][0]);
                      tiles.push(edges[i][0]);
                  }
                }
              }
          }
          return tiles;
      }

    static autoComplete(index,gameObject: Game) {
        var game = gameObject.gameData;
        var player = game.playerData[index];
        var tiles = this.remainingTiles(player.position, gameObject.canvasData.size * gameObject.canvasData.sections, game.edges);
        for(var i = 0; i < tiles.length; i++) {
          game.edges = this.removeEdge(tiles[i],game.edges);
          game.nodes.push([tiles[i], COLORS[player.number]]);
        }
        // gameObject.statsData.winners.push(player.number)
        game.winner = player.name;
        player.isTrapped = true;
        player.position = 999;
      }
  
  static updateGameState(gameObject: Game): Game|string {
    var game = gameObject.gameData;
    this.checkTraps(gameObject);
    var activePlayers: number[] = [];
    for(var i = 0; i < game.playerData.length; i++) {
      if(!game.playerData[i].isTrapped) {
        activePlayers.push(i);
      }
    }
    if(activePlayers.length == 1) {
        this.autoComplete(activePlayers[0],gameObject);
    }
    gameObject.gameData.playerData[game.turnCount % game.playerData.length].activeTurn = false; //new line

    var c = 0;
    do {
      c++;
      gameObject.gameData.turnCount++;
      if(c > game.playerData.length) {
        gameObject.gameData.gameState = 1;
        
        return this.endGame(game.winner,1);
      }
    }
    while(game.playerData[gameObject.gameData.turnCount % game.playerData.length].isTrapped == true && c <= game.playerData.length);
        // gameObject.statsData.turnCount++;
        // game.currentPlayer.activeTurn = false;
        gameObject.gameData.currentPlayer = game.playerData[game.turnCount % game.playerData.length];
        // game.currentPlayer.activeTurn = true;
        gameObject.gameData.playerData[game.turnCount % game.playerData.length].activeTurn = true; //new line
        // if(game.sCurrentPlayer.isComputer) {
        //     this.computerMove(room, game.sGameTree);
        // }
        return gameObject;
  }

  static endGame(name, reason): string {
    var message;
    if(reason == 0) {
      message = name + " has left the game";
    }else if(reason == 1) {
      if(name==-1) {
        message = "No one wins :(";
      } else {
        message = "The winner is " + name;
      }
    //   postStats(gameId);
    }
    console.log(message);
    return message;

  }
}