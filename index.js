// TODO: Show the correct shortest path after a wrong attempt
// TODO: Color

class UIController {
    constructor() {
        this.gameController = new GameController(
            (guessedCountry, endGameInfo, boundingCoordinates) => {
                let gameState = "idle";
                if(endGameInfo.pathFound) {
                    if(endGameInfo.isShortestPath) {
                        gameState = "win";
                    } else {
                        gameState = "lose";
                    }
                }
                this.setState({
                    guessedCountries: [...(this.state.guessedCountries ?? []), guessedCountry],
                    gameState,
                    boundingCoordinates
                });
                document.getElementById("country-guess").value = '';
            }
        );

        window.addEventListener("resize", () => {
            this.keepMapAspectRatio();
            this.setState({});
        });

        window.onload = () => {
            document.getElementById("country-guess").addEventListener("keydown",(e) => {
                if(e.keyCode == 13) { // enter
                    this.gameController.guessCountry(document.getElementById("country-guess").value.trim());
                }
            });
            document.getElementById("reset").addEventListener("click", (e) => {
                this.init();
            });
            document.getElementById("overlay-reset").addEventListener("click", (e) => {
                this.init();
            });
            this.keepMapAspectRatio();
            this.setState({});
        };
        this.init();
    }
    
    init() {
        this.state = {
            guessedCountries: null,
            startCountry: null,
            endCountry: null,
            shortestPathLen: null,
            gameState: "idle",
            boundingCoordinates: null,
        };
        const {start, end, shortestPathLen, boundingCoordinates } = this.gameController.init();
        this.setState({
            startCountry: start,
            endCountry: end,
            shortestPathLen,
            boundingCoordinates
        })
    }

    keepMapAspectRatio() {
        document.getElementById("map-container").style = `height: ${document.getElementById("map-container").offsetWidth * 9/16}px;`;
    }

    setState(newState) {
        this.state = {...this.state, ...newState};
        document.getElementById('map-container').innerHTML = '';
        // rerender map
        const countryFilter = [this.state.endCountry, this.state.startCountry, ...(this.state.guessedCountries ?? [])].map(c => c.id)
        let center = [0,0];
        let scale = 50;
        if(this.state.boundingCoordinates != null) {
            center = [
                this.state.boundingCoordinates.longitudeMin + (this.state.boundingCoordinates.longitudeMax - this.state.boundingCoordinates.longitudeMin)/2,
                this.state.boundingCoordinates.latitudeMin + (this.state.boundingCoordinates.latitudeMax - this.state.boundingCoordinates.latitudeMin)/2,
            ]
            scale =  Math.min(
                180/(this.state.boundingCoordinates.latitudeMax - this.state.boundingCoordinates.latitudeMin) * 50, 
                360/(this.state.boundingCoordinates.longitudeMax - this.state.boundingCoordinates.longitudeMin) * 50
            )
        }
        new Datamap({
            element: document.getElementById('map-container'),
            responsive: true,
            // projection: 'mercator',
            setProjection: function(element) {
                var projection = d3.geo.mercator()
                  .center(center)
                  .scale(scale * element.offsetWidth/600)
                  .translate([element.offsetWidth / 2, element.offsetHeight / 2]);
                var path = d3.geo.path()
                  .projection(projection);
            
                return {path: path, projection: projection};
            },
            geographyConfig: {
                countryFilter: countryFilter,
            },
        });
        document.getElementById("country-end").textContent = this.state.endCountry.name;
        document.getElementById("country-start").textContent = this.state.startCountry.name;
        document.getElementById("path-length").textContent = this.state.shortestPathLen;
        document.getElementById("guess-count").textContent = this.state.guessedCountries?.length ?? 0;
        document.getElementById("guess-list").textContent = this.state.guessedCountries?.map(c => c.name).join(", ");
        if(this.state.gameState === "idle") {
            document.getElementById("overlay").classList.add("hidden");
        } else {
            document.getElementById("overlay").classList.remove("hidden");
            if(this.state.gameState === "win") {
                document.getElementById("overlay-text").textContent = "You found the shortest path!";
                document.getElementById("overlay-text").style.color = "green";
            } else if(this.state.gameState === "lose") {
                document.getElementById("overlay-text").textContent = "You found a path, but not the shortest :(";
                document.getElementById("overlay-text").style.color = "red";
            }
        }
    }
}

