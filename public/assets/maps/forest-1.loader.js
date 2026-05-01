// Phaser 3 loader snippet for the 'forest-1' map.
// Drop the preload() and create() bodies into your scene.
// Paths below are relative to the tmj file's location.
// Adjust them to be relative to your Phaser web root before shipping.

function preload() {
    this.load.image('forest-1_tiles', '../tilesets/forest-1.png');
    this.load.tilemapTiledJSON('forest-1', 'forest-1.tmj');
}

function create() {
    const map = this.make.tilemap({ key: 'forest-1' });
    const tileset = map.addTilesetImage('forest-1', 'forest-1_tiles');

    const groundLayer = map.createLayer('ground', tileset, 0, 0);
    const belowPlayerLayer = map.createLayer('belowPlayer', tileset, 0, 0);
}
