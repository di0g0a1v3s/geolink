const map = new Datamap({
    element: document.getElementById('map-container'),
    responsive: true,
    projection: 'mercator',
});
window.addEventListener("resize", () => {
    map.resize();
})