class GameController {
    constructor(onGuessedCountry) {
        this.worldMap = new WorldMap();
        this.guessedCountries = [];
        this.onGuessedCountry = onGuessedCountry;
        const allCountryIds = this.worldMap.getAllCountryIds();
        this.graph = new Graph(allCountryIds, (c1, c2) => this.worldMap.haveBorder(c1, c2));
        // fuzzy search
        this.fuse = new Fuse(this.worldMap.getAllCountryNames(), {
            includeScore: true,
            threshold: 0.3
        });
    }

    init() {
        this.guessedCountries = [];
        const allCountries = this.worldMap.getAllCountryIds();
        let start, end, shortestPath;
        do {
            start = allCountries[Math.floor(Math.random() * allCountries.length)]
            end = allCountries[Math.floor(Math.random() * allCountries.length)]
            shortestPath = this.graph.shortestPath(start, end)
        } while(start === end || shortestPath == null || shortestPath.length <= 2);
        console.log("qqq", shortestPath)
        this.start = start;
        this.end = end;
        
        this.shortestPathLen = shortestPath.length - 2
        return {
            start: {id: start, name: this.worldMap.getCountryNameFromId(start)},
            end: {id: end, name: this.worldMap.getCountryNameFromId(end)},
            shortestPathLen: this.shortestPathLen,
            boundingCoordinates: this.worldMap.getCountriesMinMaxCoords([start, end])
        }
    }
    
    guessCountry(guess) {
        const identifiedGuess = this.fuse.search(guess)?.[0]?.item;
        let guessCountryId = null;
        if(identifiedGuess != null) {
            guessCountryId = this.worldMap.getCountryIdFromName(identifiedGuess);
        }
        if(guessCountryId == null) {
            guessCountryId = this.worldMap.getAllCountryIds().find(id => id === guess.toUpperCase());
        }
        if(guessCountryId != null) {
            if(this.isValidGuess(guessCountryId)) {
                this.guessedCountries.push(guessCountryId);
                const tempGraph = new Graph([...this.guessedCountries, this.start, this.end], (c1, c2) => this.worldMap.haveBorder(c1, c2));
                const pathFound = tempGraph.shortestPath(this.start, this.end) != null;
                this.onGuessedCountry(
                    {id: guessCountryId, name: this.worldMap.getCountryNameFromId(guessCountryId)},
                    {pathFound: pathFound, isShortestPath: pathFound && this.shortestPathLen >= this.guessedCountries.length},
                    this.worldMap.getCountriesMinMaxCoords([...this.guessedCountries, this.end, this.start])
                );
            }
        }
    }
    
    isValidGuess(guessCountryId) {
        const shownCountries = [...this.guessedCountries, this.end, this.start]
        return shownCountries.indexOf(guessCountryId) === -1
            // && shownCountries.some(countryID => this.worldMap.haveBorder(countryID, guessCountryId))
    }
}
class WorldMap {
    constructor() {
        const allArcs = Datamap.prototype.worldTopo.arcs;
        const countries = Datamap.prototype.worldTopo.objects.world.geometries;
        const countryPointMap = new Map();
        this.countryIds = [];
        this.countryNames = [];
        this.countryIdToIdxMap = new Map();
        this.countryNameToIdMap = new Map();
        this.countryIdToNameMap = new Map();
        this.countryCoordinatesMinMax = new Map();
        topojson.feature(Datamap.prototype.worldTopo, Datamap.prototype.worldTopo.objects.world).features.forEach((data) => {
            const id = data.id;
            let latitudeMax = Number.NEGATIVE_INFINITY;
            let longitudeMax = Number.NEGATIVE_INFINITY;
            let latitudeMin = Number.POSITIVE_INFINITY;
            let longitudeMin = Number.POSITIVE_INFINITY;
            data.geometry.coordinates.forEach(coordinates => {
                const allCoordinates = [];
                if(data.geometry.type === "Polygon") {
                    allCoordinates.push(...coordinates);
                } else if(data.geometry.type === "MultiPolygon") {
                    coordinates.forEach(coordinate => {
                        allCoordinates.push(...coordinate);
                    })
                }
                latitudeMax = Math.max(latitudeMax, ...allCoordinates.map(u => u[1]))
                latitudeMin = Math.min(latitudeMin, ...allCoordinates.map(u => u[1]))
                longitudeMax = Math.max(longitudeMax, ...allCoordinates.map(u => u[0]))
                longitudeMin = Math.min(longitudeMin, ...allCoordinates.map(u => u[0]))
            });
            
            this.countryCoordinatesMinMax.set(id, {latitudeMax, longitudeMax, latitudeMin, longitudeMin});
        })
        
        countries.forEach((country, idx) => {
            if(country.id === "-99") {
                return;
            }
            const flatArcs = []; 
            if(country.type === "Polygon") {
                flatArcs.push(...country.arcs[0])
            } else if(country.type === "MultiPolygon") {
                country.arcs.forEach(arc => {
                    flatArcs.push(...arc[0]);
                })
            }
            const pointsList = [];
            flatArcs.forEach((arcId) => {
                let currPos = null;
                allArcs[arcId >= 0 ? arcId : ~arcId].forEach((val) => {
                    if(currPos == null) {
                        currPos = {x: val[0], y: val[1]};
                    } else {
                        currPos = {x: currPos.x + val[0], y: currPos.y + val[1], }
                    }
                    pointsList.push(`x:${currPos.x},y:${currPos.y}`)
                })
                
            })
            countryPointMap.set(country.id, pointsList);
            this.countryIdToIdxMap.set(country.id, idx);
            this.countryIds.push(country.id)
            this.countryNames.push(country.properties.name)
            this.countryNameToIdMap.set(country.properties.name.toLowerCase(), country.id)
            this.countryIdToNameMap.set(country.id, country.properties.name)
        });

        // border matrix
        this.borderMatrix = Array(countries.length).fill().map(() => Array(countries.length).fill(false))
        const setBorder = (id1, id2) => {
            const idx1 = this.countryIdToIdxMap.get(id1);
            const idx2 = this.countryIdToIdxMap.get(id2);
            this.borderMatrix[idx1][idx2] = true;
            this.borderMatrix[idx2][idx1] = true;
        }

        // TODO: optimize
        this.countryIds.forEach((country1) => {
            this.countryIds.forEach((country2) => {
                const pointsCountry1 = countryPointMap.get(country1);
                const pointsCountry2 = countryPointMap.get(country2);
                for(let point of pointsCountry1) {
                    if(pointsCountry2.indexOf(point) !== -1) {
                        setBorder(country1, country2)
                        break;
                    }
                }
            })
        })
    }

