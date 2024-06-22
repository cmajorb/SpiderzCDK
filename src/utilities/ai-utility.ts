import { Game, MapNode } from '../models/socket-event';
import GameUtils from '../utilities/game-utility';

export default class AIUtils {

  static computerMove(game: Game, tree: MapNode) {
    var computer = game.gameData.playerData[1];

    var validNodes = GameUtils.getValidMoves(game.gameData.currentPlayer.position,game.gameData.edges);
    var maxScore = 0;
    var bestNode = validNodes[0];
    if(!computer.isTrapped) {
      validNodes.forEach( (node) => {
        var score = 0;
        var shortPath = GameUtils.shortestPath(node[0],game.canvasData.sections*game.canvasData.size,game.gameData.edges);
        if(shortPath != -1) {
          score = 2;
        } else if(node[0] == 999) {
          score = 0;
        }

        if(score > maxScore) {
          maxScore = score;
          bestNode = node;
        }
      });
      
    //   var max = -Infinity;
    //   var position = 0;
    //   if(tree.children[0]) {
    //     console.log("--" + tree.children[0].layer % 2 + "--");
    //   }
    //   tree.children.forEach(function(a, i){
    //     console.log(a.position+":"+a.value);
    //     if (a.value>max) {
    //       position = a.position;
    //       max = a.value;
    //     }
    //   });

      GameUtils.makeMove(game,bestNode[0]);
    }
  }
  
  static generateTree(node: MapNode, p1pos: number, p2pos: number, size: number): MapNode {
    // a win for player 1 is 1
    // a win for player 2 is -1
    var scores: number[] = [];
    if(node.layer % 2 == 0) {
      var position = p1pos;
    } else {
      var position = p2pos;
    }
    if(GameUtils.isTrapped(p1pos, size, node.edges)) {
      node.value = -1;
      return node;
    }
    if(GameUtils.isTrapped(p2pos, size, node.edges)) {
      node.value = 1;
      return node;
    }
    if(p1pos == 999) {
      if(GameUtils.isTrapped(p2pos, size, node.edges)) {
        node.value = 1;
        return node;
      } else {
        node.value = -1;
        return node;
      }
    }
    if(p2pos == 999) {
      if(GameUtils.isTrapped(p1pos, size, node.edges)) {
        node.value = -1;
        return node;
      } else {
        node.value = 1;
        return node;
      }
    }
  
    for(var i = 0; i < node.edges.length; i++) {
      if(node.edges[i][1] == position) {
        var newEdges = node.edges.slice(0);
        newEdges = GameUtils.removeEdge(node.edges[i][0], newEdges);
  
        if(node.layer%2==0) {
  
          var childNode = new MapNode(newEdges, node.layer + 1, node.edges[i][0]);
          node.children.push(childNode);
  
          scores.push(AIUtils.generateTree(childNode, node.edges[i][0], p2pos,size).value);
        } else {
          var childNode = new MapNode(newEdges,node.layer+1,node.edges[i][0]);
          node.children.push(childNode);
  
          scores.push(AIUtils.generateTree(childNode,p1pos,node.edges[i][0],size).value);
        }
      }
    }
    //console.log("scores:"+scores);
    if(node.layer%2==0) {
      node.value = Math.max(...scores)
    } else {
      node.value = Math.min(...scores)
    }
    return node;
  }
}