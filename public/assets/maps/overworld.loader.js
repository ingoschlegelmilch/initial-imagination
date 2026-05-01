// Phaser 3 loader snippet for the 'overworld' map.
// Drop the preload() and create() bodies into your scene.
// Paths below are relative to the tmj file's location.
// Adjust them to be relative to your Phaser web root before shipping.

function preload() {
    this.load.image('overworld_tiles', '../tilesets/overworld.png');
    this.load.tilemapTiledJSON('overworld', 'overworld.tmj');
}

function create() {
    const map = this.make.tilemap({ key: 'overworld' });
    const tileset = map.addTilesetImage('overworld', 'overworld_tiles');

    const groundLayer = map.createLayer('ground', tileset, 0, 0);
    const belowPlayerLayer = map.createLayer('belowPlayer', tileset, 0, 0);
}