    haveBorder(id1, id2) {
        const idx1 = this.countryIdToIdxMap.get(id1);
        const idx2 = this.countryIdToIdxMap.get(id2);
        return this.borderMatrix[idx1][idx2];
    }

    getCountryIdFromName(name) {
        return this.countryNameToIdMap.get(name.toLowerCase());
    }

    getCountryNameFromId(id) {
        return this.countryIdToNameMap.get(id);
    }

    getAllCountryIds() {
        return [...this.countryIds]
    }

    getAllCountryNames() {
        return [...this.countryNames]
    }

    getCountriesMinMaxCoords(countryIds) {
        let latitudeMax = Number.NEGATIVE_INFINITY;
        let longitudeMax = Number.NEGATIVE_INFINITY;
        let latitudeMin = Number.POSITIVE_INFINITY;
        let longitudeMin = Number.POSITIVE_INFINITY;
        countryIds.forEach((id) => {
            latitudeMax = Math.max(latitudeMax, this.countryCoordinatesMinMax.get(id).latitudeMax)
            latitudeMin = Math.min(latitudeMin, this.countryCoordinatesMinMax.get(id).latitudeMin)
            longitudeMax = Math.max(longitudeMax, this.countryCoordinatesMinMax.get(id).longitudeMax)
            longitudeMin = Math.min(longitudeMin, this.countryCoordinatesMinMax.get(id).longitudeMin)
        })
        return {latitudeMax, longitudeMax, latitudeMin, longitudeMin}
    }
}

class Graph {
    constructor(allNodes, areNeigbours) {
        this.adjacencyList = {};
        for(let node1 of allNodes) {
            for(let node2 of allNodes) {
                if(areNeigbours(node1, node2)) {
                    this.addEdge(node1, node2)
                }
            }
        }
    }
  
    addVertex(vertex) {
        if (!this.adjacencyList[vertex]) this.adjacencyList[vertex] = [];
    }
  
    addEdge(v1, v2) {
        if (!this.adjacencyList[v1]) this.addVertex(v1);
        if (!this.adjacencyList[v2]) this.addVertex(v2);
        this.adjacencyList[v1].push(v2);
        this.adjacencyList[v2].push(v1); // undirected graph
    }
  
    shortestPath(start, end) {
        let queue = [[start]];
        let visited = new Set();
    
        while (queue.length > 0) {
            let path = queue.shift();
            let node = path[path.length - 1];
    
            if (node === end) return path;
    
            if (!visited.has(node)) {
                visited.add(node);
                for (let neighbor of this.adjacencyList[node] || []) {
                    queue.push([...path, neighbor]);
                }
            }
        }
    
        return null; // no path found
    }
}

new UIController();
