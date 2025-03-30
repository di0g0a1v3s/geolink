let map = null;
let state = {
    countryFilter: null,
}
setState(state);

function setState(newState) {
    state = {...state, ...newState};
    document.getElementById('map-container').innerHTML = '';
    map = new Datamap({
        element: document.getElementById('map-container'),
        responsive: true,
        projection: 'mercator',
        geographyConfig: {
            countryFilter: state.countryFilter
        }
    });
    console.log("qqq state", state)
}
document.getElementById("country-guess").addEventListener("keydown",(e) => {
    if(e.keyCode == 13) {
        onGuessCountry(document.getElementById("country-guess").value);
        document.getElementById("country-guess").value = '';
    }
});

function onGuessCountry(guess) {
    let countryId = countryNameToIdMap.get(guess.toLowerCase())
    if(countryId != null) {
        console.log("guess: ", countryId)
        if(state.countryFilter == null) {
            setState({countryFilter: [countryId]})
        } else {
            if(state.countryFilter.some(countryID => haveBorder(countryID, countryId))) {
                setState({countryFilter: Array.from(new Set([...state.countryFilter, countryId]))})
            }
        }
        
    }
}

window.addEventListener("resize", () => {
    map.resize();
})

const allArcs = Datamap.prototype.worldTopo.arcs;
const topology = Datamap.prototype.worldTopo;
const countries = Datamap.prototype.worldTopo.objects.world.geometries;
console.log("qqq contries", countries)
const countryPointMap = new Map();
const countryIds = [];
const countryIdToIdxMap = new Map();
const countryNameToIdMap = new Map()

countries.forEach((country, idx) => {
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
        allArcs[arcId > 0 ? arcId : ~arcId]?.forEach((val) => {
            if(currPos == null) {
                currPos = {x: val[0], y: val[1]};
            } else {
                currPos = {x: currPos.x + val[0], y: currPos.y + val[1], }
            }
            pointsList.push(`x:${currPos.x},y:${currPos.y}`)
        })
        
    })
    countryPointMap.set(country.id, pointsList);
    console.log("qqq id and idx", country.id, idx)
    countryIdToIdxMap.set(country.id, idx);
    countryIds.push(country.id)
    countryNameToIdMap.set(country.properties.name.toLowerCase(), country.id)
});
console.log("qqq contries length", countries.length)

// border matrix
borderMatrix = Array(countries.length).fill().map(() => Array(countries.length).fill(false))
const setBorder = (id1, id2) => {
    const idx1 = countryIdToIdxMap.get(id1);
    const idx2 = countryIdToIdxMap.get(id2);
    borderMatrix[idx1][idx2] = true;
    borderMatrix[idx2][idx1] = true;
}
const haveBorder = (id1, id2) => {
    const idx1 = countryIdToIdxMap.get(id1);
    const idx2 = countryIdToIdxMap.get(id2);
    return borderMatrix[idx1][idx2];
}

countryIds.forEach((country1) => {
    countryIds.forEach((country2) => {
        const pointsCountry1 = countryPointMap.get(country1);
        const pointsCountry2 = countryPointMap.get(country2);
        for(let point of pointsCountry1) {
            if(pointsCountry2.indexOf(point) !== -1) {
                setBorder(country1, country2)
                console.log("qqq set border", country1, country2)
                break;
            }
        }
        
    })
})
console.log("qqq borderMatrix:",borderMatrix)


console.log("qqq countryPointMap ESP:",countryPointMap.get("ESP"))
console.log("qqq countryPointMap PRT:",countryPointMap.get("PRT"))

