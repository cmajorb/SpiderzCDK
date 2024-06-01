import { Edge, Node, NEUTRAL_COLOR, VALID_COLOR } from '../models/socket-event';

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
}